import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import type { CustomLayoutParams } from "@/types/custom-tray";

export interface LayoutExtents {
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function resolveCustomBoundarySpacing(
  params: CustomLayoutParams,
): number {
  if (params.boundarySpacingIndependent) {
    return params.boundarySpacing;
  }

  return params.spacing;
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
    const { halfW, halfH } = getEllipseBoundingBox(
      slot.width,
      slot.height,
      slot.rotation,
      slot.shape,
      slot.profileExponent,
      slot.outerOffset,
    );
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  });

  return {
    width: Math.ceil(maxX - minX + boundarySpacing * 2),
    depth: Math.ceil(maxY - minY + boundarySpacing * 2),
    minX,
    maxX,
    minY,
    maxY,
  };
}
