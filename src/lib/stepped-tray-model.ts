import {
  booleans,
  primitives,
  transforms,
  extrusions,
  measurements,
  geometries,
} from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";
import { RENDER_CONFIG } from "@/lib/config";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import {
  generateOutlineGeom2,
  type OutlineCircle,
} from "@/lib/outline-geometry";
import {
  clusterConnectivityCircles,
  getConnectivityRadius,
  getEffectiveBridgeGap,
  type ConnectivityCircle,
} from "@/lib/stepped-connectivity";
import { getEffectiveGroupStructureParams } from "@/lib/stepped-group-params";

const { subtract, union } = booleans;
const { translate, rotateZ } = transforms;
const { ellipse, circle } = primitives;
const { extrudeLinear } = extrusions;
const { measureVolume } = measurements;
const { geom2 } = geometries;

const DEG_TO_RAD = Math.PI / 180;

function getSlotBoundingHalfSize(
  width: number,
  height: number,
  rotation: number,
  shape: SteppedSlot["shape"],
  offset: number,
) {
  const rad = (rotation * Math.PI) / 180;
  const points = sampleSlotProfilePoints(
    width,
    height,
    shape,
    offset,
    RENDER_CONFIG.cylinderSegments,
  );
  let halfW = 0;
  let halfH = 0;

  for (const point of points) {
    const x = point.x * Math.cos(rad) - point.y * Math.sin(rad);
    const y = point.x * Math.sin(rad) + point.y * Math.cos(rad);
    halfW = Math.max(halfW, Math.abs(x));
    halfH = Math.max(halfH, Math.abs(y));
  }

  return { halfW, halfH };
}

function createOffsetSlotShape(
  width: number,
  height: number,
  shape: SteppedSlot["shape"],
  offset: number,
): Geom2 {
  if (offset <= 0) {
    return ellipse({
      radius: [width / 2, height / 2],
      segments: RENDER_CONFIG.cylinderSegments,
    });
  }

  const points = sampleSlotProfilePoints(
    width,
    height,
    shape,
    offset,
    RENDER_CONFIG.cylinderSegments,
  ).map((point): [number, number] => [point.x, point.y]);

  return geom2.fromPoints(points);
}

