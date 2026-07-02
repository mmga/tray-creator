"use client";

import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import type { UseSteppedLayoutControllerReturn } from "@/hooks/useSteppedLayoutController";
import { exportSteppedModelFiles, generateSteppedPreview } from "@/lib/stepped-model-service";

type SteppedOnlyKeys =
  | "updateGroupSplitPartTarget"
  | "splitPreviewParts"
  | "isGeneratingSplitPreview"
  | "handleGenerateSplitPreview"
  | "clearSplitPreview"
  | "handleExportSplitParts";

export type UseSteppedLayoutReturn = Omit<
  UseSteppedLayoutControllerReturn,
  SteppedOnlyKeys
>;

export function useSteppedLayout() {
  const model = useSteppedLayoutController({
    generatePreview: generateSteppedPreview,
    exportModel: exportSteppedModelFiles,
  });

  const {
    updateGroupSplitPartTarget: _updateGroupSplitPartTarget,
    splitPreviewParts: _splitPreviewParts,
    isGeneratingSplitPreview: _isGeneratingSplitPreview,
    handleGenerateSplitPreview: _handleGenerateSplitPreview,
    clearSplitPreview: _clearSplitPreview,
    handleExportSplitParts: _handleExportSplitParts,
    ...steppedModel
  } = model;

  return steppedModel;
}
