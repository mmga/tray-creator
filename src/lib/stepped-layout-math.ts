import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import {
  roundLayoutDimensionToTenth,
  type LayoutExtents,
} from "@/lib/custom-layout-math";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import type { ConstructedSteppedContouredFootprints } from "@/lib/stepped-contoured-footprint";
import type { SteppedLayoutParams } from "@/types/custom-tray";

// SteppedLayoutExtents has the same shape as LayoutExtents — re-export to
// avoid duplicating the interface definition.
export type { LayoutExtents as SteppedLayoutExtents } from "@/lib/custom-layout-math";

export function calculateSteppedEffectiveDimensions(
  params: SteppedLayoutParams,
  contouredState: ContouredFootprintState<ConstructedSteppedContouredFootprints> = {
    status: "inactive",
  },
): LayoutExtents {
  const boundarySpacing = params.boundarySpacingIndependent
    ? (params.boundarySpacing ?? params.spacing)
    : params.spacing;
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

  if (params.footprintStyle !== "rectangular") {
    const bounds = contouredState.status === "ready"
      ? contouredState.value.bounds
      : null;
    if (bounds) {
      return {
        width: roundLayoutDimensionToTenth(bounds.maxX - bounds.minX),
        depth: roundLayoutDimensionToTenth(bounds.maxY - bounds.minY),
        ...bounds,
      };
    }
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
    width: roundLayoutDimensionToTenth(maxX - minX + boundarySpacing * 2),
    depth: roundLayoutDimensionToTenth(maxY - minY + boundarySpacing * 2),
    minX,
    maxX,
    minY,
    maxY,
  };
}
