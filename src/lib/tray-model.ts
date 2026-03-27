import { booleans, primitives, transforms } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { TrayParams } from "@/types/tray";
import { RENDER_CONFIG, getSlotTolerance } from "@/lib/config";
import { createBaseBody, subtractBaseHoles, type SlotCenter } from "@/lib/model-utils";

const { subtract } = booleans;
const { cylinder } = primitives;
const { translate } = transforms;

/**
 * 根据参数生成托盘 3D 模型（JSCAD geom3）
 *
 * 结构说明：
 * - 底板 + 墙壁一体，通过 2D 圆角矩形线性拉伸生成
 *   → 圆角只出现在竖直方向的 4 条边上
 * - 凹槽从顶部向下挖，深度 = holeDepth，到达底板顶面
 * - 总高度 = baseThickness + holeDepth
 * - 间距统一：边-凹槽 = 凹槽-凹槽 = spacing
 * - 凹槽实际直径 = holeDiameter + HOLE_TOLERANCE
 */
export function createTrayModel(params: TrayParams): Geom3 {
  const {
    rows,
    columns,
    holeDiameter,
    spacing,
    baseThickness,
    holeDepth,
    cornerRadius,
  } = params;

  // 实际凹槽直径（加公差）
  const actualHoleDiameter = holeDiameter + getSlotTolerance(holeDiameter);
  const holeRadius = actualHoleDiameter / 2;

  // 计算总尺寸：(N+1) 段间距 + N 个凹槽
  const totalWidth = (columns + 1) * spacing + columns * actualHoleDiameter;
  const totalDepth = (rows + 1) * spacing + rows * actualHoleDiameter;
  const totalHeight = baseThickness + holeDepth;

  // 1. 创建底板实体
  const body = createBaseBody(totalWidth, totalDepth, totalHeight, cornerRadius);

  // 2. 计算凹槽中心坐标
  const centers: SlotCenter[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      centers.push({
        cx: -totalWidth / 2 + spacing + holeRadius + col * (actualHoleDiameter + spacing),
        cy: -totalDepth / 2 + spacing + holeRadius + row * (actualHoleDiameter + spacing),
      });
    }
  }

  // 3. 凹槽阵列（从顶部向下挖）
  const holes: Geom3[] = centers.map(({ cx, cy }) =>
    translate(
      [cx, cy, baseThickness + holeDepth / 2],
      cylinder({
        radius: holeRadius,
        height: holeDepth + 0.02, // 略微超过以确保布尔运算干净
        segments: RENDER_CONFIG.cylinderSegments,
      }),
    ),
  );

  // 4. 布尔减法：实体 - 凹槽
  let tray = subtract(body, ...holes);

  // 5. 底板磁吸孔
  if (params.enableBaseHole) {
    tray = subtractBaseHoles(tray, centers, baseThickness, params.baseHoleSize);
  }

  return tray;
}

/**
 * 根据参数计算托盘的理论外观尺寸 (mm)
 */
export function calculateTrayDimensions(params: TrayParams) {
  const { rows, columns, holeDiameter, spacing, baseThickness, holeDepth } = params;
  const actualHoleDiameter = holeDiameter + getSlotTolerance(holeDiameter);
  return {
    width: (columns + 1) * spacing + columns * actualHoleDiameter,
    depth: (rows + 1) * spacing + rows * actualHoleDiameter,
    height: baseThickness + holeDepth,
  };
}
