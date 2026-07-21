/**
 * Contoured Footprint Construction（共用贴合轮廓构造）
 *
 * 从 placed Slot Geometry Snapshots、Boundary Spacing、smoothing radius、disconnection distance
 * 派生 2D 贴合轮廓。custom 与 stepped 两个工作流共用同一套构造逻辑，使二维预览、三维生成、
 * 尺寸、Contour Body Count、底板孔位边缘校验消费同一个轮廓结果（CONTEXT:259-262, 625）。
 *
 * 原实现位于 stepped-profile-footprint.ts，本次抽出为跨模式共用模块；旧文件保留向后兼容 re-export。
 */
import {
  booleans,
  geometries,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import {
  generateOutlineGeom2,
  insetGeom2,
  type OutlineCircle,
} from "@/lib/outline-geometry";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import {
  clusterConnectivityCircles,
  getConnectivityRadius,
  getEffectiveBridgeGap,
  type ConnectivityCircle,
} from "@/lib/stepped-connectivity";
import type { FreeSlot } from "@/types/custom-tray";

const { union } = booleans;
const { geom2 } = geometries;
const { circle } = primitives;
const { rotateZ, translate } = transforms;
const DEG_TO_RAD = Math.PI / 180;

/**
 * 贴合轮廓派生所需的单个槽位数据。
 * 与具体模式解耦：custom 与 stepped 各自把自己的 Slot Instance 投影成此结构。
 */
export interface ContouredFootprintSlot {
  id: string;
  cx: number;
  cy: number;
  rotation: number;
  shape: FreeSlot["shape"];
  profile: {
    width: number;
    height: number;
    outerOffset: number;
    profileExponent?: number;
  };
}

/**
 * @deprecated 历史别名，等价于 ContouredFootprintSlot。新代码请使用 ContouredFootprintSlot。
 */
export type SteppedFootprintSlot = ContouredFootprintSlot;

function createOffsetProfileShape(
  slot: ContouredFootprintSlot,
  offset: number,
): Geom2 {
  const points = sampleSlotProfilePoints(
    slot.profile.width,
    slot.profile.height,
    slot.shape,
    offset,
    RENDER_CONFIG.cylinderSegments,
    slot.profile.profileExponent,
  ).map((point): [number, number] => [point.x, point.y]);
  return geom2.fromPoints(points);
}

function buildProfileClusterFootprint(
  cluster: ConnectivityCircle[],
  slotsById: ReadonlyMap<string, ContouredFootprintSlot>,
  spacing: number,
  smoothingRadius: number,
): Geom2 | null {
  const clampedSmoothing = Math.max(0, smoothingRadius);
  const buildParts = (extraOffset: number) => cluster
    .map((connectivity) => slotsById.get(connectivity.id))
    .filter((item): item is ContouredFootprintSlot => Boolean(item))
    .map((item) => {
      const profile = createOffsetProfileShape(
        item,
        item.profile.outerOffset + spacing + extraOffset,
      );
      return translate(
        [item.cx, item.cy],
        rotateZ(item.rotation * DEG_TO_RAD, profile),
      ) as Geom2;
    });

  const parts = buildParts(clampedSmoothing);
  if (parts.length === 0) {
    return null;
  }

  const expanded = parts.length === 1 ? parts[0] : union(...parts);
  if (clampedSmoothing <= 0) {
    return expanded;
  }

  const smoothed = insetGeom2(
    expanded,
    clampedSmoothing,
    RENDER_CONFIG.cylinderSegments,
  );
  if (smoothed) {
    return smoothed;
  }

  const fallbackParts = buildParts(0);
  return fallbackParts.length === 1
    ? fallbackParts[0]
    : union(...fallbackParts);
}

function buildCircularClusterFootprint(
  cluster: ConnectivityCircle[],
  smoothingRadius: number,
): Geom2 | null {
  const outline = generateOutlineGeom2(
    cluster.map(
      (item): OutlineCircle => ({
        cx: item.cx,
        cy: item.cy,
        rOuter: item.rOuter,
      }),
    ),
    smoothingRadius,
    RENDER_CONFIG.cylinderSegments,
  );
  if (outline) {
    return outline;
  }

  const parts = cluster.map((item) =>
    translate(
      [item.cx, item.cy],
      circle({
        radius: item.rOuter,
        segments: RENDER_CONFIG.cylinderSegments,
      }),
    ) as Geom2,
  );
  return parts.length === 0
    ? null
    : parts.length === 1
      ? parts[0]
      : union(...parts);
}

/**
 * 为一个连通集群构造贴合轮廓 Geom2。
 * 含椭圆槽时走采样 profile 路径，纯圆形集群走形态学闭运算路径。
 *
 * custom 与 stepped 均通过此函数得到给定输入下的同一 2D 轮廓（CONTEXT:625）。
 */
export function buildContouredClusterFootprint(
  cluster: ConnectivityCircle[],
  slotsById: ReadonlyMap<string, ContouredFootprintSlot>,
  spacing: number,
  smoothingRadius: number,
): Geom2 | null {
  const containsEllipse = cluster.some(
    (item) => slotsById.get(item.id)?.shape === "ellipse",
  );
  return containsEllipse
    ? buildProfileClusterFootprint(
      cluster,
      slotsById,
      spacing,
      smoothingRadius,
    )
    : buildCircularClusterFootprint(cluster, smoothingRadius);
}

/**
 * Contoured Footprint Construction 的派生结果。
 * - `bodies`：所有非空 2D 实体（每个连通集群一个），custom/stepped 共用同一份输入得到同一份结果（CONTEXT:625）。
 * - `bodyCount`：Contour Body Count，可被多体提示与结果摘要直接消费（CONTEXT:256, 628）。
 */
export interface ContouredFootprintResult {
  bodies: Geom2[];
  bodyCount: number;
}

/**
 * 从一组 Slot Instances 派生 Contoured Footprint。
 *
 * 这是 custom 与 stepped 共享的统一入口：调用方传入自己的 Slot Instance 投影
 * 与 spacing/smoothing/disconnect 参数，得到同一组 2D bodies 与实体数（CONTEXT:625-626）。
 * bodies 可直接被二维预览、三维拉伸、尺寸外接框、Contour Body Count、底板孔位边缘校验消费。
 */
export function deriveContouredFootprint(
  slots: ContouredFootprintSlot[],
  slotSpacing: number,
  boundarySpacing: number,
  smoothingRadius: number,
  disconnectDistance: number,
): ContouredFootprintResult {
  if (slots.length === 0) {
    return { bodies: [], bodyCount: 0 };
  }

  const connectivityCircles: ConnectivityCircle[] = slots.map((slot) => ({
    id: slot.id,
    cx: slot.cx,
    cy: slot.cy,
    rOuter: getConnectivityRadius(
      slot.profile.width,
      slot.profile.height,
      slotSpacing,
      slot.profile.outerOffset * 2,
      slot.profile.outerOffset * 2,
    ),
  }));

  const effectiveBridgeGap = getEffectiveBridgeGap(
    smoothingRadius,
    disconnectDistance,
  );
  const clusters = clusterConnectivityCircles(
    connectivityCircles,
    effectiveBridgeGap,
  );

  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const bodies = clusters
    .map((cluster) =>
      buildContouredClusterFootprint(
        cluster,
        slotsById,
        boundarySpacing,
        smoothingRadius,
      ),
    )
    .filter((item): item is Geom2 => item !== null);

  return {
    bodies,
    bodyCount: bodies.length,
  };
}

/**
 * 计算 Contour Body Count（独立可打印实体数）。
 * 仅返回数量，适用于不需要 2D bodies 的轻量场景（如结果摘要、校验提示）。
 */
export function countContourBodies(
  slots: ContouredFootprintSlot[],
  slotSpacing: number,
  boundarySpacing: number,
  smoothingRadius: number,
  disconnectDistance: number,
): number {
  return deriveContouredFootprint(
    slots,
    slotSpacing,
    boundarySpacing,
    smoothingRadius,
    disconnectDistance,
  ).bodyCount;
}
