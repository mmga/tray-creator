import { booleans, primitives, transforms } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { TrayParams } from "@/types/tray";
import { RENDER_CONFIG } from "@/lib/config";
import {
  getGridSlotGeometry,
  isRectangularGridSlot,
} from "@/lib/grid-config";
import {
  createBaseBody,
  subtractBaseHoleConstructionPlan,
  type SlotCenter,
} from "@/lib/model-utils";
import { createGridBaseHoleConstructionPlan } from "@/lib/base-hole-planning";
import {
  getGridBoundarySpacingAxes,
  getGridSlotPitchAxes,
} from "@/lib/grid-layout-math";

export {
  getGridBoundarySpacingAxes,
  getGridSlotPitchAxes,
  getGridSpacingAxes,
} from "@/lib/grid-layout-math";

const { intersect, subtract, union } = booleans;
const { cuboid, cylinder } = primitives;
const { translate } = transforms;

/**
 * 根据参数生成托盘 3D 模型（JSCAD geom3）
 *
 * 结构说明：
 * - 底板 + 墙壁一体，通过 2D 圆角矩形线性拉伸生成
 *   → 圆角只出现在竖直方向的 4 条边上
 * - 凹槽从顶部向下挖，深度 = holeDepth，到达底板顶面
 * - 总高度 = baseThickness + holeDepth，仅底板模式下为 baseThickness
 * - 间距支持统一 / X-Y 独立：边-凹槽与凹槽-凹槽分别按轴计算
 * - 凹槽实际直径 = slotDiameter 快照；旧参数缺失时按兼容规则补齐
 */
function createHalfCircleTrayBody(
  width: number,
  depth: number,
  baseThickness: number,
  holeDepth: number,
  cornerRadius: number,
  sideBevelWidth: number,
  splitAxis: "x" | "y",
) {
  const totalHeight = baseThickness + holeDepth;
  const safeSideBevelWidth = Math.max(
    0,
    Math.min(sideBevelWidth, width / 2 - 0.1, depth / 2 - 0.1),
  );
  const baseBevelWidth = safeSideBevelWidth * (baseThickness / totalHeight);
  const upperBevelWidth = safeSideBevelWidth - baseBevelWidth;
  const upperWidth = width - baseBevelWidth * 2;
  const upperDepth = depth - baseBevelWidth * 2;
  const upperCornerRadius = Math.max(cornerRadius - baseBevelWidth, 0);
  const base = createBaseBody(
    width,
    depth,
    baseThickness,
    cornerRadius,
    baseBevelWidth,
  );
  const upper = translate(
    [0, 0, baseThickness],
    createBaseBody(
      upperWidth,
      upperDepth,
      holeDepth,
      upperCornerRadius,
      upperBevelWidth,
    ),
  );
  const clipCenter: [number, number, number] =
    splitAxis === "y"
      ? [0, -depth / 4, baseThickness + holeDepth / 2]
      : [-width / 4, 0, baseThickness + holeDepth / 2];
  const clipSize: [number, number, number] =
    splitAxis === "y"
      ? [width + 1, depth / 2, holeDepth + 0.1]
      : [width / 2, depth + 1, holeDepth + 0.1];
  const farSideUpper = intersect(
    upper,
    cuboid({
      center: clipCenter,
      size: clipSize,
    }),
  );

  return union(base, farSideUpper);
}

