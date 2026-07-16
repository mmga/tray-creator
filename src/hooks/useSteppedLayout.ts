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
    updateGroupSplitPartTarget,
    ...steppedModel
  } = useSteppedLayoutController({
    mode: "stepped",
    generatePreview: generateSteppedPreview,
    exportModel: exportSteppedModelFiles,
  });
  void updateGroupSplitPartTarget;

  return steppedModel;
}
