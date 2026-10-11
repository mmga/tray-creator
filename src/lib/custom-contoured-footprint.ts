import {
  constructContouredFootprints,
  type ContouredFootprintConstructionError,
  type ContouredFootprintPlan,
  type ConstructedContouredFootprint,
  type ContouredFootprintSlot,
} from "@/lib/contoured-footprint";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";

export type CustomContouredFootprintOutcome =
  | { ok: true; value: ConstructedContouredFootprint }
  | { ok: false; error: ContouredFootprintConstructionError };

export interface CustomContouredFootprintInput {
  readonly plan: ContouredFootprintPlan;
}

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

export function projectCustomContouredFootprintInput(
  params: CustomLayoutParams,
): CustomContouredFootprintInput {
  const isPolygonal = params.footprintStyle === "polygonal";
  return {
    plan: {
      requests: [{
        key: "custom-baseplate",
        ...(isPolygonal ? {
          constructionStyle: "polygonal" as const,
          ...(params.polygonCornerStyle === "tangent" ? { polygonCornerStyle: "tangent" as const } : { cornerRadius: params.cornerRadius }),
        } : {}),
        slots: params.slots.map(projectCustomSlotToContoured),
        slotSpacing: params.spacing,
        boundarySpacing: params.boundarySpacingIndependent
          ? params.boundarySpacing
          : params.spacing,
        smoothingRadius: isPolygonal ? 0 : params.smoothingRadius ?? 60,
        disconnectDistance: isPolygonal ? 0 : params.disconnectDistance ?? 0,
      }],
    },
  };
}

export function constructCustomContouredFootprintOutcome(
  input: CustomContouredFootprintInput,
): CustomContouredFootprintOutcome {
  const outcome = constructContouredFootprints(input.plan);
  if (!outcome.ok) {
    return outcome;
  }
  const footprint = outcome.value.footprints[0];
  if (!footprint) {
    return {
      ok: false,
      error: {
        code: "invalid-plan",
        message: "Custom Contoured Footprint 缺少构造结果",
      },
    };
  }
  return { ok: true, value: footprint };
}
