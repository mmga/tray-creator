"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { useCustomLayout } from "@/hooks/useCustomLayout";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";

const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), {
  ssr: false,
});

interface UseCustomViewportWorkspaceOptions {
  model: ReturnType<typeof useCustomLayout>;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
}

export function useCustomViewportWorkspace({
  model,
  rightView,
  onRightViewChange,
}: UseCustomViewportWorkspaceOptions): ModeViewportWorkspace {
  const resetTransientState = useCallback(() => {}, []);

  const canvas = useMemo(
    () => (
      <LayoutCanvas
        key="custom"
        isActive={rightView === "2d"}
        params={model.params}
        onUpdateSlot={model.updateSlotPosition}
        onRemoveSlot={model.removeSlot}
        onUpdateSlotRotation={model.updateSlotRotation}
        onUpdateMultipleSlots={model.updateMultipleSlots}
        onLiveUpdateMultipleSlots={model.updateMultipleSlotsLive}
        onInsertSlots={model.insertSlots}
        onDuplicateSlots={model.duplicateSlots}
        onUndo={model.undo}
        onSaveSnapshot={model.saveSnapshot}
      />
    ),
    [
      model.duplicateSlots,
      model.insertSlots,
      model.params,
      model.removeSlot,
      model.saveSnapshot,
      model.undo,
      model.updateMultipleSlots,
      model.updateMultipleSlotsLive,
      model.updateSlotPosition,
      model.updateSlotRotation,
      rightView,
    ],
  );

  const viewport = useMemo(
    () => (
      <ViewportTabs
        rightView={rightView}
        onRightViewChange={onRightViewChange}
        canvas={canvas}
        threeGeometry={model.threeGeometry}
        isPreviewStale={model.isPreviewStale}
        isGenerating={model.isGenerating}
        onGenerate={model.handleGenerate}
      />
    ),
    [
      canvas,
      model.handleGenerate,
      model.isGenerating,
      model.isPreviewStale,
      model.threeGeometry,
      onRightViewChange,
      rightView,
    ],
  );

  return {
    mode: "custom",
    viewport,
    resetTransientState,
  };
}
