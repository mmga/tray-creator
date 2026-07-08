"use client";

import { useCustomLayout } from "@/hooks/useCustomLayout";
import { useModeInteractionState } from "@/hooks/useModeInteractionState";
import { useModeViewportWorkspaces } from "@/hooks/useModeViewportWorkspaces";
import { useModeWorkspaces } from "@/hooks/useModeWorkspaces";
import { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import { useSteppedCadLayout } from "@/hooks/useSteppedCadLayout";
import { useSteppedLayout } from "@/hooks/useSteppedLayout";
import { useTrayModel } from "@/hooks/useTrayModel";
import type { AppMode } from "@/types/custom-tray";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { ModeWorkspace } from "@/workspaces/types";

interface UseModeEditorWorkspacesOptions {
  mode: AppMode;
}

interface UseModeEditorWorkspacesReturn {
  activeWorkspace: ModeWorkspace;
  activeViewport: ModeViewportWorkspace;
}

export function useModeEditorWorkspaces({
  mode,
}: UseModeEditorWorkspacesOptions): UseModeEditorWorkspacesReturn {
  const gridModel = useTrayModel();
  const customModel = useCustomLayout();
  const simpleSteppedModel = useSimpleSteppedLayout();
  const steppedModel = useSteppedLayout();
  const steppedCadModel = useSteppedCadLayout();
  const steppedInteractionState = useModeInteractionState();

  const { activeViewport } = useModeViewportWorkspaces({
    mode,
    gridModel,
    customModel,
    simpleSteppedModel,
    steppedModel,
    steppedCadModel,
    steppedInteractionState,
  });

  const { activeWorkspace } = useModeWorkspaces({
    mode,
    gridModel,
    customModel,
    simpleSteppedModel,
    steppedModel,
    steppedCadModel,
    steppedInteractionState,
  });

  return {
    activeWorkspace,
    activeViewport,
  };
}
