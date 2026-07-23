"use client";

import { useCallback, useMemo, useState } from "react";
import type { useTrayModel } from "@/hooks/useTrayModel";
import { GridLayoutPreview } from "@/components/GridLayoutPreview";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";

interface UseGridViewportWorkspaceOptions { model: ReturnType<typeof useTrayModel>; }

export function useGridViewportWorkspace({
  model,
}: UseGridViewportWorkspaceOptions): ModeViewportWorkspace<"grid"> {
  const [rightView, setRightView] = useState<"2d" | "3d">("2d");
  const deactivate = useCallback(() => {}, []);
  const resetForSessionReplacement = useCallback(() => setRightView("2d"), []);

  const twoDView = useMemo(
    () => <GridLayoutPreview params={model.params} />,
    [model.params],
  );
  const viewport = useMemo(
    () => (
      <ViewportTabs
        rightView={rightView}
        onRightViewChange={setRightView}
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
      rightView,
      twoDView,
    ],
  );

  return {
    mode: "grid",
    viewport,
    deactivate,
    resetForSessionReplacement,
  };
}
