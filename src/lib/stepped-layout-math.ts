import { getSlotTolerance } from "@/lib/config";
import type { FreeSlot, SteppedLayoutParams } from "@/types/custom-tray";

export interface SteppedLayoutExtents {
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function getSteppedSlotBoundingHalfSize(slot: FreeSlot) {
  const rad = (slot.rotation * Math.PI) / 180;
  const a = (slot.width + getSlotTolerance(slot.width)) / 2;
  const b = (slot.height + getSlotTolerance(slot.height)) / 2;
  const halfW = Math.sqrt(
    Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2),
  );
  const halfH = Math.sqrt(
    Math.pow(a * Math.sin(rad), 2) + Math.pow(b * Math.cos(rad), 2),
  );

  return { halfW, halfH };
}

export function calculateSteppedEffectiveDimensions(
  params: SteppedLayoutParams,
): SteppedLayoutExtents {
  const boundarySpacing = params.spacing;
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
    const { halfW, halfH } = getSteppedSlotBoundingHalfSize(slot);
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
