"use client";

import { useCallback, useMemo, useState } from "react";
import { useModeEditorWorkspaces } from "@/hooks/useModeEditorWorkspaces";
import type { AppMode } from "@/types/custom-tray";

export type ModeEditorIntent = { type: "switch-mode"; mode: AppMode };

export interface ModeEditor {
  readonly active: {
    readonly mode: AppMode;
    readonly panel: React.ReactNode;
    readonly viewport: React.ReactNode;
    readonly overlays: React.ReactNode;
  };
  perform: (intent: ModeEditorIntent) => void;
}

/**
 * 页面唯一的 Mode 生命周期入口。
 * Workspace 与 Viewport 的具体装配暂由下层 Hook 保持，页面不再拥有 active Mode。
 */
export function useModeEditor(initialMode: AppMode = "grid"): ModeEditor {
  const [mode, setMode] = useState<AppMode>(initialMode);
  const { activeWorkspace, activeViewport, importOverlay } =
    useModeEditorWorkspaces({ mode, onModeChange: setMode });

  const perform = useCallback((intent: ModeEditorIntent) => {
    if (intent.type === "switch-mode" && intent.mode !== mode) {
      activeViewport.deactivate();
      setMode(intent.mode);
    }
  }, [activeViewport, mode]);

  return useMemo(() => ({
    active: {
      mode,
      panel: activeWorkspace.panel,
      viewport: activeViewport.viewport,
      overlays: <>{activeWorkspace.overlays}{importOverlay}</>,
    },
    perform,
  }), [activeViewport.viewport, activeWorkspace.overlays, activeWorkspace.panel, importOverlay, mode, perform]);
}
