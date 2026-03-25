import {
  booleans,
  primitives,
  transforms,
  extrusions,
  measurements,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { RENDER_CONFIG, getSlotTolerance } from "@/lib/config";
import {
  generateOutlineGeom2,
  type OutlineCircle,
} from "@/lib/outline-geometry";

const { subtract, union } = booleans;
const { translate, rotateZ } = transforms;
const { ellipse, circle } = primitives;
const { extrudeLinear } = extrusions;
const { measureVolume } = measurements;

const DEG_TO_RAD = Math.PI / 180;

function getSlotBoundingHalfSize(
  width: number,
  height: number,
  rotation: number,
) {
  const rad = (rotation * Math.PI) / 180;
  const a = (width + getSlotTolerance(width)) / 2;
  const b = (height + getSlotTolerance(height)) / 2;
  const halfW = Math.sqrt(
    Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2),
  );
  const halfH = Math.sqrt(
    Math.pow(a * Math.sin(rad), 2) + Math.pow(b * Math.cos(rad), 2),
  );
  return { halfW, halfH };
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
    const { halfW, halfH } = getSlotBoundingHalfSize(
      slot.width,
      slot.height,
      slot.rotation,
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
 * 根据阶梯底座参数生成托盘 3D 模型（按组独立实体 + 低组让位减除）
 *
 * 结构说明：
 * - 每个分组独立生成自己的实体（组内凹槽可连通，组间不共享轮廓）
 * - 每组实体高度 = group.bottomHeight，从 z=0 向上生长
 * - 高组实体在「低组顶部以上」的区间，减除低组每个凹槽的让位圆柱
 *   → 保证低组凹槽正上方的竖直空间不被高组连接桥侵占
 * - 所有组实体 union 后形成最终底座
 * - 每个凹槽从其所在组顶部向下挖 holeDepth 深度
 */
export function createSteppedTrayModel(params: SteppedLayoutParams): Geom3 {
  const { slots, groups, spacing, holeDepth, smoothingRadius } = params;

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
    const actualW = slot.width + getSlotTolerance(slot.width);
    const actualH = slot.height + getSlotTolerance(slot.height);
    const columnHeight = Math.max(group?.bottomHeight ?? 10, 3);
    return {
      slot,
      cx,
      cy,
      rotation,
      actualW,
      actualH,
      columnHeight,
      groupId: slot.groupId,
    };
  });

  // 辅助：生成一组凹槽的外扩实体（0 → height）
  function buildGroupSolid(
    groupSlotData: typeof slotData,
    height: number,
  ): Geom3 {
    const outlineCircles: OutlineCircle[] = groupSlotData.map((d) => ({
      cx: d.cx,
      cy: d.cy,
      rOuter: Math.max(d.actualW, d.actualH) / 2 + spacing,
    }));
    const outlineGeom = generateOutlineGeom2(
      outlineCircles,
      smoothingRadius,
      RENDER_CONFIG.cylinderSegments,
    );
    if (outlineGeom) {
      const extruded = extrudeLinear({ height }, outlineGeom);
      if (measureVolume(extruded) >= 0) return extruded;
    }
    // 降级：独立圆柱 union
    const cols = groupSlotData.map((d) => {
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
  }

  const groupSolids: Geom3[] = [];

  for (const group of groups) {
    const groupSlotData = slotData.filter((d) => d.groupId === group.id);
    if (groupSlotData.length === 0) continue;

    const columnHeight = Math.max(group.bottomHeight, 3);
    let groupSolid = buildGroupSolid(groupSlotData, columnHeight);

    // 减除所有高度严格低于本组的其他组凹槽的让位圆柱
    // 让位区间：从低组顶部(lowerHeight)到本组顶部(columnHeight)
    // 这样保证低组凹槽正上方不被本组的连接桥占据
    const clearances: Geom3[] = [];
    for (const otherGroup of groups) {
      const otherHeight = Math.max(otherGroup.bottomHeight, 3);
      if (otherHeight >= columnHeight) continue; // 仅处理高度严格更低的组

      const otherSlots = slotData.filter((d) => d.groupId === otherGroup.id);
      for (const d of otherSlots) {
        // 只预留凹槽本身的半径，不含 spacing（仅保证插模型时竖直空间）
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

  let solid = groupSolids.length === 1 ? groupSolids[0] : union(...groupSolids);

  // 减去各凹槽孔洞（从各自分组顶部向下挖 holeDepth）
  const holes: Geom3[] = [];
  for (const d of slotData) {
    const clampedHoleDepth = Math.min(holeDepth, d.columnHeight);
    const holeShape = ellipse({
      radius: [d.actualW / 2, d.actualH / 2],
      segments: RENDER_CONFIG.cylinderSegments,
    });
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
