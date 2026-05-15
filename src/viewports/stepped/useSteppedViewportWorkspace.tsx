"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { useSteppedLayout } from "@/hooks/useSteppedLayout";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";

const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), {
  ssr: false,
});

interface UseSteppedViewportWorkspaceOptions {
  model: ReturnType<typeof useSteppedLayout>;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
}

interface UseSteppedViewportWorkspaceReturn {
  workspace: ModeViewportWorkspace;
  selectedSlotIds: string[];
  previewGroupId: string | null;
  setPreviewGroupId: (groupId: string | null) => void;
  resetSteppedViewportState: () => void;
}

export function useSteppedViewportWorkspace({
  model,
  rightView,
  onRightViewChange,
}: UseSteppedViewportWorkspaceOptions): UseSteppedViewportWorkspaceReturn {
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);

  const resetSteppedViewportState = useCallback(() => {
    setSelectedSlotIds([]);
    setPreviewGroupId(null);
  }, []);

  useEffect(() => {
    if (selectedSlotIds.length === 0) {
      return;
    }

    const firstSlotId = selectedSlotIds[0];
    const slot = model.params.slots.find((candidate) => candidate.id === firstSlotId);
    if (slot && "groupId" in slot) {
      model.setActiveGroup(slot.groupId);
    }
  }, [model, selectedSlotIds]);

  const canvas = useMemo(
    () => (
      <LayoutCanvas
        key="stepped"
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
        onSelectionChange={setSelectedSlotIds}
        onEditInteractionChange={(isInteracting) => {
          if (isInteracting) {
            model.pauseOutlinePreview();
          } else {
            model.resumeOutlinePreview();
          }
        }}
        outlinePreview={model.outlinePreview}
        focusedGroupId={previewGroupId}
      />
    ),
    [model, previewGroupId, rightView],
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
    [canvas, model, onRightViewChange, rightView],
  );

  return {
    workspace: {
      mode: "stepped",
      viewport,
      resetTransientState: resetSteppedViewportState,
    },
    selectedSlotIds,
    previewGroupId,
    setPreviewGroupId,
    resetSteppedViewportState,
  };
}
