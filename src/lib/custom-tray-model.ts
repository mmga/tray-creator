import {
  booleans,
  transforms,
  extrusions,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { CustomLayoutParams } from "@/types/custom-tray";
import {
  resolveBaseHolePresetKey,
} from "@/lib/config";
import {
  calculateCustomEffectiveDimensions,
  calculateCustomTrayFootprint,
  roundLayoutDimensionToTenth,
} from "@/lib/custom-layout-math";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import {
  createBaseBody,
  createOffsetSlotShape,
  subtractBaseHoles,
  type SlotCenter,
} from "@/lib/model-utils";

const { subtract } = booleans;
const { translate, rotateZ } = transforms;
const { extrudeLinear } = extrusions;

const DEG_TO_RAD = Math.PI / 180;

export function calculateCustomEffectiveBaseplate(params: CustomLayoutParams) {
  const effective = calculateCustomEffectiveDimensions(params);
  const sideBevelWidth = Math.max(0, params.sideBevelWidth);

  if (!effective.width || !effective.depth) {
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

  return {
    hasSlots: true,
    width: roundLayoutDimensionToTenth(
      effective.width + sideBevelWidth * 2,
    ),
    depth: roundLayoutDimensionToTenth(
      effective.depth + sideBevelWidth * 2,
    ),
    minX: effective.minX,
    maxX: effective.maxX,
    minY: effective.minY,
    maxY: effective.maxY,
  };
}

/**
 * 根据自定义参数生成托盘 3D 模型
 *
 * 坐标系说明：
 * - JSCAD 原点 (0,0,0) 对应托盘底板中心
 * - 用户坐标 (x,y) 原点对应托盘左下角
 * - 转换公式：jscad_x = user_x - width/2, jscad_y = user_y - depth/2
 */
export function createCustomTrayModel(params: CustomLayoutParams): Geom3 {
  const { slots, baseThickness, holeDepth, cornerRadius, sideBevelWidth } = params;
  const footprint = calculateCustomTrayFootprint(params);
  const trayWidth = footprint.width;
  const trayDepth = footprint.depth;
  const totalHeight = baseThickness + holeDepth;
  const sourceCenterX = footprint.sizingMode === "auto" && footprint.hasSlots
    ? (footprint.minX + footprint.maxX) / 2
    : trayWidth / 2;
  const sourceCenterY = footprint.sizingMode === "auto" && footprint.hasSlots
    ? (footprint.minY + footprint.maxY) / 2
    : trayDepth / 2;

  // 1. 创建底板实体
  const body = createBaseBody(
    trayWidth,
    trayDepth,
    totalHeight,
    cornerRadius,
    sideBevelWidth,
  );

  // 2. 生成凹槽
  const holes: Geom3[] = [];
  const centers: SlotCenter[] = [];

  for (const slot of slots) {
    const normalizedX = slot.x - sourceCenterX + trayWidth / 2;
    const normalizedY = slot.y - sourceCenterY + trayDepth / 2;

    // 用户坐标 → JSCAD 中心坐标
    const cx = normalizedX - trayWidth / 2;
    const cy = normalizedY - trayDepth / 2;

    const profile = getFreeSlotProfileGeometry(slot);
    const width = profile.width;
    const height = profile.height;
    const rotation = slot.rotation || 0;
    centers.push({
      cx,
      cy,
      baseHoleSize: resolveBaseHolePresetKey(Math.max(width, height)),
    });

    // 2D 椭圆 → 等距外扩 → 拉伸 → 旋转 → 平移
    const holeShape2D = createOffsetSlotShape(
      width,
      height,
      slot.shape,
      profile.outerOffset,
      profile.profileExponent,
    );

    const hole3D = extrudeLinear({ height: holeDepth + 0.02 }, holeShape2D);
    const rotatedHole = rotateZ(rotation * DEG_TO_RAD, hole3D);
    const placedHole = translate([cx, cy, baseThickness], rotatedHole);

    holes.push(placedHole);
  }

  // 3. 布尔运算
  let tray = holes.length > 0 ? subtract(body, ...holes) : body;

  // 4. 底板磁吸孔
  if (params.baseHoleStructure === "magnetic-base-hole") {
    tray = subtractBaseHoles(tray, centers, baseThickness);
  }

  return tray;
}

/**
 * 计算自定义托盘的边界尺寸
 */
export function calculateCustomTrayDimensions(params: CustomLayoutParams) {
  const footprint = calculateCustomTrayFootprint(params);
  return {
    width: footprint.width,
    depth: footprint.depth,
    height: params.baseThickness + params.holeDepth,
  };
}
