import { booleans, primitives, transforms, extrusions } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { CustomLayoutParams } from "@/types/custom-tray";
import { RENDER_CONFIG, HOLE_TOLERANCE } from "@/lib/config";

const { subtract } = booleans;
const { roundedRectangle } = primitives;
const { cylinder } = primitives;
const { translate } = transforms;
const { extrudeLinear } = extrusions;

/**
 * 根据自定义参数生成托盘 3D 模型
 * 
 * 坐标系说明：
 * - JSCAD 原点 (0,0,0) 对应托盘底板中心
 * - 用户坐标 (x,y) 原点对应托盘左下角
 * - 转换公式：
 *   jscad_x = user_x - width/2
 *   jscad_y = user_y - depth/2
 */
export function createCustomTrayModel(params: CustomLayoutParams): Geom3 {
  const {
    trayWidth,
    trayDepth,
    slots,
    baseThickness,
    holeDepth,
    cornerRadius,
  } = params;

  const totalHeight = baseThickness + holeDepth;

  // 确保圆角不超过最小半尺寸
  const effectiveRadius = Math.min(
    cornerRadius,
    trayWidth / 2 - 0.01,
    trayDepth / 2 - 0.01
  );

  // 1. 创建底板轮廓 (XY平面，中心为 0,0)
  const profile = roundedRectangle({
    size: [trayWidth, trayDepth],
    roundRadius: Math.max(effectiveRadius, 0),
    segments: RENDER_CONFIG.cornerSegments,
  });

  // 2. 拉伸实体
  const body = extrudeLinear({ height: totalHeight }, profile);

  // 3. 生成凹槽
  const holes: Geom3[] = [];

  for (const slot of slots) {
    // 转换坐标到 JSCAD 中心坐标系
    const cx = slot.x - trayWidth / 2;
    const cy = slot.y - trayDepth / 2;
    
    // Z: 从 baseThickness 处开始向上
    const cz = baseThickness + holeDepth / 2;
    
    // 计算并生成圆柱体
    const actualDiameter = slot.diameter + HOLE_TOLERANCE;
    
    const hole = translate(
      [cx, cy, cz],
      cylinder({
        radius: actualDiameter / 2,
        height: holeDepth + 0.02,
        segments: RENDER_CONFIG.cylinderSegments,
      })
    );
    
    holes.push(hole);
  }

  // 4. 布尔运算
  if (holes.length === 0) {
    return body;
  }

  return subtract(body, ...holes);
}

/**
 * 计算自定义托盘的边界尺寸
 */
export function calculateCustomTrayDimensions(params: CustomLayoutParams) {
  return {
    width: params.trayWidth,
    depth: params.trayDepth,
    height: params.baseThickness + params.holeDepth,
  };
}
