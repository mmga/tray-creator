"use client";

import { useCallback, useMemo } from "react";
import type { useTrayModel } from "@/hooks/useTrayModel";
import { GridLayoutPreview } from "@/components/GridLayoutPreview";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";

interface UseGridViewportWorkspaceOptions {
  model: ReturnType<typeof useTrayModel>;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
}

export function useGridViewportWorkspace({
  model,
  rightView,
  onRightViewChange,
}: UseGridViewportWorkspaceOptions): ModeViewportWorkspace {
  const resetTransientState = useCallback(() => {}, []);

  const twoDView = useMemo(
    () => <GridLayoutPreview params={model.params} />,
    [model.params],
  );
  const viewport = useMemo(
    () => (
      <ViewportTabs
        rightView={rightView}
        onRightViewChange={onRightViewChange}
        canvas={twoDView}
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
      onRightViewChange,
      rightView,
      twoDView,
    ],
  );

  return {
    mode: "grid",
    viewport,
    resetTransientState,
  };
}
