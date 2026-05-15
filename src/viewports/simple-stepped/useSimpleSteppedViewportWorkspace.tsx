"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";

const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), {
  ssr: false,
});

interface UseSimpleSteppedViewportWorkspaceOptions {
  model: ReturnType<typeof useSimpleSteppedLayout>;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
}

export function useSimpleSteppedViewportWorkspace({
  model,
  rightView,
  onRightViewChange,
}: UseSimpleSteppedViewportWorkspaceOptions): ModeViewportWorkspace {
  const resetTransientState = useCallback(() => {}, []);

  const slotMoveScopeResolver = useCallback(
    (draggingId: string, selectedIds: string[]) => {
      const draggingSlot = model.params.slots.find((slot) => slot.id === draggingId);
      if (!draggingSlot) {
        return [];
      }

      const sameRowSelected = selectedIds.filter((id) => {
        const slot = model.params.slots.find((candidate) => candidate.id === id);
        return slot?.rowId === draggingSlot.rowId;
      });

      if (sameRowSelected.length > 0) {
        return sameRowSelected;
      }

      return [draggingId];
    },
    [model.params.slots],
  );

  const canvas = useMemo(
    () => (
      <LayoutCanvas
        key="simple-stepped"
        isActive={rightView === "2d"}
        params={model.canvasParams}
        onUpdateSlot={model.updateSlotPosition}
        onRemoveSlot={model.removeSlot}
        onResizeTray={model.resizeTray}
        onUpdateSlotRotation={model.updateSlotRotation}
        onUpdateMultipleSlots={model.updateMultipleSlots}
        onLiveUpdateMultipleSlots={model.updateMultipleSlotsLive}
        onDuplicateSlots={model.duplicateSlots}
        onUndo={model.undo}
        onSaveSnapshot={model.saveSnapshot}
        rowBands={model.derivedLayout.rowBands}
        slotMoveScopeResolver={slotMoveScopeResolver}
      />
    ),
    [
      model.canvasParams,
      model.derivedLayout.rowBands,
      model.duplicateSlots,
      model.removeSlot,
      model.resizeTray,
      model.saveSnapshot,
      model.undo,
      model.updateMultipleSlots,
      model.updateMultipleSlotsLive,
      model.updateSlotPosition,
      model.updateSlotRotation,
      rightView,
      slotMoveScopeResolver,
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
    mode: "simple-stepped",
    viewport,
    resetTransientState,
  };
}