export function createTrayModel(params: TrayParams): Geom3 {
  const {
    rows,
    columns,
    baseThickness,
    holeDepth,
    cornerRadius,
    sideBevelWidth,
  } = params;

  const slot = getGridSlotGeometry(params);
  const { pitchX, pitchY } = getGridSlotPitchAxes(params);
  const { boundarySpacingX, boundarySpacingY } =
    getGridBoundarySpacingAxes(params);

  // 总尺寸由首尾槽位外沿与槽位中心距决定；矩形槽的中心距按底盘标称尺寸计算。
  const safeSideBevelWidth = Math.max(0, sideBevelWidth);
  const topWidth =
    2 * boundarySpacingX +
    slot.slotWidth +
    (columns - 1) * pitchX;
  const topDepth =
    2 * boundarySpacingY + slot.slotHeight + (rows - 1) * pitchY;
  const totalWidth = topWidth + safeSideBevelWidth * 2;
  const totalDepth = topDepth + safeSideBevelWidth * 2;
  const totalHeight = params.basePlateOnly ? baseThickness : baseThickness + holeDepth;
  const usesHalfCircleSlots =
    !params.basePlateOnly &&
    params.halfCircleSlots &&
    !isRectangularGridSlot(params) &&
    (rows === 1 || columns === 1);
  const halfCircleSplitAxis = rows === 1 ? "y" : "x";

  // 1. 创建底板实体
  const body = params.basePlateOnly
    ? createBaseBody(
        totalWidth,
        totalDepth,
        baseThickness,
        cornerRadius,
        sideBevelWidth,
      )
    : usesHalfCircleSlots
    ? createHalfCircleTrayBody(
        totalWidth,
        totalDepth,
        baseThickness,
        holeDepth,
        cornerRadius,
        sideBevelWidth,
        halfCircleSplitAxis,
      )
    : createBaseBody(
        totalWidth,
        totalDepth,
        totalHeight,
        cornerRadius,
        sideBevelWidth,
      );

  // 2. 计算凹槽中心坐标
  const centers: SlotCenter[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      centers.push({
        cx:
          -totalWidth / 2 +
          safeSideBevelWidth +
          boundarySpacingX +
          slot.slotWidth / 2 +
          col * pitchX,
        cy:
          -totalDepth / 2 +
          safeSideBevelWidth +
          boundarySpacingY +
          slot.slotHeight / 2 +
          row * pitchY,
      });
    }
  }

  // 3. 凹槽阵列（从顶部向下挖）
  const holes: Geom3[] = centers.map(({ cx, cy }) =>
    translate(
      [
        cx,
        cy,
        baseThickness + holeDepth / 2 + (usesHalfCircleSlots ? 0.01 : 0),
      ],
      slot.shape === "circle"
        ? cylinder({
            radius: slot.slotWidth / 2,
            height: holeDepth + 0.02,
            segments: RENDER_CONFIG.cylinderSegments,
          })
        : cuboid({
            size: [slot.slotWidth, slot.slotHeight, holeDepth + 0.02],
          }),
    ),
  );

  // 4. 布尔减法：实体 - 凹槽
  let tray = params.basePlateOnly ? body : subtract(body, ...holes);

  // 5. 执行权威底板孔位计划；Adapter 坐标原点位于底板左下角。
  tray = subtractBaseHoleConstructionPlan(
    tray,
    createGridBaseHoleConstructionPlan(params),
    (x, y) => [x - totalWidth / 2, y - totalDepth / 2],
  );

  return tray;
}

/**
 * 根据参数计算托盘的理论外观尺寸 (mm)
 */
export function calculateTrayDimensions(params: TrayParams) {
  const {
    rows,
    columns,
    baseThickness,
    holeDepth,
  } = params;
  const slot = getGridSlotGeometry(params);
  const { pitchX, pitchY } = getGridSlotPitchAxes(params);
  const { boundarySpacingX, boundarySpacingY } =
    getGridBoundarySpacingAxes(params);
  return {
    width:
      2 * boundarySpacingX +
      slot.slotWidth +
      (columns - 1) * pitchX +
      Math.max(0, params.sideBevelWidth) * 2,
    depth:
      2 * boundarySpacingY +
      slot.slotHeight +
      (rows - 1) * pitchY +
      Math.max(0, params.sideBevelWidth) * 2,
    height: params.basePlateOnly ? baseThickness : baseThickness + holeDepth,
  };
}
