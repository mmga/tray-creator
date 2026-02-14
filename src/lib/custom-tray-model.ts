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
  const { ellipse } = primitives;
  const { rotateZ } = transforms;
  const degToRad = (d: number) => d * (Math.PI / 180);

  for (const slot of slots) {
    // 转换坐标到 JSCAD 中心坐标系
    const cx = slot.x - trayWidth / 2;
    const cy = slot.y - trayDepth / 2;
    
    // Z: 这种拉伸是从底部 (0) 开始还是中心? 
    // extrudeLinear default is from 0 to height in Z. 
    // We need the bottom of the hole to be at `baseThickness`.
    // So translate Z to `baseThickness`.
    const holeZ = baseThickness; 

    const width = slot.width || slot.diameter || 0;
    const height = slot.height || slot.diameter || 0;
    const rotation = slot.rotation || 0;
    
    const actualW = width + HOLE_TOLERANCE;
    const actualH = height + HOLE_TOLERANCE;

    // Create base shape
    // Note: We use ellipse for both circle and ellipse to simplify logic, 
    // or use cylinder for circles if faster (but ellipse extruded is fine).
    // segments calculation: for ellipse, maybe use higher.
    const holeShape2D = ellipse({
      radius: [actualW / 2, actualH / 2],
      segments: RENDER_CONFIG.cylinderSegments,
    });

    // Extrude
    const hole3D = extrudeLinear({ height: holeDepth + 0.02 }, holeShape2D);

    // Rotate (around Z axis, at origin 0,0,0 of the shape which is its center)
    const rotatedHole = rotateZ(degToRad(rotation), hole3D);

    // Translate to position
    // Note: extrudeLinear creates shape from Z=0 to Z=height.
    // We want it to start at baseThickness.
    const placedHole = translate(
      [cx, cy, holeZ],
      rotatedHole
    );
    
    holes.push(placedHole);
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
