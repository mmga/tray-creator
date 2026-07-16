"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { useCustomLayout } from "@/hooks/useCustomLayout";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import { buildCustomLayoutEditorViewportModel } from "@/viewports/layout-editor/customViewportModel";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";

const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), {
  ssr: false,
});

interface UseCustomViewportWorkspaceOptions {
  model: ReturnType<typeof useCustomLayout>;
  interactionState: ModeInteractionState;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
}

export function useCustomViewportWorkspace({
  model,
  interactionState,
  rightView,
  onRightViewChange,
}: UseCustomViewportWorkspaceOptions): ModeViewportWorkspace {
  const resetTransientState = interactionState.resetInteractionState;

  const canvas = useMemo(
    () => (
      <LayoutCanvas
        key="custom"
        isActive={rightView === "2d"}
        model={buildCustomLayoutEditorViewportModel(model.params)}
        commands={{
          updateSlotPosition: model.updateSlotPosition,
          removeSlot: model.removeSlot,
          updateSlotRotation: model.updateSlotRotation,
          updateMultipleSlots: model.updateMultipleSlots,
          liveUpdateMultipleSlots: model.updateMultipleSlotsLive,
          insertSlots: model.insertSlots,
          duplicateSlots: model.duplicateSlots,
          undo: model.undo,
          saveSnapshot: model.saveSnapshot,
          selectionChanged: interactionState.setSelectedSlotIds,
        }}
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
      interactionState.setSelectedSlotIds,
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
