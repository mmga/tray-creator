"use client";

import type { UseSteppedCadLayoutReturn } from "@/hooks/useSteppedCadLayout";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import { useSteppedWorkspace } from "@/workspaces/stepped/useSteppedWorkspace";
import type { ModeWorkspace } from "@/workspaces/types";

interface UseSteppedCadWorkspaceOptions {
  model: UseSteppedCadLayoutReturn;
  interactionState: ModeInteractionState;
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
