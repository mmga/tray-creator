"use client";

import type { UseSteppedLayoutReturn } from "@/hooks/useSteppedLayout";
import { useSteppedViewportWorkspace } from "@/viewports/stepped/useSteppedViewportWorkspace";

interface UseSteppedCadViewportWorkspaceOptions {
  model: UseSteppedLayoutReturn;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
}

export function useSteppedCadViewportWorkspace(
  options: UseSteppedCadViewportWorkspaceOptions,
) {
  return useSteppedViewportWorkspace({
    ...options,
    mode: "stepped-cad",
    supportsSplitPreview: false,
  });
}
