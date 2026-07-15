"use client";

import { useCallback, useMemo } from "react";
import type { useCustomLayout } from "@/hooks/useCustomLayout";
import type { useBaseConverter } from "@/hooks/useBaseConverter";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import type { useSteppedLayout } from "@/hooks/useSteppedLayout";
import type { useSteppedCadLayout } from "@/hooks/useSteppedCadLayout";
import type { useTrayModel } from "@/hooks/useTrayModel";
import { useCustomWorkspace } from "@/workspaces/custom/useCustomWorkspace";
import { useBaseConverterWorkspace } from "@/workspaces/base-converter/useBaseConverterWorkspace";
import { useGridWorkspace } from "@/workspaces/grid/useGridWorkspace";
import { useSimpleSteppedWorkspace } from "@/workspaces/simple-stepped/useSimpleSteppedWorkspace";
import { useSteppedWorkspace } from "@/workspaces/stepped/useSteppedWorkspace";
import { useSteppedCadWorkspace } from "@/workspaces/stepped-cad/useSteppedCadWorkspace";
import type { ModeWorkspace } from "@/workspaces/types";
import type { AppMode } from "@/types/custom-tray";
import type { DraftActionResult } from "@/workspaces/draft-action-area";
import type { ModeWorkspaceImportTarget } from "@/workspaces/types";

interface UseModeWorkspacesOptions {
  mode: AppMode;
  gridModel: ReturnType<typeof useTrayModel>;
  customModel: ReturnType<typeof useCustomLayout>;
  baseConverterModel: ReturnType<typeof useBaseConverter>;
  simpleSteppedModel: ReturnType<typeof useSimpleSteppedLayout>;
  steppedModel: ReturnType<typeof useSteppedLayout>;
  steppedCadModel: ReturnType<typeof useSteppedCadLayout>;
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
  simpleSteppedModel,
  steppedModel,
  steppedCadModel,
  steppedInteractionState,
  onRequestParamImport,
}: UseModeWorkspacesOptions): UseModeWorkspacesReturn {
  const gridWorkspace = useGridWorkspace({
    model: gridModel,
    onRequestParamImport,
  });
  const customWorkspace = useCustomWorkspace({
    model: customModel,
    onRequestParamImport,
  });
  const baseConverterWorkspace = useBaseConverterWorkspace({
    model: baseConverterModel,
    onRequestParamImport,
  });
  const simpleSteppedWorkspace = useSimpleSteppedWorkspace({
    model: simpleSteppedModel,
    onRequestParamImport,
  });
  const steppedWorkspace = useSteppedWorkspace({
    model: steppedModel,
    interactionState: steppedInteractionState,
    onRequestParamImport,
  });
  const steppedCadWorkspace = useSteppedCadWorkspace({
    model: steppedCadModel,
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
      case "simple-stepped":
        return simpleSteppedWorkspace;
      case "stepped":
        return steppedWorkspace;
      case "stepped-cad":
        return steppedCadWorkspace;
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
    simpleSteppedWorkspace,
    steppedWorkspace,
    steppedCadWorkspace,
  ]);

  const getImportTarget = useCallback((targetMode: AppMode) => {
    switch (targetMode) {
      case "grid":
        return gridWorkspace.importTarget;
      case "custom":
        return customWorkspace.importTarget;
      case "base-converter":
        return baseConverterWorkspace.importTarget;
      case "simple-stepped":
        return simpleSteppedWorkspace.importTarget;
      case "stepped":
        return steppedWorkspace.importTarget;
      case "stepped-cad":
        return steppedCadWorkspace.importTarget;
      default: {
        const unreachableMode: never = targetMode;
        throw new Error(`Unsupported import mode: ${String(unreachableMode)}`);
      }
    }
  }, [
    customWorkspace.importTarget,
    baseConverterWorkspace.importTarget,
    gridWorkspace.importTarget,
    simpleSteppedWorkspace.importTarget,
    steppedCadWorkspace.importTarget,
    steppedWorkspace.importTarget,
  ]);

  return {
    activeWorkspace,
    getImportTarget,
  };
}
