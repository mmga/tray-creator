"use client";

import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import type { UseSteppedLayoutControllerReturn } from "@/hooks/useSteppedLayoutController";
import { exportSteppedModelFiles, generateSteppedPreview } from "@/lib/stepped-model-service";

export type UseSteppedLayoutReturn = Omit<
  UseSteppedLayoutControllerReturn,
  "updateGroupSplitPartTarget"
>;

export function useSteppedLayout(): UseSteppedLayoutReturn {
  const {
    updateGroupSplitPartTarget: _updateGroupSplitPartTarget,
    ...steppedModel
  } = useSteppedLayoutController({
    generatePreview: generateSteppedPreview,
    exportModel: exportSteppedModelFiles,
  });

  return steppedModel;
}
