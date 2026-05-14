"use client";

import { useMemo } from "react";
import type { useCustomLayout } from "@/hooks/useCustomLayout";
import type { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import type { useSteppedLayout } from "@/hooks/useSteppedLayout";
import type { useTrayModel } from "@/hooks/useTrayModel";
import { useCustomWorkspace } from "@/workspaces/custom/useCustomWorkspace";
import { useGridWorkspace } from "@/workspaces/grid/useGridWorkspace";
import { useSimpleSteppedWorkspace } from "@/workspaces/simple-stepped/useSimpleSteppedWorkspace";
import { useSteppedWorkspace } from "@/workspaces/stepped/useSteppedWorkspace";
import type { ModeWorkspace } from "@/workspaces/types";
import type { AppMode } from "@/types/custom-tray";

interface UseModeWorkspacesOptions {
  mode: AppMode;
  gridModel: ReturnType<typeof useTrayModel>;
  customModel: ReturnType<typeof useCustomLayout>;
  simpleSteppedModel: ReturnType<typeof useSimpleSteppedLayout>;
  steppedModel: ReturnType<typeof useSteppedLayout>;
  selectedSlotIds: string[];
  previewGroupId: string | null;
  onPreviewGroupChange: (groupId: string | null) => void;
  onSteppedWorkspaceReset: () => void;
}

interface UseModeWorkspacesReturn {
  activeWorkspace: ModeWorkspace;
}

export function useModeWorkspaces({
  mode,
  gridModel,
  customModel,
  simpleSteppedModel,
  steppedModel,
  selectedSlotIds,
  previewGroupId,
  onPreviewGroupChange,
  onSteppedWorkspaceReset,
}: UseModeWorkspacesOptions): UseModeWorkspacesReturn {
  const gridWorkspace = useGridWorkspace({
    model: gridModel,
  });
  const customWorkspace = useCustomWorkspace({
    model: customModel,
  });
  const simpleSteppedWorkspace = useSimpleSteppedWorkspace({
    model: simpleSteppedModel,
  });
  const steppedWorkspace = useSteppedWorkspace({
    model: steppedModel,
    selectedSlotIds,
    previewGroupId,
    onPreviewGroupChange,
    onWorkspaceReset: onSteppedWorkspaceReset,
  });

  const activeWorkspace = useMemo<ModeWorkspace>(() => {
    switch (mode) {
      case "grid":
        return gridWorkspace;
      case "custom":
        return customWorkspace;
      case "simple-stepped":
        return simpleSteppedWorkspace;
      case "stepped":
        return steppedWorkspace;
      default: {
        const unreachableMode: never = mode;
        throw new Error(`Unsupported workspace mode: ${String(unreachableMode)}`);
      }
    }
  }, [
    customWorkspace,
    gridWorkspace,
    mode,
    simpleSteppedWorkspace,
    steppedWorkspace,
  ]);

  return {
    activeWorkspace,
  };
}
