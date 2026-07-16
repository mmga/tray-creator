"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import { resolveSimpleSteppedSlotMoveScope } from "@/lib/simple-stepped-projection";
import { buildSimpleSteppedLayoutEditorViewportModel } from "@/viewports/layout-editor/simpleSteppedViewportModel";
import { ViewportTabs } from "@/viewports/shared/ViewportTabs";
import type { ModeViewportWorkspace } from "@/viewports/types";

const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), {
  ssr: false,
});

interface UseSimpleSteppedViewportWorkspaceOptions {
  model: ReturnType<typeof useSimpleSteppedLayout>;
  interactionState: ModeInteractionState;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
}

export function useSimpleSteppedViewportWorkspace({
  model,
  interactionState,
  rightView,
  onRightViewChange,
}: UseSimpleSteppedViewportWorkspaceOptions): ModeViewportWorkspace {
  const resetTransientState = interactionState.resetInteractionState;

  const slotMoveScopeResolver = useCallback(
    (draggingId: string, selectedIds: string[]) =>
      resolveSimpleSteppedSlotMoveScope(model.params, draggingId, selectedIds),
    [model.params],
  );

  const slotHeightById = useMemo(
    () =>
      Object.fromEntries(
        model.derivedLayout.activeRows.flatMap((row) =>
          row.slots.map((slot) => [slot.id, row.topHeight] as const),
        ),
      ),
    [model.derivedLayout.activeRows],
  );

  const canvas = useMemo(
    () => (
      <LayoutCanvas
        key="simple-stepped"
        isActive={rightView === "2d"}
        model={buildSimpleSteppedLayoutEditorViewportModel({
          canvasParams: model.canvasParams,
          rowBands: model.derivedLayout.rowBands,
          slotHeightById,
          slotMoveScopeResolver,
        })}
        commands={{
          updateSlotPosition: model.updateSlotPosition,
          removeSlot: model.removeSlot,
          resizeTray: model.resizeTray,
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
      model.canvasParams,
      model.derivedLayout.rowBands,
      model.duplicateSlots,
      model.insertSlots,
      model.removeSlot,
      model.resizeTray,
      model.saveSnapshot,
      model.undo,
      model.updateMultipleSlots,
      model.updateMultipleSlotsLive,
      model.updateSlotPosition,
      model.updateSlotRotation,
      interactionState.setSelectedSlotIds,
      rightView,
      slotHeightById,
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
