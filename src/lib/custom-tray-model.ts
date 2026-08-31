import {
  booleans,
  geometries,
  transforms,
  extrusions,
  measurements,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { CustomLayoutParams } from "@/types/custom-tray";
import {
  calculateCustomTrayFootprint,
} from "@/lib/custom-layout-math";
import type { ConstructedContouredFootprint } from "@/lib/contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import {
  createBaseBody,
  createOffsetSlotShape,
  subtractBaseHoleConstructionPlan,
} from "@/lib/model-utils";
import { createCustomBaseHoleConstructionPlan } from "@/lib/base-hole-planning";

const { subtract, union } = booleans;
const { geom3 } = geometries;
const { translate, rotateZ } = transforms;
const { extrudeLinear } = extrusions;
const { measureVolume } = measurements;

const DEG_TO_RAD = Math.PI / 180;

/**
 * 保证几何体积为正，避免布尔运算后法线方向反转导致 measureVolume 返回负值。
 * 参考 stepped-cad-realization.ts 的同名 Implementation。
 */
function orientPositiveVolume(geometry: Geom3): Geom3 {
  return measureVolume(geometry) < 0 ? geom3.invert(geometry) : geometry;
}

/**
 * 根据自定义参数生成托盘 3D 模型
 *
 * 坐标系说明：
 * - JSCAD 原点 (0,0,0) 对应托盘底板中心
 * - 用户坐标 (x,y) 原点对应托盘左下角
 * - 转换公式：jscad_x = user_x - width/2, jscad_y = user_y - depth/2
 *
 * 底座轮廓样式（footprintStyle）：
 * - rectangular：createBaseBody 生成圆角矩形 + 可选侧面斜角，保持原语义
 * - contoured：直接拉伸 Contoured Footprint Construction 的 2D bodies；
 *   不应用 corner radius / side bevel（CONTEXT:615-617），允许产生多个独立实体
 */
export function createCustomTrayModel(
  params: CustomLayoutParams,
  contouredState: ContouredFootprintState<ConstructedContouredFootprint> = {
    status: "inactive",
  },
): Geom3 {
  const { slots, baseThickness, holeDepth, cornerRadius, sideBevelWidth } = params;
  if (params.footprintStyle === "contoured" && contouredState.status !== "ready") {
    throw new Error(
      contouredState.status === "failed"
        ? contouredState.error.message
        : "Contoured Footprint Construction 结果未激活",
    );
  }
  const constructedContoured =
    contouredState.status === "ready" ? contouredState.value : null;
  const footprint = calculateCustomTrayFootprint(params, contouredState);
  const trayWidth = footprint.width;
  const trayDepth = footprint.depth;
  const totalHeight = baseThickness + holeDepth;
  const sourceCenterX = footprint.sizingMode === "auto" && footprint.hasSlots
    ? (footprint.minX + footprint.maxX) / 2
    : trayWidth / 2;
  const sourceCenterY = footprint.sizingMode === "auto" && footprint.hasSlots
    ? (footprint.minY + footprint.maxY) / 2
    : trayDepth / 2;

  // 1. 创建底板实体（按 footprint style 分流）
  let body: Geom3;
  if (footprint.footprintStyle === "contoured") {
    body = createContouredBaseBody(
      params,
      constructedContoured!,
      baseThickness + holeDepth,
    );
  } else {
    body = createBaseBody(
      trayWidth,
      trayDepth,
      totalHeight,
      cornerRadius,
      sideBevelWidth,
    );
  }

  // 2. 生成凹槽
  const holes: Geom3[] = [];

  for (const slot of slots) {
    const normalizedX = slot.x - sourceCenterX + trayWidth / 2;
    const normalizedY = slot.y - sourceCenterY + trayDepth / 2;

    // 用户坐标 → JSCAD 中心坐标
    const cx = normalizedX - trayWidth / 2;
    const cy = normalizedY - trayDepth / 2;

    const profile = getFreeSlotProfileGeometry(slot);
    const width = profile.width;
    const height = profile.height;
    const rotation = slot.rotation || 0;
    // 2D 椭圆 → 等距外扩 → 拉伸 → 旋转 → 平移
    const holeShape2D = createOffsetSlotShape(
      width,
      height,
      slot.shape,
      profile.outerOffset,
      profile.profileExponent,
    );

    const hole3D = extrudeLinear({ height: holeDepth + 0.02 }, holeShape2D);
    const rotatedHole = rotateZ(rotation * DEG_TO_RAD, hole3D);
    const placedHole = translate([cx, cy, baseThickness], rotatedHole);

    holes.push(placedHole);
  }

  // 3. 布尔运算
  let tray = holes.length > 0 ? subtract(body, ...holes) : body;

  // 4. 执行权威底板孔位计划；Adapter 使用用户坐标，CAD 使用底盘中心坐标。
  tray = subtractBaseHoleConstructionPlan(
    tray,
    createCustomBaseHoleConstructionPlan(params, { contouredState }),
  );

  return tray;
}

/**
 * 从 contoured footprint 的 2D bodies 拉伸生成底座实体。
 * contoured footprint 在用户坐标系中已经包含 boundary spacing 外扩，
 * 这里需要把用户坐标系中心（外接框中心）平移到 JSCAD 中心。
 */
function createContouredBaseBody(
  params: CustomLayoutParams,
  contoured: ConstructedContouredFootprint,
  totalHeight: number,
): Geom3 {
  if (contoured.bodies.length === 0) {
    // 无槽位时退化为占位底座，避免下游 measureVolume 等失败
    return createBaseBody(params.trayWidth, params.trayDepth, totalHeight, 0, 0);
  }

  // 把用户坐标系下的 2D 轮廓平移到 JSCAD 中心坐标系
  const centerX = ((contoured.bounds?.minX ?? 0) + (contoured.bounds?.maxX ?? 0)) / 2;
  const centerY = ((contoured.bounds?.minY ?? 0) + (contoured.bounds?.maxY ?? 0)) / 2;

  const solids = contoured.bodies.map((body) =>
    orientPositiveVolume(
      translate(
        [-centerX, -centerY, 0],
        extrudeLinear({ height: totalHeight }, body.geometry),
      ),
    ),
  );

  const combined = solids.length === 1 ? solids[0] : union(...solids);
  return orientPositiveVolume(combined);
}

/** 计算自定义托盘的边界尺寸。 */
export function calculateCustomTrayDimensions(
  params: CustomLayoutParams,
  contouredState: ContouredFootprintState<ConstructedContouredFootprint> = {
    status: "inactive",
  },
) {
  const footprint = calculateCustomTrayFootprint(params, contouredState);
  return {
    width: footprint.width,
    depth: footprint.depth,
    height: params.baseThickness + params.holeDepth,
  };
}
