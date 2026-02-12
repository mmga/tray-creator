import { booleans, primitives, transforms } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { TrayParams } from "@/types/tray";
import { RENDER_CONFIG } from "@/lib/config";

const { subtract, union } = booleans;
const { roundedCuboid, cylinder } = primitives;
const { translate } = transforms;

/**
 * 根据参数生成托盘 3D 模型（JSCAD geom3）
 */
export function createTrayModel(params: TrayParams): Geom3 {
  const {
    rows,
    columns,
    holeDiameter,
    spacing,
    wallWidth,
    wallHeight,
    baseThickness,
    holeDepth,
    cornerRadius,
  } = params;

  const holeRadius = holeDiameter / 2;

  // 计算内部区域尺寸（所有凹槽+间距占据的区域）
  const innerWidth = columns * holeDiameter + (columns - 1) * spacing;
  const innerDepth = rows * holeDiameter + (rows - 1) * spacing;

  // 总体尺寸 = 内部区域 + 两侧边框
  const totalWidth = innerWidth + 2 * wallWidth;
  const totalDepth = innerDepth + 2 * wallWidth;
  const totalHeight = baseThickness + wallHeight;

  // 确保圆角不超过最小半尺寸
  const effectiveRadius = Math.min(
    cornerRadius,
    totalWidth / 2 - 0.01,
    totalDepth / 2 - 0.01,
    totalHeight / 2 - 0.01
  );

  // 1. 外壳：圆角长方体
  const outerShell = roundedCuboid({
    size: [totalWidth, totalDepth, totalHeight],
    roundRadius: Math.max(effectiveRadius, 0.01),
    segments: RENDER_CONFIG.cylinderSegments,
  });

  // 2. 内腔：掏空上方以形成边框围墙
  //    内腔从底板顶部开始到顶部，且比外壳小 wallWidth
  const cavityWidth = innerWidth;
  const cavityDepth = innerDepth;
  const cavityHeight = wallHeight + 0.01; // 略微超过，确保布尔运算干净

  const innerCavity = translate(
    [0, 0, baseThickness / 2 + 0.005],
    roundedCuboid({
      size: [cavityWidth, cavityDepth, cavityHeight],
      roundRadius: Math.max(Math.min(effectiveRadius - wallWidth, cavityWidth / 2 - 0.01, cavityDepth / 2 - 0.01), 0.01),
      segments: RENDER_CONFIG.cylinderSegments,
    })
  );

  // 3. 凹槽阵列
  const holes: Geom3[] = [];
  const effectiveHoleDepth = Math.min(holeDepth, baseThickness);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      // 凹槽中心坐标（相对于托盘中心）
      const cx =
        -innerWidth / 2 + holeRadius + col * (holeDiameter + spacing);
      const cy =
        -innerDepth / 2 + holeRadius + row * (holeDiameter + spacing);
      // 凹槽从底板底部向上挖
      const cz = -totalHeight / 2 + effectiveHoleDepth / 2 - 0.005;

      const hole = translate(
        [cx, cy, cz],
        cylinder({
          radius: holeRadius,
          height: effectiveHoleDepth + 0.01,
          segments: RENDER_CONFIG.cylinderSegments,
        })
      );
      holes.push(hole);
    }
  }

  // 4. 布尔运算：外壳 - 内腔 - 凹槽
  const tray = subtract(outerShell, innerCavity, ...holes);

  return tray;
}

/**
 * 根据参数计算托盘的理论外观尺寸 (mm)
 */
export function calculateTrayDimensions(params: TrayParams) {
  const { rows, columns, holeDiameter, spacing, wallWidth, wallHeight, baseThickness } = params;
  const innerWidth = columns * holeDiameter + (columns - 1) * spacing;
  const innerDepth = rows * holeDiameter + (rows - 1) * spacing;
  return {
    width: innerWidth + 2 * wallWidth,
    depth: innerDepth + 2 * wallWidth,
    height: baseThickness + wallHeight,
  };
}
