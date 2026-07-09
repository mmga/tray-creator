"use client";

import { useMemo, useState } from "react";
import type { useCustomLayout } from "@/hooks/useCustomLayout";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import type { useSteppedLayout } from "@/hooks/useSteppedLayout";
import type { useSteppedCadLayout } from "@/hooks/useSteppedCadLayout";
import type { useTrayModel } from "@/hooks/useTrayModel";
import { useCustomViewportWorkspace } from "@/viewports/custom/useCustomViewportWorkspace";
import { useGridViewportWorkspace } from "@/viewports/grid/useGridViewportWorkspace";
import { useSimpleSteppedViewportWorkspace } from "@/viewports/simple-stepped/useSimpleSteppedViewportWorkspace";
import { useSteppedViewportWorkspace } from "@/viewports/stepped/useSteppedViewportWorkspace";
import { useSteppedCadViewportWorkspace } from "@/viewports/stepped-cad/useSteppedCadViewportWorkspace";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { AppMode } from "@/types/custom-tray";

interface UseModeViewportWorkspacesOptions {
  mode: AppMode;
  gridModel: ReturnType<typeof useTrayModel>;
  customModel: ReturnType<typeof useCustomLayout>;
  simpleSteppedModel: ReturnType<typeof useSimpleSteppedLayout>;
  steppedModel: ReturnType<typeof useSteppedLayout>;
  steppedCadModel: ReturnType<typeof useSteppedCadLayout>;
  steppedInteractionState: ModeInteractionState;
}

interface UseModeViewportWorkspacesReturn {
  activeViewport: ModeViewportWorkspace;
}

export function useModeViewportWorkspaces({
  mode,
  gridModel,
  customModel,
  simpleSteppedModel,
  steppedModel,
  steppedCadModel,
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
    rightView,
    onRightViewChange: setRightView,
  });
  const simpleSteppedViewport = useSimpleSteppedViewportWorkspace({
    model: simpleSteppedModel,
    rightView,
    onRightViewChange: setRightView,
  });
  const steppedViewport = useSteppedViewportWorkspace({
    model: steppedModel,
    interactionState: steppedInteractionState,
    rightView,
    onRightViewChange: setRightView,
  });
  const steppedCadViewport = useSteppedCadViewportWorkspace({
    model: steppedCadModel,
    interactionState: steppedInteractionState,
    rightView,
    onRightViewChange: setRightView,
  });

  const activeViewport = useMemo<ModeViewportWorkspace>(() => {
    switch (mode) {
      case "grid":
        return gridViewport;
      case "custom":
        return customViewport;
      case "simple-stepped":
        return simpleSteppedViewport;
      case "stepped":
        return steppedViewport.workspace;
      case "stepped-cad":
        return steppedCadViewport.workspace;
      default: {
        const unreachableMode: never = mode;
        throw new Error(`Unsupported viewport mode: ${String(unreachableMode)}`);
      }
    }
  }, [
    customViewport,
    gridViewport,
    mode,
    simpleSteppedViewport,
    steppedViewport.workspace,
    steppedCadViewport.workspace,
  ]);

  return {
    activeViewport,
  };
}
