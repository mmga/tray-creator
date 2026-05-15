"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { useTrayModel } from "@/hooks/useTrayModel";
import type { ModeViewportWorkspace } from "@/viewports/types";

const TrayViewer = dynamic(() => import("@/components/TrayViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-[#0a0908]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-muted-foreground/40 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-mono tracking-wider">LOADING FORGE...</p>
      </div>
    </div>
  ),
});

interface UseGridViewportWorkspaceOptions {
  model: ReturnType<typeof useTrayModel>;
}

export function useGridViewportWorkspace({
  model,
}: UseGridViewportWorkspaceOptions): ModeViewportWorkspace {
  const resetTransientState = useCallback(() => {}, []);

  const viewport = useMemo(
    () => (
      <TrayViewer
        geometry={model.threeGeometry}
        isStale={model.isPreviewStale}
        onRegenerate={model.handleGenerate}
      />
    ),
    [model.handleGenerate, model.isPreviewStale, model.threeGeometry],
  );

  return {
    mode: "grid",
    viewport,
    resetTransientState,
  };
}
