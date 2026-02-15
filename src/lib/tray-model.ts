import { booleans, primitives, transforms, extrusions } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { TrayParams } from "@/types/tray";
import { RENDER_CONFIG, HOLE_TOLERANCE, BASE_HOLE_CONFIG } from "@/lib/config";

const { subtract } = booleans;
const { roundedRectangle } = primitives;
const { cylinder } = primitives;
const { translate } = transforms;
const { extrudeLinear } = extrusions;

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
  const actualHoleDiameter = holeDiameter + HOLE_TOLERANCE;
  const holeRadius = actualHoleDiameter / 2;

  // 计算总尺寸
  // 边-凹槽-凹槽-边 → (N+1) 段间距 + N 个凹槽
  const totalWidth = (columns + 1) * spacing + columns * actualHoleDiameter;
  const totalDepth = (rows + 1) * spacing + rows * actualHoleDiameter;
  const totalHeight = baseThickness + holeDepth;

  // 确保圆角不超过最小半尺寸
  const effectiveRadius = Math.min(
    cornerRadius,
    totalWidth / 2 - 0.01,
    totalDepth / 2 - 0.01
  );

  // 1. 创建 2D 圆角矩形（底面轮廓）
  const profile = roundedRectangle({
    size: [totalWidth, totalDepth],
    roundRadius: Math.max(effectiveRadius, 0),
    segments: RENDER_CONFIG.cornerSegments,
  });

  // 2. 线性拉伸为 3D 实体 → 圆角只在竖直方向的 4 条边上
  const body = extrudeLinear({ height: totalHeight }, profile);

  // 3. 凹槽阵列（从顶部向下挖）
  const holes: Geom3[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      // 凹槽中心坐标（相对于模型中心，XY 平面）
      const cx =
        -totalWidth / 2 +
        spacing +
        holeRadius +
        col * (actualHoleDiameter + spacing);
      const cy =
        -totalDepth / 2 +
        spacing +
        holeRadius +
        row * (actualHoleDiameter + spacing);
      // Z: 凹槽从 baseThickness 处开始向上（拉伸从 z=0 底部开始）
      const cz = baseThickness + holeDepth / 2;

      const hole = translate(
        [cx, cy, cz],
        cylinder({
          radius: holeRadius,
          height: holeDepth + 0.02, // 略微超过以确保布尔运算干净
          segments: RENDER_CONFIG.cylinderSegments,
        })
      );
      holes.push(hole);
    }
  }

  // 4. 布尔减法：实体 - 凹槽
  let tray = subtract(body, ...holes);

  // 5. 底板磁吸孔 — 固定尺寸盲孔，不穿透
  if (params.enableBaseHole) {
    const { presets, tolerance, topWall, minBottomWall } = BASE_HOLE_CONFIG;
    const { diameter, depth } = presets[params.baseHoleSize];
    const bottomWall = baseThickness - topWall - depth;

    if (bottomWall >= minBottomWall) {
      // 建模直径 = 基准直径 + 公差
      const bhRadius = (diameter + tolerance) / 2;
      // 孔中心 Z = 底板底面 + 底壁 + 孔深/2 = bottomWall + depth/2
      const holeCenterZ = bottomWall + depth / 2;
      const baseHoles: Geom3[] = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const cx =
            -totalWidth / 2 +
            spacing +
            holeRadius +
            col * (actualHoleDiameter + spacing);
          const cy =
            -totalDepth / 2 +
            spacing +
            holeRadius +
            row * (actualHoleDiameter + spacing);

          baseHoles.push(
            translate(
              [cx, cy, holeCenterZ],
              cylinder({
                radius: bhRadius,
                height: depth + 0.02,
                segments: RENDER_CONFIG.cylinderSegments,
              })
            )
          );
        }
      }

      tray = subtract(tray, ...baseHoles);
    }
  }

  return tray;
}

/**
 * 根据参数计算托盘的理论外观尺寸 (mm)
 */
export function calculateTrayDimensions(params: TrayParams) {
  const { rows, columns, holeDiameter, spacing, baseThickness, holeDepth } =
    params;
  const actualHoleDiameter = holeDiameter + HOLE_TOLERANCE;
  return {
    width: (columns + 1) * spacing + columns * actualHoleDiameter,
    depth: (rows + 1) * spacing + rows * actualHoleDiameter,
    height: baseThickness + holeDepth,
  };
}
