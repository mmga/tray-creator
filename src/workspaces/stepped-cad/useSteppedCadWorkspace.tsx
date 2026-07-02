"use client";

import type { UseSteppedCadLayoutReturn } from "@/hooks/useSteppedCadLayout";
import { useSteppedWorkspace } from "@/workspaces/stepped/useSteppedWorkspace";
import type { ModeWorkspace } from "@/workspaces/types";

interface UseSteppedCadWorkspaceOptions {
  model: UseSteppedCadLayoutReturn;
  selectedSlotIds: string[];
  previewGroupId: string | null;
  onPreviewGroupChange: (groupId: string | null) => void;
  onWorkspaceReset: () => void;
}

export function useSteppedCadWorkspace(
  options: UseSteppedCadWorkspaceOptions,
): ModeWorkspace {
  return useSteppedWorkspace({
    ...options,
    mode: "stepped-cad",
    enableSplitExport: true,
  });
}
