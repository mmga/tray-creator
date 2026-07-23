"use client";

import { useCallback, useMemo } from "react";
import type { useCustomLayout } from "@/hooks/useCustomLayout";
import type { useBaseConverter } from "@/hooks/useBaseConverter";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { useSteppedLayout } from "@/hooks/useSteppedLayout";
import type { useTrayModel } from "@/hooks/useTrayModel";
import { useCustomViewportWorkspace } from "@/viewports/custom/useCustomViewportWorkspace";
import { useBaseConverterViewportWorkspace } from "@/viewports/base-converter/useBaseConverterViewportWorkspace";
import { useGridViewportWorkspace } from "@/viewports/grid/useGridViewportWorkspace";
import { useSteppedViewportWorkspace } from "@/viewports/stepped/useSteppedViewportWorkspace";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { AppMode } from "@/types/custom-tray";

interface UseModeViewportWorkspacesOptions {
  mode: AppMode;
  gridModel: ReturnType<typeof useTrayModel>;
  customModel: ReturnType<typeof useCustomLayout>;
  baseConverterModel: ReturnType<typeof useBaseConverter>;
  steppedModel: ReturnType<typeof useSteppedLayout>;
  customInteractionState: ModeInteractionState;
  steppedInteractionState: ModeInteractionState;
}

interface UseModeViewportWorkspacesReturn {
  activeViewport: ModeViewportWorkspace;
  getViewport: (mode: AppMode) => ModeViewportWorkspace;
}

export function useModeViewportWorkspaces({
  mode,
  gridModel,
  customModel,
  baseConverterModel,
  steppedModel,
  customInteractionState,
  steppedInteractionState,
}: UseModeViewportWorkspacesOptions): UseModeViewportWorkspacesReturn {
  const gridViewport = useGridViewportWorkspace({
    model: gridModel,
  });
  const customViewport = useCustomViewportWorkspace({
    model: customModel,
    interactionState: customInteractionState,
  });
  const baseConverterViewport = useBaseConverterViewportWorkspace({
    model: baseConverterModel,
  });
  const steppedViewport = useSteppedViewportWorkspace({
    model: steppedModel,
    interactionState: steppedInteractionState,
    splitPreview: steppedModel.params.enableSplitAssembly ? {
      parts: steppedModel.splitPreviewParts,
      isGenerating: steppedModel.isGeneratingSplitPreview,
      generate: steppedModel.handleGenerateSplitPreview,
    } : undefined,
  });

  const getViewport = useCallback((requestedMode: AppMode): ModeViewportWorkspace => {
    switch (requestedMode) {
      case "grid":
        return gridViewport;
      case "custom":
        return customViewport;
      case "base-converter":
        return baseConverterViewport;
      case "stepped":
        return steppedViewport.workspace;
      default: {
        const unreachableMode: never = requestedMode;
        throw new Error(`Unsupported viewport mode: ${String(unreachableMode)}`);
      }
    }
  }, [
    customViewport,
    baseConverterViewport,
    gridViewport,
    steppedViewport.workspace,
  ]);
  const activeViewport = useMemo(
    () => getViewport(mode),
    [getViewport, mode],
  );

  return {
    activeViewport,
    getViewport,
  };
}
