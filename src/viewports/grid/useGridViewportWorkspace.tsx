"use client";

import { useCallback, useMemo, useState } from "react";
import type { useTrayModel } from "@/hooks/useTrayModel";
import { GridLayoutPreview } from "@/components/GridLayoutPreview";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";
import { useManualSplitViewport } from "@/viewports/shared/useManualSplitViewport";

interface UseGridViewportWorkspaceOptions { model: ReturnType<typeof useTrayModel>; }

export function useGridViewportWorkspace({
  model,
}: UseGridViewportWorkspaceOptions): ModeViewportWorkspace<"grid"> {
  const [rightView, setRightView] = useState<"2d" | "3d">("2d");
  const { close, action, canvas } = useManualSplitViewport({
    snapshot: { mode: "grid", params: model.params },
    onChange: (settings) => model.updateParam("manualSplit", settings),
    onUndo: model.undo,
    canUndo: model.canUndo,
    blockingReason: model.blockingReason,
    onOpen: () => setRightView("2d"),
  });
  const resetForSessionReplacement = useCallback(() => { close(); setRightView("2d"); }, [close]);

  const twoDView = useMemo(
    () => <GridLayoutPreview params={model.params} />,
    [model.params],
  );
  const viewport = useMemo(
    () => (
      <ViewportTabs
        rightView={rightView}
        onRightViewChange={setRightView}
        canvas={canvas ?? twoDView}
        canvasActions={action}
        threeGeometry={model.threeGeometry}
        isPreviewStale={model.isPreviewStale}
        isGenerating={model.isGenerating}
        onGenerate={model.handleGenerate}
      />
    ),
    [
      model.handleGenerate,
      model.isGenerating,
      model.isPreviewStale,
      model.threeGeometry,
      action,
      canvas,
      rightView,
      twoDView,
    ],
  );

  return {
    mode: "grid",
    viewport,
    deactivate: close,
    resetForSessionReplacement,
  };
}
