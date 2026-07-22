import {
  constructContouredFootprints,
  type ConstructedContouredFootprint,
  type ContouredFootprintSlot,
} from "@/lib/contoured-footprint";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";

export function projectCustomSlotToContoured(
  slot: FreeSlot,
): ContouredFootprintSlot {
  return {
    id: slot.id,
    cx: slot.x,
    cy: slot.y,
    rotation: slot.rotation || 0,
    shape: slot.shape,
    profile: getFreeSlotProfileGeometry(slot),
  };
}

export function constructCustomContouredFootprint(
  params: CustomLayoutParams,
): ConstructedContouredFootprint {
  const outcome = constructContouredFootprints({
    requests: [{
      key: "custom-baseplate",
      slots: params.slots.map(projectCustomSlotToContoured),
      slotSpacing: params.spacing,
      boundarySpacing: params.boundarySpacingIndependent
        ? params.boundarySpacing
        : params.spacing,
      smoothingRadius: params.smoothingRadius ?? 60,
      disconnectDistance: params.disconnectDistance ?? 0,
    }],
  });
  if (!outcome.ok) {
    throw Object.assign(new Error(outcome.error.message), {
      code: outcome.error.code,
      constructionError: outcome.error,
    });
  }
  return outcome.value.footprints[0];
}
