import type {
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { LayoutEditorViewportModel } from "@/viewports/layout-editor/types";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import type { ConstructedSteppedContouredFootprints } from "@/lib/stepped-contoured-footprint";

export function buildSteppedLayoutEditorViewportModel({
  params,
  focusedGroupId,
  groupOutlines,
  contouredState,
}: {
  params: SteppedLayoutParams;
  focusedGroupId: string | null;
  groupOutlines: GroupOutlinePreview[] | null;
  contouredState: ContouredFootprintState<ConstructedSteppedContouredFootprints>;
}): LayoutEditorViewportModel {
  // boundary spacing 缺失时跟随 spacing（CONTEXT:613）
  const boundarySpacing = params.boundarySpacingIndependent
    ? (params.boundarySpacing ?? params.spacing)
    : params.spacing;
  // rectangular 阶梯最低层应用 cornerRadius（CONTEXT:601），由 groupOutlines 中的最低层轮廓承载
  // 这里把 cornerRadius 透传给 trayFrame 供需要时复用
  const cornerRadius = params.footprintStyle === "rectangular"
    ? (params.cornerRadius ?? 0)
    : 0;
  const footprintWarnings = contouredState.status === "failed"
    ? [contouredState.error.message]
    : contouredState.status === "ready"
      ? contouredState.value.diagnostics.map((diagnostic) => diagnostic.message)
      : undefined;

  return {
    trayFrame: {
      width: params.trayWidth,
      depth: params.trayDepth,
      spacing: params.spacing,
      boundarySpacing,
      cornerRadius,
      sideBevelWidth: 0,
      showEffectiveBaseplate: false,
      showMaxBuildBoundary: false,
    },
    slots: params.slots,
    overlays: {
      focusedGroupId,
      // groupOutlines 由 useSteppedLayoutController 通过 buildSteppedOutlinePreview 注入，
      // 该函数已按 footprintStyle 分流（rectangular 复用 feature-graph 矩形 footprint）
      groupOutlines,
      slotGroups: params.groups,
      footprintWarnings,
    },
    interactions: {},
  };
}
