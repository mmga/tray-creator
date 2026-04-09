import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import type { LayoutExtents } from "@/lib/custom-layout-math";
import type { SteppedLayoutParams } from "@/types/custom-tray";

// SteppedLayoutExtents has the same shape as LayoutExtents — re-export to
// avoid duplicating the interface definition.
export type { LayoutExtents as SteppedLayoutExtents } from "@/lib/custom-layout-math";

export function calculateSteppedEffectiveDimensions(
  params: SteppedLayoutParams,
): LayoutExtents {
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
    const { halfW, halfH } = getEllipseBoundingBox(
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
    width: Math.ceil(maxX - minX + boundarySpacing * 2),
    depth: Math.ceil(maxY - minY + boundarySpacing * 2),
    minX,
    maxX,
    minY,
    maxY,
  };
}
