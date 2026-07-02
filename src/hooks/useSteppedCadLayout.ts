"use client";

import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import type { UseSteppedLayoutControllerReturn } from "@/hooks/useSteppedLayoutController";
import {
  exportSteppedCadSplitPartFiles,
  exportSteppedCadModelFiles,
  generateSteppedCadSplitPreview,
  generateSteppedCadPreview,
} from "@/lib/stepped-cad-model-service";

export type UseSteppedCadLayoutReturn = UseSteppedLayoutControllerReturn;

export function useSteppedCadLayout() {
  return useSteppedLayoutController({
    generatePreview: generateSteppedCadPreview,
    exportModel: exportSteppedCadModelFiles,
    generateSplitPreview: generateSteppedCadSplitPreview,
    exportSplitParts: exportSteppedCadSplitPartFiles,
  });
}
