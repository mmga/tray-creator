"use client";

import {
  useSteppedCadSplitOrchestration,
  type UseSteppedCadSplitOrchestrationReturn,
} from "@/hooks/useSteppedCadSplitOrchestration";
import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import type { UseSteppedLayoutControllerReturn } from "@/hooks/useSteppedLayoutController";
import {
  exportSteppedModelFiles,
  exportSteppedSplitPartFiles,
  generateSteppedPreview,
  generateSteppedSplitPreview,
} from "@/lib/stepped-model-service";

export type UseSteppedLayoutReturn = UseSteppedLayoutControllerReturn &
  UseSteppedCadSplitOrchestrationReturn;

export function useSteppedLayout(): UseSteppedLayoutReturn {
  const steppedModel = useSteppedLayoutController({
    mode: "stepped",
    generatePreview: generateSteppedPreview,
    exportModel: exportSteppedModelFiles,
  });
  const splitModel = useSteppedCadSplitOrchestration({
    params: steppedModel.persistedParams,
    contouredFootprintState: steppedModel.contouredFootprintState,
    transactionRevision: steppedModel.transactionRevision,
    edit: steppedModel.edit,
    previewEdit: steppedModel.previewEdit,
    generateSplitPreview: generateSteppedSplitPreview,
    exportSplitParts: exportSteppedSplitPartFiles,
  });

  return { ...steppedModel, ...splitModel };
}
