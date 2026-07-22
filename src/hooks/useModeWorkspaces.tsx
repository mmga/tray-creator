"use client";

import { useCallback, useMemo } from "react";
import type { useCustomLayout } from "@/hooks/useCustomLayout";
import type { useBaseConverter } from "@/hooks/useBaseConverter";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { useSteppedLayout } from "@/hooks/useSteppedLayout";
import type { useTrayModel } from "@/hooks/useTrayModel";
import { useCustomWorkspace } from "@/workspaces/custom/useCustomWorkspace";
import { useBaseConverterWorkspace } from "@/workspaces/base-converter/useBaseConverterWorkspace";
import { useGridWorkspace } from "@/workspaces/grid/useGridWorkspace";
import { useSteppedWorkspace } from "@/workspaces/stepped/useSteppedWorkspace";
import type { ModeWorkspace } from "@/workspaces/types";
import type { AppMode } from "@/types/custom-tray";
import type { DraftActionResult } from "@/workspaces/draft-action-area";
import type { ModeWorkspaceImportTarget } from "@/workspaces/types";

interface UseModeWorkspacesOptions {
  mode: AppMode;
  gridModel: ReturnType<typeof useTrayModel>;
  customModel: ReturnType<typeof useCustomLayout>;
  baseConverterModel: ReturnType<typeof useBaseConverter>;
  steppedModel: ReturnType<typeof useSteppedLayout>;
  customInteractionState: ModeInteractionState;
  steppedInteractionState: ModeInteractionState;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
}

interface UseModeWorkspacesReturn {
  activeWorkspace: ModeWorkspace;
  getImportTarget: (mode: AppMode) => ModeWorkspaceImportTarget;
}

export function useModeWorkspaces({
  mode,
  gridModel,
  customModel,
  baseConverterModel,
  steppedModel,
  customInteractionState,
  steppedInteractionState,
  onRequestParamImport,
}: UseModeWorkspacesOptions): UseModeWorkspacesReturn {
  const gridWorkspace = useGridWorkspace({
    model: gridModel,
    onRequestParamImport,
  });
  const customWorkspace = useCustomWorkspace({
    model: customModel,
    interactionState: customInteractionState,
    onRequestParamImport,
  });
  const baseConverterWorkspace = useBaseConverterWorkspace({
    model: baseConverterModel,
    onRequestParamImport,
  });
  const steppedWorkspace = useSteppedWorkspace({
    model: steppedModel,
    interactionState: steppedInteractionState,
    onRequestParamImport,
  });

  const activeWorkspace = useMemo<ModeWorkspace>(() => {
    switch (mode) {
      case "grid":
        return gridWorkspace;
      case "custom":
        return customWorkspace;
      case "base-converter":
        return baseConverterWorkspace;
      case "stepped":
        return steppedWorkspace;
      default: {
        const unreachableMode: never = mode;
        throw new Error(`Unsupported workspace mode: ${String(unreachableMode)}`);
      }
    }
  }, [
    customWorkspace,
    baseConverterWorkspace,
    gridWorkspace,
    mode,
    steppedWorkspace,
  ]);

  const getImportTarget = useCallback((targetMode: AppMode) => {
    switch (targetMode) {
      case "grid":
        return gridWorkspace.importTarget;
      case "custom":
        return customWorkspace.importTarget;
      case "base-converter":
        return baseConverterWorkspace.importTarget;
      case "stepped":
        return steppedWorkspace.importTarget;
      default: {
        const unreachableMode: never = targetMode;
        throw new Error(`Unsupported import mode: ${String(unreachableMode)}`);
      }
    }
  }, [
    customWorkspace.importTarget,
    baseConverterWorkspace.importTarget,
    gridWorkspace.importTarget,
    steppedWorkspace.importTarget,
  ]);

  return {
    activeWorkspace,
    getImportTarget,
  };
}
