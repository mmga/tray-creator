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
import type { ModeWorkspaceReplacementTarget } from "@/workspaces/types";
import type { PreparedDraftLoad } from "@/hooks/useModeDrafts";

interface UseModeWorkspacesOptions {
  mode: AppMode;
  gridModel: ReturnType<typeof useTrayModel>;
  customModel: ReturnType<typeof useCustomLayout>;
  baseConverterModel: ReturnType<typeof useBaseConverter>;
  steppedModel: ReturnType<typeof useSteppedLayout>;
  customInteractionState: ModeInteractionState;
  steppedInteractionState: ModeInteractionState;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
  onRequestReset: (mode: AppMode) => void;
  onRequestDraftLoad: (
    mode: AppMode,
    prepared: PreparedDraftLoad<AppMode>,
  ) => void;
}

interface UseModeWorkspacesReturn {
  activeWorkspace: ModeWorkspace;
  getWorkspace: (mode: AppMode) => ModeWorkspace;
  getReplacementTarget: (mode: AppMode) => ModeWorkspaceReplacementTarget;
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
  onRequestReset,
  onRequestDraftLoad,
}: UseModeWorkspacesOptions): UseModeWorkspacesReturn {
  const gridWorkspace = useGridWorkspace({
    model: gridModel,
    onRequestParamImport,
    onRequestReset: () => onRequestReset("grid"),
    onRequestDraftLoad: (prepared) => onRequestDraftLoad("grid", prepared),
  });
  const customWorkspace = useCustomWorkspace({
    model: customModel,
    interactionState: customInteractionState,
    onRequestParamImport,
    onRequestReset: () => onRequestReset("custom"),
    onRequestDraftLoad: (prepared) => onRequestDraftLoad("custom", prepared),
  });
  const baseConverterWorkspace = useBaseConverterWorkspace({
    model: baseConverterModel,
    onRequestParamImport,
    onRequestReset: () => onRequestReset("base-converter"),
    onRequestDraftLoad: (prepared) =>
      onRequestDraftLoad("base-converter", prepared),
  });
  const steppedWorkspace = useSteppedWorkspace({
    model: steppedModel,
    interactionState: steppedInteractionState,
    onRequestParamImport,
    onRequestReset: () => onRequestReset("stepped"),
    onRequestDraftLoad: (prepared) => onRequestDraftLoad("stepped", prepared),
  });

  const getWorkspace = useCallback((requestedMode: AppMode): ModeWorkspace => {
    switch (requestedMode) {
      case "grid":
        return gridWorkspace;
      case "custom":
        return customWorkspace;
      case "base-converter":
        return baseConverterWorkspace;
      case "stepped":
        return steppedWorkspace;
      default: {
        const unreachableMode: never = requestedMode;
        throw new Error(`Unsupported workspace mode: ${String(unreachableMode)}`);
      }
    }
  }, [
    customWorkspace,
    baseConverterWorkspace,
    gridWorkspace,
    steppedWorkspace,
  ]);
  const activeWorkspace = useMemo(
    () => getWorkspace(mode),
    [getWorkspace, mode],
  );

  const getReplacementTarget = useCallback((targetMode: AppMode) => {
    switch (targetMode) {
      case "grid":
        return gridWorkspace.replacementTarget;
      case "custom":
        return customWorkspace.replacementTarget;
      case "base-converter":
        return baseConverterWorkspace.replacementTarget;
      case "stepped":
        return steppedWorkspace.replacementTarget;
      default: {
        const unreachableMode: never = targetMode;
        throw new Error(`Unsupported import mode: ${String(unreachableMode)}`);
      }
    }
  }, [
    customWorkspace.replacementTarget,
    baseConverterWorkspace.replacementTarget,
    gridWorkspace.replacementTarget,
    steppedWorkspace.replacementTarget,
  ]);

  return {
    activeWorkspace,
    getWorkspace,
    getReplacementTarget,
  };
}
