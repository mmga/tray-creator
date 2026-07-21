import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import { RENDER_CONFIG } from "@/lib/config";
import {
  deriveContouredFootprint,
  type ContouredFootprintSlot,
} from "@/lib/contoured-footprint";
import type { BaseplateFootprintStyle, CustomLayoutParams, FreeSlot } from "@/types/custom-tray";

export type CustomTraySizingMode = "auto" | "fixed";

export interface LayoutExtents {
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CustomTrayFootprint {
  sizingMode: CustomTraySizingMode;
  footprintStyle: BaseplateFootprintStyle;
  hasSlots: boolean;
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** contoured footprint 产生的独立可打印实体数；rectangular 始终为 1（或 0 当无槽）。 */
  contourBodyCount: number;
}

export interface FixedCustomTrayUsableArea {
  x: number;
  y: number;
  width: number;
  depth: number;
  cornerRadius: number;
}

export function roundLayoutDimensionToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function resolveCustomBoundarySpacing(
  params: CustomLayoutParams,
): number {
  if (params.boundarySpacingIndependent) {
    return params.boundarySpacing;
  }

  return params.spacing;
}

export function resolveCustomTraySizingMode(
  params: Pick<CustomLayoutParams, "traySizingMode">,
): CustomTraySizingMode {
  return params.traySizingMode === "fixed" ? "fixed" : "auto";
}

/**
 * 解析自定义模式的底座轮廓样式；缺失时默认 rectangular 以兼容旧配置（CONTEXT:591）。
 */
export function resolveCustomFootprintStyle(
  params: Pick<CustomLayoutParams, "footprintStyle">,
): BaseplateFootprintStyle {
  return params.footprintStyle === "contoured" ? "contoured" : "rectangular";
}

/**
 * 把自定义模式 FreeSlot 投影为 Contoured Footprint Construction 所需的通用槽位结构。
 * custom 与 stepped 通过各自的投影函数把自己的 Slot Instance 适配到同一形状。
 */
export function projectCustomSlotToContoured(
  slot: FreeSlot,
): ContouredFootprintSlot {
  const profile = getFreeSlotProfileGeometry(slot);
  return {
    id: slot.id,
    cx: slot.x,
    cy: slot.y,
    rotation: slot.rotation || 0,
    shape: slot.shape,
    profile,
  };
}

/**
 * Contoured footprint 的休眠默认 smoothingRadius。
 * custom 在 contoured 下不暴露 smoothing/disconnect，统一使用固定默认值；
 * 0 disconnectDistance 表示按 smoothingRadius 自然桥接（CONTEXT:627）。
 */
const CUSTOM_CONTOURED_DEFAULT_SMOOTHING_RADIUS = 60;
const CUSTOM_CONTOURED_DEFAULT_DISCONNECT_DISTANCE = 0;

/**
 * 为自定义模式派生 contoured footprint：返回 2D bodies 与外接矩形尺寸。
 * 仅在 footprintStyle === "contoured" 时被调用。
 */
export function calculateCustomContouredFootprint(
  params: CustomLayoutParams,
): { bodies: ReturnType<typeof deriveContouredFootprint>["bodies"]; bodyCount: number; minX: number; maxX: number; minY: number; maxY: number } {
  if (params.slots.length === 0) {
    return {
      bodies: [],
      bodyCount: 0,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  const boundarySpacing = resolveCustomBoundarySpacing(params);
  const contouredSlots = params.slots.map(projectCustomSlotToContoured);
  const result = deriveContouredFootprint(
    contouredSlots,
    boundarySpacing,
    CUSTOM_CONTOURED_DEFAULT_SMOOTHING_RADIUS,
    CUSTOM_CONTOURED_DEFAULT_DISCONNECT_DISTANCE,
  );

  // 用槽位（含 boundary spacing 外扩）的外接矩形作为 contoured 尺寸来源。
  // contoured 无 side bevel，无 fixed sizing，footprint 外接框即整件外尺寸。
  const effective = calculateCustomEffectiveDimensions(params);
  return {
    bodies: result.bodies,
    bodyCount: result.bodyCount,
    minX: effective.minX - boundarySpacing,
    maxX: effective.maxX + boundarySpacing,
    minY: effective.minY - boundarySpacing,
    maxY: effective.maxY + boundarySpacing,
  };
}

export function calculateCustomEffectiveDimensions(
  params: CustomLayoutParams,
): LayoutExtents {
  const boundarySpacing = resolveCustomBoundarySpacing(params);
  if (params.slots.length === 0) {
    return {
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
    width: roundLayoutDimensionToTenth(
      maxX - minX + boundarySpacing * 2,
    ),
    depth: roundLayoutDimensionToTenth(
      maxY - minY + boundarySpacing * 2,
    ),
    minX,
    maxX,
    minY,
    maxY,
  };
}

export function calculateCustomTrayFootprint(
  params: CustomLayoutParams,
): CustomTrayFootprint {
  const sizingMode = resolveCustomTraySizingMode(params);
  const footprintStyle = resolveCustomFootprintStyle(params);

  // contoured 分支：底座贴合槽位轮廓，不应用 side bevel / fixed sizing / corner radius。
  // 这些字段保留为 Dormant Fixed Tray Configuration，切换回 rectangular 时复活（CONTEXT:607-608）。
  if (footprintStyle === "contoured") {
    const contoured = calculateCustomContouredFootprint(params);
    const width = roundLayoutDimensionToTenth(contoured.maxX - contoured.minX);
    const depth = roundLayoutDimensionToTenth(contoured.maxY - contoured.minY);
    return {
      sizingMode: "auto", // contoured 下 fixed sizing 休眠，按派生尺寸返回
      footprintStyle,
      hasSlots: contoured.bodyCount > 0,
      width: width > 0 ? width : params.trayWidth,
      depth: depth > 0 ? depth : params.trayDepth,
      minX: contoured.minX,
      maxX: contoured.maxX,
      minY: contoured.minY,
      maxY: contoured.maxY,
      contourBodyCount: contoured.bodyCount,
    };
  }

  // rectangular 分支：保持现有语义
  if (sizingMode === "fixed") {
    return {
      sizingMode,
      footprintStyle,
      hasSlots: params.slots.length > 0,
      width: params.trayWidth,
      depth: params.trayDepth,
      minX: 0,
      maxX: params.trayWidth,
      minY: 0,
      maxY: params.trayDepth,
      contourBodyCount: params.slots.length > 0 ? 1 : 0,
    };
  }

  const effective = calculateCustomEffectiveDimensions(params);
  const sideBevelWidth = Math.max(0, params.sideBevelWidth);
  return {
    sizingMode,
    footprintStyle,
    hasSlots: effective.width > 0 && effective.depth > 0,
    width: effective.width > 0 ? effective.width + sideBevelWidth * 2 : params.trayWidth,
    depth: effective.depth > 0 ? effective.depth + sideBevelWidth * 2 : params.trayDepth,
    minX: effective.minX,
    maxX: effective.maxX,
    minY: effective.minY,
    maxY: effective.maxY,
    contourBodyCount: effective.width > 0 && effective.depth > 0 ? 1 : 0,
  };
}

export function calculateFixedCustomTrayUsableArea(
  params: CustomLayoutParams,
): FixedCustomTrayUsableArea {
  const safeBevelWidth = Math.max(
    0,
    Math.min(
      params.sideBevelWidth,
      params.trayWidth / 2 - 0.1,
      params.trayDepth / 2 - 0.1,
    ),
  );
  const outerCornerRadius = Math.max(
    0,
    Math.min(
      params.cornerRadius,
      params.trayWidth / 2 - 0.01,
      params.trayDepth / 2 - 0.01,
    ),
  );
  const inset = safeBevelWidth + resolveCustomBoundarySpacing(params);
  const width = Math.max(0, params.trayWidth - inset * 2);
  const depth = Math.max(0, params.trayDepth - inset * 2);

  return {
    x: inset,
    y: inset,
    width,
    depth,
    cornerRadius: Math.max(
      0,
      Math.min(outerCornerRadius - inset, width / 2, depth / 2),
    ),
  };
}

function isPointWithinRoundedArea(
  x: number,
  y: number,
  area: FixedCustomTrayUsableArea,
) {
  if (
    x < area.x ||
    x > area.x + area.width ||
    y < area.y ||
    y > area.y + area.depth
  ) {
    return false;
  }

  if (area.cornerRadius <= 0) {
    return true;
  }

  const centerX = Math.min(
    Math.max(x, area.x + area.cornerRadius),
    area.x + area.width - area.cornerRadius,
  );
  const centerY = Math.min(
    Math.max(y, area.y + area.cornerRadius),
    area.y + area.depth - area.cornerRadius,
  );
  return Math.hypot(x - centerX, y - centerY) <= area.cornerRadius + 1e-6;
}

export function isCustomSlotWithinFixedTrayUsableArea(
  slot: FreeSlot,
  area: FixedCustomTrayUsableArea,
): boolean {
  const profile = getFreeSlotProfileGeometry(slot);
  const radians = (slot.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const points = sampleSlotProfilePoints(
    profile.width,
    profile.height,
    slot.shape,
    profile.outerOffset,
    RENDER_CONFIG.cylinderSegments,
    profile.profileExponent,
  );

  return points.every((point) =>
    isPointWithinRoundedArea(
      slot.x + point.x * cos - point.y * sin,
      slot.y + point.x * sin + point.y * cos,
      area,
    ),
  );
}
