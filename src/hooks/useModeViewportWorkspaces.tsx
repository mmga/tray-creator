"use client";

import { useMemo, useState } from "react";
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
  const [rightView, setRightView] = useState<"2d" | "3d">("2d");

  const gridViewport = useGridViewportWorkspace({
    model: gridModel,
    rightView,
    onRightViewChange: setRightView,
  });
  const customViewport = useCustomViewportWorkspace({
    model: customModel,
    interactionState: customInteractionState,
    rightView,
    onRightViewChange: setRightView,
  });
  const baseConverterViewport = useBaseConverterViewportWorkspace({
    model: baseConverterModel,
    rightView,
    onRightViewChange: setRightView,
  });
  const steppedViewport = useSteppedViewportWorkspace({
    model: steppedModel,
    interactionState: steppedInteractionState,
    rightView,
    onRightViewChange: setRightView,
    splitPreview: steppedModel.params.enableSplitAssembly ? {
      parts: steppedModel.splitPreviewParts,
      isGenerating: steppedModel.isGeneratingSplitPreview,
      generate: steppedModel.handleGenerateSplitPreview,
    } : undefined,
  });

  const activeViewport = useMemo<ModeViewportWorkspace>(() => {
    switch (mode) {
      case "grid":
        return gridViewport;
      case "custom":
        return customViewport;
      case "base-converter":
        return baseConverterViewport;
      case "stepped":
        return steppedViewport.workspace;
      default: {
        const unreachableMode: never = mode;
        throw new Error(`Unsupported viewport mode: ${String(unreachableMode)}`);
      }
    }
  }, [
    customViewport,
    baseConverterViewport,
    gridViewport,
    mode,
    steppedViewport.workspace,
  ]);

  return {
    activeViewport,
  };
}
