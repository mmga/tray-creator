import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import { RENDER_CONFIG } from "@/lib/config";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";

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
  hasSlots: boolean;
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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
  if (sizingMode === "fixed") {
    return {
      sizingMode,
      hasSlots: params.slots.length > 0,
      width: params.trayWidth,
      depth: params.trayDepth,
      minX: 0,
      maxX: params.trayWidth,
      minY: 0,
      maxY: params.trayDepth,
    };
  }

  const effective = calculateCustomEffectiveDimensions(params);
  const sideBevelWidth = Math.max(0, params.sideBevelWidth);
  return {
    sizingMode,
    hasSlots: effective.width > 0 && effective.depth > 0,
    width: effective.width > 0 ? effective.width + sideBevelWidth * 2 : params.trayWidth,
    depth: effective.depth > 0 ? effective.depth + sideBevelWidth * 2 : params.trayDepth,
    minX: effective.minX,
    maxX: effective.maxX,
    minY: effective.minY,
    maxY: effective.maxY,
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
