import { getSlotTolerance } from "@/lib/config";
import type { FreeSlot } from "@/types/custom-tray";

export interface CanvasEllipseBoundingBox {
  halfW: number;
  halfH: number;
}

export interface CanvasEffectiveBaseplate {
  hasSlots: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

type CanvasGeometrySlot = Pick<
  FreeSlot,
  "x" | "y" | "width" | "height" | "rotation"
>;

export function normalizeDisplayAngle(angle: number) {
  const normalized = ((angle + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
}

export function getSlotLabelRotation(slotRotation: number) {
  const geometryAngle = normalizeDisplayAngle(-slotRotation);
  return geometryAngle > 90 || geometryAngle < -90
    ? normalizeDisplayAngle(geometryAngle + 180)
    : geometryAngle;
}

export function getEllipseBoundingBox(
  width: number,
  height: number,
  rotation: number,
): CanvasEllipseBoundingBox {
  const radians = (rotation * Math.PI) / 180;
  const radiusX = (width + getSlotTolerance(width)) / 2;
  const radiusY = (height + getSlotTolerance(height)) / 2;

  return {
    halfW: Math.sqrt(
      Math.pow(radiusX * Math.cos(radians), 2) +
        Math.pow(radiusY * Math.sin(radians), 2),
    ),
    halfH: Math.sqrt(
      Math.pow(radiusX * Math.sin(radians), 2) +
        Math.pow(radiusY * Math.cos(radians), 2),
    ),
  };
}

export function calculateEffectiveBaseplate(
  slots: ReadonlyArray<CanvasGeometrySlot>,
  trayDepth: number,
  boundarySpacing: number,
): CanvasEffectiveBaseplate {
  if (slots.length === 0) {
    return {
      hasSlots: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const slot of slots) {
    const { halfW, halfH } = getEllipseBoundingBox(
      slot.width,
      slot.height,
      slot.rotation,
    );
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  }

  return {
    hasSlots: true,
    x: minX - boundarySpacing,
    y: trayDepth - (maxY + boundarySpacing),
    width: Math.max(0, maxX - minX + boundarySpacing * 2),
    height: Math.max(0, maxY - minY + boundarySpacing * 2),
  };
}
