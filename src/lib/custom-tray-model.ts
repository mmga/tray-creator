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
import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import { roundLayoutDimensionToTenth } from "@/lib/custom-layout-math";
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
    const profile = getFreeSlotProfileGeometry(slot);
    const { halfW, halfH } = getEllipseBoundingBox(
      profile.width,
      profile.height,
      slot.rotation,
      slot.shape,
      profile.profileExponent,
      profile.outerOffset,
    );
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  });

  return {
    hasSlots: true,
    width: roundLayoutDimensionToTenth(maxX - minX + boundarySpacing * 2),
    depth: roundLayoutDimensionToTenth(maxY - minY + boundarySpacing * 2),
    minX,
    maxX,
    minY,
    maxY,
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
  const { slots, baseThickness, holeDepth, cornerRadius } = params;
  const effective = calculateCustomEffectiveBaseplate(params);
  const trayWidth = effective.hasSlots ? effective.width : params.trayWidth;
  const trayDepth = effective.hasSlots ? effective.depth : params.trayDepth;
  const totalHeight = baseThickness + holeDepth;
  const sourceCenterX = effective.hasSlots
    ? (effective.minX + effective.maxX) / 2
    : trayWidth / 2;
  const sourceCenterY = effective.hasSlots
    ? (effective.minY + effective.maxY) / 2
    : trayDepth / 2;

  // 1. 创建底板实体
  const body = createBaseBody(trayWidth, trayDepth, totalHeight, cornerRadius);

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
  if (params.enableBaseHole) {
    tray = subtractBaseHoles(tray, centers, baseThickness);
  }

  return tray;
}

/**
 * 计算自定义托盘的边界尺寸
 */
export function calculateCustomTrayDimensions(params: CustomLayoutParams) {
  const effective = calculateCustomEffectiveBaseplate(params);
  return {
    width: effective.hasSlots ? effective.width : params.trayWidth,
    depth: effective.hasSlots ? effective.depth : params.trayDepth,
    height: params.baseThickness + params.holeDepth,
  };
}
