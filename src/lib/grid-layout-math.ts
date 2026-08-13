import { getGridSlotGeometry } from "@/lib/grid-config";
import type { TrayParams } from "@/types/tray";

export function getGridSpacingAxes(params: TrayParams) {
  return {
    spacingX: params.spacingIndependent ? params.spacingX : params.spacing,
    spacingY: params.spacingIndependent ? params.spacingY : params.spacing,
  };
}

export function getGridBoundarySpacingAxes(params: TrayParams) {
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  return {
    boundarySpacingX: params.boundarySpacingIndependent
      ? params.boundarySpacing
      : spacingX,
    boundarySpacingY: params.boundarySpacingIndependent
      ? params.boundarySpacing
      : spacingY,
  };
}

export function getGridSlotPitchAxes(params: TrayParams) {
  const slot = getGridSlotGeometry(params);
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  return {
    pitchX:
      (slot.shape === "rectangle" ? slot.baseWidth : slot.slotWidth) + spacingX,
    pitchY:
      (slot.shape === "rectangle" ? slot.baseHeight : slot.slotHeight) + spacingY,
  };
}
