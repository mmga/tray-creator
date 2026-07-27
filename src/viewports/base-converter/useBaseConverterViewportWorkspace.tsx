"use client";

import { useCallback, useMemo, useState } from "react";
import type { useBaseConverter } from "@/hooks/useBaseConverter";
import { BaseConverterPreview } from "@/components/BaseConverterPreview";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";

interface Options {
  model: ReturnType<typeof useBaseConverter>;
}

export function useBaseConverterViewportWorkspace({
  model,
}: Options): ModeViewportWorkspace<"base-converter"> {
  const [rightView, setRightView] = useState<"2d" | "3d">("2d");
  const deactivate = useCallback(() => {}, []);
  const resetForSessionReplacement = useCallback(() => setRightView("2d"), []);
  const twoDView = useMemo(
    () => <BaseConverterPreview params={model.viewParams} />,
    [model.viewParams],
  );
  const viewport = useMemo(() => (
    <ViewportTabs
      rightView={rightView}
      onRightViewChange={setRightView}
      canvas={twoDView}
      threeGeometry={model.threeGeometry}
      isPreviewStale={model.isPreviewStale}
      isGenerating={model.isGenerating}
      onGenerate={model.handleGenerate}
    />
  ), [model.handleGenerate, model.isGenerating, model.isPreviewStale, model.threeGeometry, rightView, twoDView]);

  return {
    mode: "base-converter",
    viewport,
    deactivate,
    resetForSessionReplacement,
  };
}
