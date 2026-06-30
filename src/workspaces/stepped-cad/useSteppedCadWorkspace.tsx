"use client";

import type { UseSteppedLayoutReturn } from "@/hooks/useSteppedLayout";
import { useSteppedWorkspace } from "@/workspaces/stepped/useSteppedWorkspace";
import type { ModeWorkspace } from "@/workspaces/types";

interface UseSteppedCadWorkspaceOptions {
  model: UseSteppedLayoutReturn;
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
