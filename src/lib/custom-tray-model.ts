import { booleans, primitives, transforms, extrusions } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { CustomLayoutParams } from "@/types/custom-tray";
import { RENDER_CONFIG, getSlotTolerance } from "@/lib/config";
import { createBaseBody, subtractBaseHoles, type SlotCenter } from "@/lib/model-utils";

const { subtract } = booleans;
const { translate, rotateZ } = transforms;
const { ellipse } = primitives;
const { extrudeLinear } = extrusions;

const DEG_TO_RAD = Math.PI / 180;

/**
 * 根据自定义参数生成托盘 3D 模型
 *
 * 坐标系说明：
 * - JSCAD 原点 (0,0,0) 对应托盘底板中心
 * - 用户坐标 (x,y) 原点对应托盘左下角
 * - 转换公式：jscad_x = user_x - width/2, jscad_y = user_y - depth/2
 */
export function createCustomTrayModel(params: CustomLayoutParams): Geom3 {
  const { trayWidth, trayDepth, slots, baseThickness, holeDepth, cornerRadius } = params;
  const totalHeight = baseThickness + holeDepth;

  // 1. 创建底板实体
  const body = createBaseBody(trayWidth, trayDepth, totalHeight, cornerRadius);

  // 2. 生成凹槽
  const holes: Geom3[] = [];
  const centers: SlotCenter[] = [];

  for (const slot of slots) {
    // 用户坐标 → JSCAD 中心坐标
    const cx = slot.x - trayWidth / 2;
    const cy = slot.y - trayDepth / 2;
    centers.push({ cx, cy });

    const width = slot.width;
    const height = slot.height;
    const rotation = slot.rotation || 0;

    const actualW = width + getSlotTolerance(width);
    const actualH = height + getSlotTolerance(height);

    // 2D 椭圆 → 拉伸 → 旋转 → 平移
    const holeShape2D = ellipse({
      radius: [actualW / 2, actualH / 2],
      segments: RENDER_CONFIG.cylinderSegments,
    });

    const hole3D = extrudeLinear({ height: holeDepth + 0.02 }, holeShape2D);
    const rotatedHole = rotateZ(rotation * DEG_TO_RAD, hole3D);
    const placedHole = translate([cx, cy, baseThickness], rotatedHole);

    holes.push(placedHole);
  }

  // 3. 布尔运算
  let tray = holes.length > 0 ? subtract(body, ...holes) : body;

  // 4. 底板磁吸孔
  if (params.enableBaseHole) {
    tray = subtractBaseHoles(tray, centers, baseThickness, params.baseHoleSize);
  }

  return tray;
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
