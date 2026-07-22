"use client";

import { useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { UseSteppedLayoutReturn } from "@/hooks/useSteppedLayout";
import type { TrayViewerSplitPart } from "@/components/TrayViewer";
import { buildSteppedLayoutEditorViewportModel } from "@/viewports/layout-editor/steppedViewportModel";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";

const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), {
  ssr: false,
});

interface SteppedSplitPreview {
  parts: TrayViewerSplitPart[] | null;
  isGenerating: boolean;
  generate: () => void;
}

interface UseSteppedViewportWorkspaceOptions {
  model: UseSteppedLayoutReturn;
  interactionState: ModeInteractionState;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
  splitPreview?: SteppedSplitPreview;
}

interface UseSteppedViewportWorkspaceReturn {
  workspace: ModeViewportWorkspace;
}

export function useSteppedViewportWorkspace({
  model,
  interactionState,
  rightView,
  onRightViewChange,
  splitPreview,
}: UseSteppedViewportWorkspaceOptions): UseSteppedViewportWorkspaceReturn {
  const {
    selectedSlotIds,
    previewGroupId,
    setSelectedSlotIds,
    activeSteppedGroupId,
    setActiveSteppedGroupId,
    resetInteractionState,
  } = interactionState;
  const persistedParams = model.persistedParams ?? model.params;
  const resetTransientState = useCallback(() => {
    resetInteractionState();
  }, [resetInteractionState]);

  useEffect(() => {
    if (selectedSlotIds.length === 0) {
      return;
    }

    const firstSlotId = selectedSlotIds[0];
    const slot = model.params.slots.find((candidate) => candidate.id === firstSlotId);
    if (slot && "groupId" in slot && slot.groupId !== activeSteppedGroupId) {
      setActiveSteppedGroupId(slot.groupId);
    }
  }, [activeSteppedGroupId, model.params.slots, selectedSlotIds, setActiveSteppedGroupId]);

  const canvas = useMemo(
    () => (
      <LayoutCanvas
        key="stepped"
        isActive={rightView === "2d"}
        model={buildSteppedLayoutEditorViewportModel({
          params: model.params,
          focusedGroupId: previewGroupId,
          groupOutlines: model.outlinePreview,
        })}
        commands={{
          updateSlotPosition: model.updateSlotPosition,
          removeSlot: model.removeSlot,
          removeSlots: model.removeSlots,
          updateSlotRotation: model.updateSlotRotation,
          updateMultipleSlots: model.updateMultipleSlots,
          liveUpdateMultipleSlots: model.updateMultipleSlotsLive,
          insertSlots: (slots) =>
            model.insertSlots(
              slots,
              activeSteppedGroupId ?? persistedParams.groups[0]?.id,
            ),
          duplicateSlots: model.duplicateSlots,
          undo: model.undo,
          beginContinuousEdit: model.beginContinuousEdit,
          commitContinuousEdit: model.commitContinuousEdit,
          cancelContinuousEdit: model.cancelContinuousEdit,
          selectionChanged: setSelectedSlotIds,
          editInteractionChanged: (isInteracting) => {
            if (isInteracting) {
              model.pauseOutlinePreview();
            } else {
              model.resumeOutlinePreview();
            }
          },
        }}
      />
    ),
    [activeSteppedGroupId, model, persistedParams, previewGroupId, rightView, setSelectedSlotIds],
  );

  const viewport = useMemo(
    () => (
      <ViewportTabs
        rightView={rightView}
        onRightViewChange={onRightViewChange}
        canvas={canvas}
        threeGeometry={model.threeGeometry}
        splitParts={splitPreview?.parts}
        isGeneratingSplitPreview={splitPreview?.isGenerating}
        isPreviewStale={model.isPreviewStale}
        isGenerating={model.isGenerating}
        onGenerate={model.handleGenerate}
        onGenerateSplitPreview={splitPreview?.generate}
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
      splitPreview?.generate,
      splitPreview?.isGenerating,
      splitPreview?.parts,
    ],
  );

  return {
    workspace: {
      mode: "stepped",
      viewport,
      resetTransientState,
    },
  };
}
