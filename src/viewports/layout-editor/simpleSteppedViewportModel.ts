import type { CustomLayoutParams, SimpleSteppedRowBand } from "@/types/custom-tray";
import type { LayoutEditorViewportModel } from "@/viewports/layout-editor/types";

export function buildSimpleSteppedLayoutEditorViewportModel({
  canvasParams,
  rowBands,
  slotHeightById,
  slotMoveScopeResolver,
}: {
  canvasParams: CustomLayoutParams;
  rowBands: SimpleSteppedRowBand[];
  slotHeightById?: Record<string, number>;
  slotMoveScopeResolver: (draggingId: string, selectedIds: string[]) => string[];
}): LayoutEditorViewportModel {
  return {
    trayFrame: {
      width: canvasParams.trayWidth,
      depth: canvasParams.trayDepth,
      spacing: canvasParams.spacing,
      boundarySpacing: canvasParams.boundarySpacingIndependent
        ? canvasParams.boundarySpacing
        : canvasParams.spacing,
      cornerRadius: canvasParams.cornerRadius,
      showEffectiveBaseplate: false,
      showMaxBuildBoundary: true,
    },
    slots: canvasParams.slots,
    overlays: {
      rowBands,
    },
    interactions: {
      slotHeightById,
      slotMoveScopeResolver,
    },
  };
}
