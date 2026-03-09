import { booleans, primitives, transforms, extrusions } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { RENDER_CONFIG, getSlotTolerance } from "@/lib/config";
import {
  createBaseBody,
  subtractBaseHoles,
  type SlotCenter,
} from "@/lib/model-utils";

const { subtract, union } = booleans;
const { translate, rotateZ } = transforms;
const { ellipse } = primitives;
const { extrudeLinear } = extrusions;

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
  const boundarySpacing = params.boundarySpacingIndependent
    ? params.boundarySpacing
    : params.spacing;

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
 * 根据阶梯底座参数生成托盘 3D 模型
 *
 * 结构说明（从底部向上增长）：
 * - 底板：全宽底板，高度 = baseThickness
 * - 柱子：每个凹槽对应一个外扩柱子，从底板底部向上生长，高度 = baseThickness + slot.bottomHeight
 * - 凹槽：全局固定深度 holeDepth，从柱顶向下挖
 */
export function createSteppedTrayModel(params: SteppedLayoutParams): Geom3 {
  const { slots, baseThickness, cornerRadius, spacing, holeDepth } = params;
  const effective = calculateEffectiveBaseplate(params);
  const trayWidth = effective.hasSlots ? effective.width : params.trayWidth;
  const trayDepth = effective.hasSlots ? effective.depth : params.trayDepth;

  const sourceCenterX = effective.hasSlots
    ? (effective.minX + effective.maxX) / 2
    : trayWidth / 2;
  const sourceCenterY = effective.hasSlots
    ? (effective.minY + effective.maxY) / 2
    : trayDepth / 2;

  // 1. 底板实体
  const basePlate = createBaseBody(
    trayWidth,
    trayDepth,
    baseThickness,
    cornerRadius,
  );

  const columns: Geom3[] = [];
  const holes: Geom3[] = [];
  const centers: SlotCenter[] = [];

  for (const slot of slots) {
    const normalizedX = slot.x - sourceCenterX + trayWidth / 2;
    const normalizedY = slot.y - sourceCenterY + trayDepth / 2;
    const cx = normalizedX - trayWidth / 2;
    const cy = normalizedY - trayDepth / 2;
    centers.push({ cx, cy });

    const rotation = slot.rotation || 0;
    const actualW = slot.width + getSlotTolerance(slot.width);
    const actualH = slot.height + getSlotTolerance(slot.height);
    const columnHeight = baseThickness + slot.bottomHeight;

    // 2. 柱子：外扩形状，从 z=0 生长到 z=baseThickness+slot.bottomHeight
    // 当 bottomHeight=0 时跳过柱子（凹槽直接在底板上挖）
    if (slot.bottomHeight > 0) {
      const expandedW = actualW + spacing;
      const expandedH = actualH + spacing;
      const columnShape = ellipse({
        radius: [expandedW / 2, expandedH / 2],
        segments: RENDER_CONFIG.cylinderSegments,
      });
      const column3D = extrudeLinear({ height: columnHeight }, columnShape);
      const rotatedColumn = rotateZ(rotation * DEG_TO_RAD, column3D);
      columns.push(translate([cx, cy, 0], rotatedColumn));
    }

    // 3. 凹槽孔：实际尺寸，从柱顶向下挖 holeDepth
    const clampedHoleDepth =
      slot.bottomHeight > 0
        ? Math.min(holeDepth, slot.bottomHeight)
        : Math.min(holeDepth, baseThickness);
    const holeShape = ellipse({
      radius: [actualW / 2, actualH / 2],
      segments: RENDER_CONFIG.cylinderSegments,
    });
    const hole3D = extrudeLinear(
      { height: clampedHoleDepth + 0.02 },
      holeShape,
    );
    const rotatedHole = rotateZ(rotation * DEG_TO_RAD, hole3D);
    const holeZ = columnHeight - clampedHoleDepth;
    holes.push(translate([cx, cy, holeZ], rotatedHole));
  }

  // 4. 底板 union 所有柱子
  let solid: Geom3 =
    columns.length > 0 ? union(basePlate, ...columns) : basePlate;

  // 5. 减去凹槽
  let tray = holes.length > 0 ? subtract(solid, ...holes) : solid;

  // 6. 底板磁吸孔
  if (params.enableBaseHole) {
    tray = subtractBaseHoles(tray, centers, baseThickness, params.baseHoleSize);
  }

  return tray;
}

/**
 * 计算阶梯底座托盘的边界尺寸
 */
export function calculateSteppedTrayDimensions(params: SteppedLayoutParams) {
  const effective = calculateEffectiveBaseplate(params);
  const maxRise =
    params.slots.length > 0
      ? Math.max(...params.slots.map((s) => s.bottomHeight))
      : 0;
  return {
    width: effective.hasSlots ? effective.width : params.trayWidth,
    depth: effective.hasSlots ? effective.depth : params.trayDepth,
    height: params.baseThickness + maxRise,
  };
}
