"use client";

import { useCallback, useMemo } from "react";
import type { useBaseConverter } from "@/hooks/useBaseConverter";
import { BaseConverterPreview } from "@/components/BaseConverterPreview";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";

interface Options {
  model: ReturnType<typeof useBaseConverter>;
  rightView: "2d" | "3d";
  onRightViewChange: (view: "2d" | "3d") => void;
}

export function useBaseConverterViewportWorkspace({
  model,
  rightView,
  onRightViewChange,
}: Options): ModeViewportWorkspace {
  const resetTransientState = useCallback(() => {}, []);
  const twoDView = useMemo(
    () => <BaseConverterPreview params={model.params} />,
    [model.params],
  );
  const viewport = useMemo(() => (
    <ViewportTabs
      rightView={rightView}
      onRightViewChange={onRightViewChange}
      canvas={twoDView}
      threeGeometry={model.threeGeometry}
      isPreviewStale={model.isPreviewStale}
      isGenerating={model.isGenerating}
      onGenerate={model.handleGenerate}
    />
  ), [model.handleGenerate, model.isGenerating, model.isPreviewStale, model.threeGeometry, onRightViewChange, rightView, twoDView]);

  return {
    mode: "base-converter",
    viewport,
    resetTransientState,
  };
}
