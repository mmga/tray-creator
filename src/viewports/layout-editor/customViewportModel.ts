import type { CustomLayoutParams } from "@/types/custom-tray";
import type { LayoutEditorViewportModel } from "@/viewports/layout-editor/types";

export function buildCustomLayoutEditorViewportModel(
  params: CustomLayoutParams,
): LayoutEditorViewportModel {
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
      showEffectiveBaseplate: true,
      showMaxBuildBoundary: false,
    },
    slots: params.slots,
    overlays: {},
    interactions: {},
  };
}
