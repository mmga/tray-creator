import type { CustomLayoutParams } from "@/types/custom-tray";
import {
  calculateFixedCustomTrayUsableArea,
  resolveCustomTraySizingMode,
} from "@/lib/custom-layout-math";
import type { LayoutEditorViewportModel } from "@/viewports/layout-editor/types";

export function buildCustomLayoutEditorViewportModel(
  params: CustomLayoutParams,
): LayoutEditorViewportModel {
  const isFixed = resolveCustomTraySizingMode(params) === "fixed";
  return {
    trayFrame: {
      width: params.trayWidth,
      depth: params.trayDepth,
      spacing: params.spacing,
      boundarySpacing: params.boundarySpacingIndependent
        ? params.boundarySpacing
        : params.spacing,
      cornerRadius: params.cornerRadius,
      sideBevelWidth: params.sideBevelWidth,
      showEffectiveBaseplate: !isFixed,
      showMaxBuildBoundary: false,
      fixedUsableArea: isFixed
        ? calculateFixedCustomTrayUsableArea(params)
        : undefined,
    },
    slots: params.slots,
    overlays: {},
    interactions: {},
  };
}
