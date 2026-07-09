import type {
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { LayoutEditorViewportModel } from "@/viewports/layout-editor/types";

export function buildSteppedLayoutEditorViewportModel({
  params,
  focusedGroupId,
  groupOutlines,
}: {
  params: SteppedLayoutParams;
  focusedGroupId: string | null;
  groupOutlines: GroupOutlinePreview[] | null;
}): LayoutEditorViewportModel {
  return {
    trayFrame: {
      width: params.trayWidth,
      depth: params.trayDepth,
      spacing: params.spacing,
      boundarySpacing: params.spacing,
      cornerRadius: 0,
      sideBevelWidth: 0,
      showEffectiveBaseplate: false,
      showMaxBuildBoundary: false,
    },
    slots: params.slots,
    overlays: {
      focusedGroupId,
      groupOutlines,
      slotGroups: params.groups,
    },
    interactions: {},
  };
}
