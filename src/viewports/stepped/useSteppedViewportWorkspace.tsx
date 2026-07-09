"use client";

import { useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { UseSteppedLayoutReturn } from "@/hooks/useSteppedLayout";
import type { TrayViewerSplitPart } from "@/components/TrayViewer";
import { buildSteppedLayoutEditorViewportModel } from "@/viewports/layout-editor/steppedViewportModel";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { AppMode } from "@/types/custom-tray";

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
  mode?: Extract<AppMode, "stepped" | "stepped-cad">;
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
  mode = "stepped",
  splitPreview,
}: UseSteppedViewportWorkspaceOptions): UseSteppedViewportWorkspaceReturn {
  const {
    selectedSlotIds,
    previewGroupId,
    setSelectedSlotIds,
    resetInteractionState,
  } = interactionState;
  const resetTransientState = useCallback(() => {
    resetInteractionState();
  }, [resetInteractionState]);

  useEffect(() => {
    if (selectedSlotIds.length === 0) {
      return;
    }

    const firstSlotId = selectedSlotIds[0];
    const slot = model.params.slots.find((candidate) => candidate.id === firstSlotId);
    if (slot && "groupId" in slot && slot.groupId !== model.params.activeGroupId) {
      model.setActiveGroup(slot.groupId);
    }
  }, [model, selectedSlotIds]);

  const canvas = useMemo(
    () => (
      <LayoutCanvas
        key={mode}
        isActive={rightView === "2d"}
        model={buildSteppedLayoutEditorViewportModel({
          params: model.params,
          focusedGroupId: previewGroupId,
          groupOutlines: model.outlinePreview,
        })}
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
    [mode, model, previewGroupId, rightView, setSelectedSlotIds],
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
      mode,
      viewport,
      resetTransientState,
    },
  };
}
