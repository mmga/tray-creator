import { booleans, primitives, transforms } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { TrayParams } from "@/types/tray";
import {
  RENDER_CONFIG,
  resolveBaseHolePresetKey,
} from "@/lib/config";
import { getLegacyCircleSlotDiameter } from "@/lib/slot-definitions";
import {
  createBaseBody,
  subtractBaseHoles,
  type SlotCenter,
} from "@/lib/model-utils";

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
export function getGridSpacingAxes(params: TrayParams) {
  return {
    spacingX: params.spacingIndependent ? params.spacingX : params.spacing,
    spacingY: params.spacingIndependent ? params.spacingY : params.spacing,
  };
}

export function getGridBoundarySpacingAxes(params: TrayParams) {
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  return {
    boundarySpacingX: params.boundarySpacingIndependent
      ? params.boundarySpacing
      : spacingX,
    boundarySpacingY: params.boundarySpacingIndependent
      ? params.boundarySpacing
      : spacingY,
  };
}

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
    holeDiameter,
    baseThickness,
    holeDepth,
    cornerRadius,
    sideBevelWidth,
  } = params;

  // 实际凹槽直径（已内置公差）
  const actualHoleDiameter =
    typeof params.slotDiameter === "number" && Number.isFinite(params.slotDiameter)
      ? params.slotDiameter
      : getLegacyCircleSlotDiameter(holeDiameter);
  const holeRadius = actualHoleDiameter / 2;
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  const { boundarySpacingX, boundarySpacingY } =
    getGridBoundarySpacingAxes(params);
  const baseHoleSize = resolveBaseHolePresetKey(holeDiameter);

  // 计算总尺寸：2 * 边界间距 + (N-1) 段凹槽间距 + N 个凹槽
  const safeSideBevelWidth = Math.max(0, sideBevelWidth);
  const topWidth =
    2 * boundarySpacingX +
    (columns - 1) * spacingX +
    columns * actualHoleDiameter;
  const topDepth =
    2 * boundarySpacingY + (rows - 1) * spacingY + rows * actualHoleDiameter;
  const totalWidth = topWidth + safeSideBevelWidth * 2;
  const totalDepth = topDepth + safeSideBevelWidth * 2;
  const totalHeight = params.basePlateOnly ? baseThickness : baseThickness + holeDepth;
  const usesHalfCircleSlots =
    !params.basePlateOnly &&
    params.halfCircleSlots &&
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
          holeRadius +
          col * (actualHoleDiameter + spacingX),
        cy:
          -totalDepth / 2 +
          safeSideBevelWidth +
          boundarySpacingY +
          holeRadius +
          row * (actualHoleDiameter + spacingY),
        baseHoleSize,
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
      cylinder({
        radius: holeRadius,
        height: holeDepth + 0.02, // 略微超过以确保布尔运算干净
        segments: RENDER_CONFIG.cylinderSegments,
      }),
    ),
  );

  // 4. 布尔减法：实体 - 凹槽
  let tray = params.basePlateOnly ? body : subtract(body, ...holes);

  // 5. 底板磁吸孔
  if (params.enableBaseHole || params.basePlateOnly) {
    tray = subtractBaseHoles(tray, centers, baseThickness);
  }

  return tray;
}

/**
 * 根据参数计算托盘的理论外观尺寸 (mm)
 */
export function calculateTrayDimensions(params: TrayParams) {
  const {
    rows,
    columns,
    holeDiameter,
    baseThickness,
    holeDepth,
  } = params;
  const actualHoleDiameter =
    typeof params.slotDiameter === "number" && Number.isFinite(params.slotDiameter)
      ? params.slotDiameter
      : getLegacyCircleSlotDiameter(holeDiameter);
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  const { boundarySpacingX, boundarySpacingY } =
    getGridBoundarySpacingAxes(params);
  return {
    width:
      2 * boundarySpacingX +
      (columns - 1) * spacingX +
      columns * actualHoleDiameter +
      Math.max(0, params.sideBevelWidth) * 2,
    depth:
      2 * boundarySpacingY +
      (rows - 1) * spacingY +
      rows * actualHoleDiameter +
      Math.max(0, params.sideBevelWidth) * 2,
    height: params.basePlateOnly ? baseThickness : baseThickness + holeDepth,
  };
}