function calculateEffectiveBaseplate(params: SteppedLayoutParams) {
  const boundarySpacing = params.spacing;

  if (params.slots.length === 0) {
    return {
      hasSlots: false,
      width: 0,
      depth: 0,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  params.slots.forEach((slot) => {
    const profile = getFreeSlotProfileGeometry(slot);
    const { halfW, halfH } = getSlotBoundingHalfSize(
      profile.width,
      profile.height,
      slot.rotation,
      slot.shape,
      profile.outerOffset,
    );
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  });

  return {
    hasSlots: true,
    width: Math.ceil(maxX - minX + boundarySpacing * 2),
    depth: Math.ceil(maxY - minY + boundarySpacing * 2),
    minX,
    maxX,
    minY,
    maxY,
  };
}

/**
 * 根据阶梯底座参数生成托盘 3D 模型（按组独立实体 + 纳入更高组为平滑连接上下文）
 *
 * 结构说明：
 * - 每个分组独立生成自己的实体（组间不共享轮廓，同高度组互不干扰）
 * - 计算某组的平滑轮廓时，额外纳入"所有高度严格更高的组"的凹槽作为上下文
 *   → 低组实体自然包裹高组圆柱脚印，实现"低层过渡包围高层圆柱"的平滑效果
 *   → 同高度的不同组互不纳入，保持各自独立
 * - 每组实体高度 = group.bottomHeight，从 z=0 向上生长
 * - 高组在其实体内减除低组凹槽正上方的让位空间（避免高组连接桥侵占低组插槽上方）
 * - 所有组实体 union 后形成最终底座
 * - 每个凹槽从其所在组顶部向下挖 holeDepth 深度
 */
export function createSteppedTrayModel(params: SteppedLayoutParams): Geom3 {
  const { slots, groups, spacing, holeDepth } = params;

  if (slots.length === 0 || groups.length === 0) {
    return extrudeLinear(
      { height: 0.1 },
      ellipse({ radius: [1, 1], segments: 4 }),
    );
  }

  const effective = calculateEffectiveBaseplate(params);
  const trayWidth = effective.hasSlots ? effective.width : params.trayWidth;
  const trayDepth = effective.hasSlots ? effective.depth : params.trayDepth;
  const sourceCenterX = effective.hasSlots
    ? (effective.minX + effective.maxX) / 2
    : trayWidth / 2;
  const sourceCenterY = effective.hasSlots
    ? (effective.minY + effective.maxY) / 2
    : trayDepth / 2;

  // 将每个凹槽映射到 JSCAD 坐标
  const slotData = slots.map((slot) => {
    const group = groups.find((g) => g.id === slot.groupId);
    const normalizedX = slot.x - sourceCenterX + trayWidth / 2;
    const normalizedY = slot.y - sourceCenterY + trayDepth / 2;
    const cx = normalizedX - trayWidth / 2;
    const cy = normalizedY - trayDepth / 2;
    const rotation = slot.rotation || 0;
    const profile = getFreeSlotProfileGeometry(slot);
    const actualW = profile.width + profile.outerOffset * 2;
    const actualH = profile.height + profile.outerOffset * 2;
    const columnHeight = Math.max(group?.bottomHeight ?? 10, 3);
    return {
      slot,
      cx,
      cy,
      rotation,
      actualW,
      actualH,
      profile,
      columnHeight,
      groupId: slot.groupId,
    };
  });

  // 辅助：生成一组凹槽的外扩实体（0 → height）
  function buildGroupSolid(
    groupSlotData: typeof slotData,
    height: number,
    structureParams: Pick<
      SteppedLayoutParams,
      "smoothingRadius" | "disconnectDistance"
    >,
  ): Geom3 {
    const circleMap = new Map<string, ConnectivityCircle>();
    const slotDataMap = new Map<string, (typeof slotData)[number]>();

    for (const d of groupSlotData) {
      const rOuter = getConnectivityRadius(
        d.slot.width,
        d.slot.height,
        spacing,
        d.profile.outerOffset * 2,
        d.profile.outerOffset * 2,
      );
      circleMap.set(d.slot.id, { id: d.slot.id, cx: d.cx, cy: d.cy, rOuter });
      slotDataMap.set(d.slot.id, d);
    }

    const clusteredCircles = clusterConnectivityCircles(
      [...circleMap.values()],
      getEffectiveBridgeGap(
        structureParams.smoothingRadius,
        structureParams.disconnectDistance,
      ),
    );

    const solids = clusteredCircles.map((cluster) => {
      const outlineCircles: OutlineCircle[] = cluster.map((circle) => ({
        cx: circle.cx,
        cy: circle.cy,
        rOuter: circle.rOuter,
      }));

      const outlineGeom = generateOutlineGeom2(
        outlineCircles,
        structureParams.smoothingRadius,
        RENDER_CONFIG.cylinderSegments,
      );
      if (outlineGeom) {
        const extruded = extrudeLinear({ height }, outlineGeom);
        if (measureVolume(extruded) >= 0) return extruded;
      }

      const cols = cluster
        .map((circle) => slotDataMap.get(circle.id))
        .filter((item): item is (typeof slotData)[number] => Boolean(item))
        .map((d) => {
          const r = Math.max(d.actualW, d.actualH) / 2 + spacing;
          return translate(
            [d.cx, d.cy, 0],
            extrudeLinear(
              { height },
              circle({ radius: r, segments: RENDER_CONFIG.cylinderSegments }),
            ),
          );
        });

      return cols.length === 1 ? cols[0] : union(...cols);
    });

    return solids.length === 1 ? solids[0] : union(...solids);
  }

  const groupSolids: Geom3[] = [];

  for (const group of groups) {
    const ownSlotData = slotData.filter((d) => d.groupId === group.id);
    if (ownSlotData.length === 0) continue;

    const columnHeight = Math.max(group.bottomHeight, 3);
    const effectiveParams = getEffectiveGroupStructureParams(group, params);

    // 纳入所有高度严格更高的组的凹槽作为平滑轮廓上下文。
    // → 本组实体自然包围更高的柱子，形成平滑连接过渡。
    // → 同高度的不同组不纳入，保持各自独立，互不干扰。
    const contextSlotData = slotData.filter((d) => {
      if (d.groupId === group.id) return false;
      const otherGroup = groups.find((g) => g.id === d.groupId);
      return otherGroup && Math.max(otherGroup.bottomHeight, 3) > columnHeight;
    });

    let groupSolid = buildGroupSolid(
      [...ownSlotData, ...contextSlotData],
      columnHeight,
      effectiveParams,
    );

    // 减除所有高度严格低于本组的其他组凹槽的让位圆柱
    // 让位区间：从低组顶部(lowerHeight)到本组顶部(columnHeight)
    // 保证低组凹槽正上方不被本组连接桥侵占
    const clearances: Geom3[] = [];
    for (const otherGroup of groups) {
      const otherHeight = Math.max(otherGroup.bottomHeight, 3);
      if (otherHeight >= columnHeight) continue;

      for (const d of slotData.filter((sd) => sd.groupId === otherGroup.id)) {
        const clearanceR = Math.max(d.actualW, d.actualH) / 2;
        const clearanceH = columnHeight - otherHeight + 0.02;
        const cyl = extrudeLinear(
          { height: clearanceH },
          circle({
            radius: clearanceR,
            segments: RENDER_CONFIG.cylinderSegments,
          }),
        );
        clearances.push(translate([d.cx, d.cy, otherHeight], cyl));
      }
    }

    if (clearances.length > 0) {
      groupSolid = subtract(groupSolid, ...clearances);
    }

    groupSolids.push(groupSolid);
  }

  if (groupSolids.length === 0) {
    return extrudeLinear(
      { height: 0.1 },
      ellipse({ radius: [1, 1], segments: 4 }),
    );
  }

  const solid =
    groupSolids.length === 1 ? groupSolids[0] : union(...groupSolids);

  // 减去各凹槽孔洞（从各自分组顶部向下挖 holeDepth）
  const holes: Geom3[] = [];
  for (const d of slotData) {
    const clampedHoleDepth = Math.min(holeDepth, d.columnHeight);
    const holeShape = createOffsetSlotShape(
      d.profile.width,
      d.profile.height,
      d.slot.shape,
      d.profile.outerOffset,
    );
    const hole3D = extrudeLinear(
      { height: clampedHoleDepth + 0.02 },
      holeShape,
    );
    const rotatedHole = rotateZ(d.rotation * DEG_TO_RAD, hole3D);
    const holeZ = d.columnHeight - clampedHoleDepth;
    holes.push(translate([d.cx, d.cy, holeZ], rotatedHole));
  }

  return holes.length > 0 ? subtract(solid, ...holes) : solid;
}

/**
 * 计算阶梯底座托盘的边界尺寸
 */
export function calculateSteppedTrayDimensions(params: SteppedLayoutParams) {
  const effective = calculateEffectiveBaseplate(params);
  const maxHeight =
    params.groups.length > 0
      ? Math.max(...params.groups.map((g) => Math.max(g.bottomHeight, 3)))
      : 0;
  return {
    width: effective.hasSlots ? effective.width : params.trayWidth,
    depth: effective.hasSlots ? effective.depth : params.trayDepth,
    height: maxHeight,
  };
}
