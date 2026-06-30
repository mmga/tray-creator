"use client";

import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import {
  exportSteppedCadModelFiles,
  generateSteppedCadPreview,
} from "@/lib/stepped-cad-model-service";

export function useSteppedCadLayout() {
  return useSteppedLayoutController({
    generatePreview: generateSteppedCadPreview,
    exportModel: exportSteppedCadModelFiles,
  });
}
