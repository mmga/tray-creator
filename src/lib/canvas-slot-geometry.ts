import { RENDER_CONFIG, getSlotOuterOffset } from "@/lib/config";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
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
  | "x"
  | "y"
  | "width"
  | "height"
  | "rotation"
  | "shape"
  | "slotWidth"
  | "slotHeight"
  | "outerOffset"
  | "profileExponent"
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
  shape?: FreeSlot["shape"],
  ellipseProfileExponent?: number,
  ellipseOuterOffset?: number,
): CanvasEllipseBoundingBox {
  const radians = (rotation * Math.PI) / 180;
  const offset =
    typeof ellipseOuterOffset === "number"
      ? ellipseOuterOffset
      : getSlotOuterOffset(width, height, shape);
  const points = sampleSlotProfilePoints(
    width,
    height,
    shape,
    offset,
    RENDER_CONFIG.cylinderSegments,
    ellipseProfileExponent,
  );
  let halfW = 0;
  let halfH = 0;

  for (const point of points) {
    const x = point.x * Math.cos(radians) - point.y * Math.sin(radians);
    const y = point.x * Math.sin(radians) + point.y * Math.cos(radians);
    halfW = Math.max(halfW, Math.abs(x));
    halfH = Math.max(halfH, Math.abs(y));
  }

  return { halfW, halfH };
}

export function calculateEffectiveBaseplate(
  slots: ReadonlyArray<CanvasGeometrySlot>,
  trayDepth: number,
  boundarySpacing: number,
  ellipseProfileExponent?: number,
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
    const profile = getFreeSlotProfileGeometry(slot);
    const { halfW, halfH } = getEllipseBoundingBox(
      profile.width,
      profile.height,
      slot.rotation,
      slot.shape,
      profile.profileExponent ?? ellipseProfileExponent,
      profile.outerOffset,
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
