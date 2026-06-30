"use client";

import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import {
  exportSteppedSplitPartFiles,
  exportSteppedModelFiles,
  generateSteppedSplitPreview,
  generateSteppedPreview,
} from "@/lib/stepped-model-service";

export type { UseSteppedLayoutReturn } from "@/hooks/useSteppedLayoutController";

export function useSteppedLayout() {
  return useSteppedLayoutController({
    generatePreview: generateSteppedPreview,
    exportModel: exportSteppedModelFiles,
    generateSplitPreview: generateSteppedSplitPreview,
    exportSplitParts: exportSteppedSplitPartFiles,
  });
}
