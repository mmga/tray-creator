"use client";

import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import {
  exportSteppedCadSplitPartFiles,
  exportSteppedCadModelFiles,
  generateSteppedCadSplitPreview,
  generateSteppedCadPreview,
} from "@/lib/stepped-cad-model-service";

export function useSteppedCadLayout() {
  return useSteppedLayoutController({
    generatePreview: generateSteppedCadPreview,
    exportModel: exportSteppedCadModelFiles,
    generateSplitPreview: generateSteppedCadSplitPreview,
    exportSplitParts: exportSteppedCadSplitPartFiles,
  });
}
