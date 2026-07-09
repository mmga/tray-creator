"use client";

import {
  useSteppedCadSplitOrchestration,
  type UseSteppedCadSplitOrchestrationReturn,
} from "@/hooks/useSteppedCadSplitOrchestration";
import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import type { UseSteppedLayoutControllerReturn } from "@/hooks/useSteppedLayoutController";
import {
  exportSteppedCadSplitPartFiles,
  exportSteppedCadModelFiles,
  generateSteppedCadSplitPreview,
  generateSteppedCadPreview,
} from "@/lib/stepped-cad-model-service";

export type UseSteppedCadLayoutReturn = UseSteppedLayoutControllerReturn &
  UseSteppedCadSplitOrchestrationReturn;

export function useSteppedCadLayout(): UseSteppedCadLayoutReturn {
  const coreModel = useSteppedLayoutController({
    generatePreview: generateSteppedCadPreview,
    exportModel: exportSteppedCadModelFiles,
  });
  const splitModel = useSteppedCadSplitOrchestration({
    params: coreModel.params,
    generateSplitPreview: generateSteppedCadSplitPreview,
    exportSplitParts: exportSteppedCadSplitPartFiles,
  });

  return {
    ...coreModel,
    ...splitModel,
  };
}
