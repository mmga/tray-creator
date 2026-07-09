"use client";

import type { UseSteppedCadLayoutReturn } from "@/hooks/useSteppedCadLayout";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import { useSteppedViewportWorkspace } from "@/viewports/stepped/useSteppedViewportWorkspace";

interface UseSteppedCadViewportWorkspaceOptions {
  model: UseSteppedCadLayoutReturn;
  interactionState: ModeInteractionState;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
}

export function useSteppedCadViewportWorkspace(
  options: UseSteppedCadViewportWorkspaceOptions,
) {
  return useSteppedViewportWorkspace({
    ...options,
    mode: "stepped-cad",
    splitPreview: {
      parts: options.model.splitPreviewParts,
      isGenerating: options.model.isGeneratingSplitPreview,
      generate: options.model.handleGenerateSplitPreview,
    },
  });
}
