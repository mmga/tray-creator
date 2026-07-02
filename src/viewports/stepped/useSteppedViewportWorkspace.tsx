"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { UseSteppedLayoutReturn } from "@/hooks/useSteppedLayout";
import type { UseSteppedCadLayoutReturn } from "@/hooks/useSteppedCadLayout";
import { buildSteppedLayoutEditorViewportModel } from "@/viewports/layout-editor/steppedViewportModel";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { AppMode } from "@/types/custom-tray";

const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), {
  ssr: false,
});

interface UseSteppedViewportWorkspaceOptions {
  model: UseSteppedLayoutReturn | UseSteppedCadLayoutReturn;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
  mode?: Extract<AppMode, "stepped" | "stepped-cad">;
  supportsSplitPreview?: boolean;
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
  mode = "stepped",
  supportsSplitPreview = false,
}: UseSteppedViewportWorkspaceOptions): UseSteppedViewportWorkspaceReturn {
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);
  const splitPreviewParts =
    "splitPreviewParts" in model ? model.splitPreviewParts : undefined;
  const isGeneratingSplitPreview =
    "isGeneratingSplitPreview" in model
      ? model.isGeneratingSplitPreview
      : undefined;
  const generateSplitPreviewHandler =
    supportsSplitPreview && "handleGenerateSplitPreview" in model
      ? model.handleGenerateSplitPreview
      : undefined;

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
    [mode, model, previewGroupId, rightView],
  );

  const viewport = useMemo(
    () => (
      <ViewportTabs
        rightView={rightView}
        onRightViewChange={onRightViewChange}
        canvas={canvas}
        threeGeometry={model.threeGeometry}
        splitParts={splitPreviewParts}
        isGeneratingSplitPreview={isGeneratingSplitPreview}
        isPreviewStale={model.isPreviewStale}
        isGenerating={model.isGenerating}
        onGenerate={model.handleGenerate}
        onGenerateSplitPreview={generateSplitPreviewHandler}
      />
    ),
    [
      canvas,
      generateSplitPreviewHandler,
      isGeneratingSplitPreview,
      model.handleGenerate,
      model.isGenerating,
      model.isPreviewStale,
      model.threeGeometry,
      onRightViewChange,
      rightView,
      splitPreviewParts,
    ],
  );

  return {
    workspace: {
      mode,
      viewport,
      resetTransientState: resetSteppedViewportState,
    },
    selectedSlotIds,
    previewGroupId,
    setPreviewGroupId,
    resetSteppedViewportState,
  };
}
