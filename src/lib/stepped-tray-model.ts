import { booleans, primitives, transforms, extrusions } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { RENDER_CONFIG, getSlotTolerance } from "@/lib/config";
import {
  createBaseBody,
  subtractBaseHoles,
  type SlotCenter,
} from "@/lib/model-utils";

const { subtract } = booleans;
const { translate, rotateZ } = transforms;
const { ellipse } = primitives;
const { extrudeLinear } = extrusions;

const DEG_TO_RAD = Math.PI / 180;

function getSlotBoundingHalfSize(
  width: number,
  height: number,
  rotation: number,
) {
  const rad = (rotation * Math.PI) / 180;
  const a = (width + getSlotTolerance(width)) / 2;
  const b = (height + getSlotTolerance(height)) / 2;
  const halfW = Math.sqrt(
    Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2),
  );
  const halfH = Math.sqrt(
    Math.pow(a * Math.sin(rad), 2) + Math.pow(b * Math.cos(rad), 2),
  );
  return { halfW, halfH };
}

function calculateEffectiveBaseplate(params: SteppedLayoutParams) {
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
    const { halfW, halfH } = getSlotBoundingHalfSize(
      slot.width,
      slot.height,
      slot.rotation,
    );
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  });

  return {
    hasSlots: true,
    width: Math.ceil(maxX - minX + boundarySpacing * 2),
    depth: Math.ceil(maxY - minY + boundarySpacing * 2),
    minX,
    maxX,
    minY,
    maxY,
  };
}

/**
 * 根据阶梯底座参数生成托盘 3D 模型
 *
 * 结构说明：
 * - 每个凹槽由「墙」和「底部平台」两部分组成
 * - 墙：从托盘顶面向下挖掘，深度 = wallHeight
 * - 底部平台：凹槽轮廓外扩 bottomExpandMargin 后的区域，
 *   从墙底部继续向下挖掘，深度 = bottomHeight
 * - 托盘总高度 = baseThickness + max(wallHeight + bottomHeight)
 */
export function createSteppedTrayModel(params: SteppedLayoutParams): Geom3 {
  const { slots, baseThickness, cornerRadius, bottomExpandMargin } = params;
  const effective = calculateEffectiveBaseplate(params);
  const trayWidth = effective.hasSlots ? effective.width : params.trayWidth;
  const trayDepth = effective.hasSlots ? effective.depth : params.trayDepth;

  // 计算托盘总高度：底板厚度 + 最大的 (wallHeight + bottomHeight)
  const maxSlotDepth =
    slots.length > 0
      ? Math.max(...slots.map((s) => s.wallHeight + s.bottomHeight))
      : 0;
  const totalHeight = baseThickness + maxSlotDepth;

  const sourceCenterX = effective.hasSlots
    ? (effective.minX + effective.maxX) / 2
    : trayWidth / 2;
  const sourceCenterY = effective.hasSlots
    ? (effective.minY + effective.maxY) / 2
    : trayDepth / 2;

  // 1. 创建底板实体
  const body = createBaseBody(trayWidth, trayDepth, totalHeight, cornerRadius);

  // 2. 生成凹槽墙体（从顶面向下挖 wallHeight）和底部平台
  const wallHoles: Geom3[] = [];
  const platformHoles: Geom3[] = [];
  const centers: SlotCenter[] = [];

  for (const slot of slots) {
    const normalizedX = slot.x - sourceCenterX + trayWidth / 2;
    const normalizedY = slot.y - sourceCenterY + trayDepth / 2;

    const cx = normalizedX - trayWidth / 2;
    const cy = normalizedY - trayDepth / 2;
    centers.push({ cx, cy });

    const rotation = slot.rotation || 0;
    const actualW = slot.width + getSlotTolerance(slot.width);
    const actualH = slot.height + getSlotTolerance(slot.height);

    // 墙体：从顶面向下挖 wallHeight
    const wallShape2D = ellipse({
      radius: [actualW / 2, actualH / 2],
      segments: RENDER_CONFIG.cylinderSegments,
    });
    const wall3D = extrudeLinear(
      { height: slot.wallHeight + 0.02 },
      wallShape2D,
    );
    const rotatedWall = rotateZ(rotation * DEG_TO_RAD, wall3D);
    const wallZ = totalHeight - slot.wallHeight;
    const placedWall = translate([cx, cy, wallZ], rotatedWall);
    wallHoles.push(placedWall);

    // 底部平台：外扩后从墙底部继续向下挖 bottomHeight
    const expandedW = actualW + bottomExpandMargin * 2;
    const expandedH = actualH + bottomExpandMargin * 2;
    const platformShape2D = ellipse({
      radius: [expandedW / 2, expandedH / 2],
      segments: RENDER_CONFIG.cylinderSegments,
    });
    const platform3D = extrudeLinear(
      { height: slot.bottomHeight + 0.02 },
      platformShape2D,
    );
    const rotatedPlatform = rotateZ(rotation * DEG_TO_RAD, platform3D);
    const platformZ = totalHeight - slot.wallHeight - slot.bottomHeight;
    const placedPlatform = translate([cx, cy, platformZ], rotatedPlatform);
    platformHoles.push(placedPlatform);
  }

  // 3. 布尔运算
  const allHoles = [...wallHoles, ...platformHoles];
  let tray = allHoles.length > 0 ? subtract(body, ...allHoles) : body;

  // 4. 底板磁吸孔
  if (params.enableBaseHole) {
    tray = subtractBaseHoles(tray, centers, baseThickness, params.baseHoleSize);
  }

  return tray;
}

/**
 * 计算阶梯底座托盘的边界尺寸
 */
export function calculateSteppedTrayDimensions(params: SteppedLayoutParams) {
  const effective = calculateEffectiveBaseplate(params);
  const maxSlotDepth =
    params.slots.length > 0
      ? Math.max(...params.slots.map((s) => s.wallHeight + s.bottomHeight))
      : 0;
  return {
    width: effective.hasSlots ? effective.width : params.trayWidth,
    depth: effective.hasSlots ? effective.depth : params.trayDepth,
    height: params.baseThickness + maxSlotDepth,
  };
}
