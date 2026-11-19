"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { useCustomLayout } from "@/hooks/useCustomLayout";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import { buildCustomLayoutEditorViewportModel } from "@/viewports/layout-editor/customViewportModel";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";
import { useManualSplitViewport } from "@/viewports/shared/useManualSplitViewport";

const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), {
  ssr: false,
});

interface UseCustomViewportWorkspaceOptions {
  model: ReturnType<typeof useCustomLayout>;
  interactionState: ModeInteractionState;
}

export function useCustomViewportWorkspace({
  model,
  interactionState,
}: UseCustomViewportWorkspaceOptions): ModeViewportWorkspace<"custom"> {
  const [rightView, setRightView] = useState<"2d" | "3d">("2d");
  const { close, action, canvas: splitCanvas, editing } = useManualSplitViewport({
    snapshot: { mode: "custom", params: model.persistedParams ?? model.params },
    onChange: (settings) => model.updateParam("manualSplit", settings),
    onUndo: model.undo,
    canUndo: model.canUndo,
    blockingReason: model.blockingReason,
    onOpen: () => {
      model.cancelContinuousEdit();
      interactionState.resetInteractionState();
      setRightView("2d");
    },
  });
  const setContouredWorkingPreviewEnabled =
    model.setContouredWorkingPreviewEnabled;
  useEffect(() => {
    setContouredWorkingPreviewEnabled?.(rightView === "2d" && !editing);
  }, [rightView, editing, setContouredWorkingPreviewEnabled]);
  const deactivate = useCallback(() => {
    model.cancelContinuousEdit();
    interactionState.resetInteractionState();
    close();
  }, [interactionState, model, close]);
  const resetForSessionReplacement = useCallback(() => {
    interactionState.resetInteractionState();
    close();
    setRightView("2d");
  }, [interactionState, close]);

  const canvas = useMemo(
    () => (
      <LayoutCanvas
        key="custom"
        isActive={rightView === "2d"}
        model={buildCustomLayoutEditorViewportModel(
          model.params,
          model.workingContouredFootprintState?.status !== "inactive"
            ? (model.workingContouredFootprintState ?? { status: "inactive" })
            : (model.contouredFootprintState ?? { status: "inactive" }),
        )}
        commands={{
          updateSlotPosition: model.updateSlotPosition,
          removeSlot: model.removeSlot,
          updateSlotRotation: model.updateSlotRotation,
          updateMultipleSlots: model.updateMultipleSlots,
          liveUpdateMultipleSlots: model.updateMultipleSlotsLive,
          insertSlots: model.insertSlots,
          duplicateSlots: model.duplicateSlots,
          undo: model.undo,
          beginContinuousEdit: model.beginContinuousEdit,
          commitContinuousEdit: model.commitContinuousEdit,
          cancelContinuousEdit: model.cancelContinuousEdit,
          selectionChanged: interactionState.setSelectedSlotIds,
        }}
      />
    ),
    [
      model.duplicateSlots,
      model.beginContinuousEdit,
      model.cancelContinuousEdit,
      model.commitContinuousEdit,
      model.contouredFootprintState,
      model.insertSlots,
      model.params,
      model.removeSlot,
      model.workingContouredFootprintState,
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
        onRightViewChange={setRightView}
        canvas={splitCanvas ?? canvas}
        canvasActions={action}
        threeGeometry={model.threeGeometry}
        isPreviewStale={model.isPreviewStale}
        isGenerating={model.isGenerating}
        onGenerate={model.handleGenerate}
      />
    ),
    [
      canvas,
      action,
      splitCanvas,
      model.handleGenerate,
      model.isGenerating,
      model.isPreviewStale,
      model.threeGeometry,
      rightView,
    ],
  );

  return {
    mode: "custom",
    viewport,
    deactivate,
    resetForSessionReplacement,
  };
}
