"use client";

import type { UseSteppedCadLayoutReturn } from "@/hooks/useSteppedCadLayout";
import { useSteppedViewportWorkspace } from "@/viewports/stepped/useSteppedViewportWorkspace";

interface UseSteppedCadViewportWorkspaceOptions {
  model: UseSteppedCadLayoutReturn;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
}

export function useSteppedCadViewportWorkspace(
  options: UseSteppedCadViewportWorkspaceOptions,
) {
  return useSteppedViewportWorkspace({
    ...options,
    mode: "stepped-cad",
    supportsSplitPreview: true,
  });
}
