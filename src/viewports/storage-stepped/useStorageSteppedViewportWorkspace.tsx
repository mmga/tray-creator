"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { UseStorageSteppedReturn } from "@/hooks/useStorageStepped";
import { buildStorageSteppedLayoutEditorViewportModel } from "@/viewports/layout-editor/storageSteppedViewportModel";
import type { ModeViewportWorkspace } from "@/viewports/types";
import { storageSteppedTrayPartId } from "@/lib/storage-stepped-config";

const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), {
  ssr: false,
});

const StorageSteppedViewer = dynamic(
  () => import("@/components/StorageSteppedViewer"),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-live="polite"
        className="flex h-full min-h-[320px] w-full items-center justify-center bg-[#3d3b38] text-muted-foreground"
      >
        <div className="flex flex-col items-center gap-3">
          <div
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary"
          />
          <p className="font-mono text-sm tracking-wider">正在加载装配视图…</p>
        </div>
      </div>
    ),
  },
);

export type StorageSteppedViewportModel = Pick<
  UseStorageSteppedReturn,
  | "params"
  | "persistedParams"
  | "currentStepIndex"
  | "updateSlotPosition"
  | "removeSlot"
  | "removeSlots"
  | "updateSlotRotation"
  | "updateMultipleSlots"
  | "updateMultipleSlotsLive"
  | "insertSlots"
  | "duplicateSlots"
  | "undo"
  | "beginContinuousEdit"
  | "commitContinuousEdit"
  | "cancelContinuousEdit"
  | "parts"
  | "missingPartLabels"
  | "selectedPartId"
  | "setSelectedPartId"
  | "viewMode"
  | "setViewMode"
  | "liftedStepIndex"
  | "setLiftedStepIndex"
  | "isPreviewStale"
  | "isGenerating"
  | "handleGenerate"
>;

interface UseStorageSteppedViewportWorkspaceOptions {
  model: StorageSteppedViewportModel;
  interactionState: ModeInteractionState;
}

export function useStorageSteppedViewportWorkspace({
  model,
  interactionState,
}: UseStorageSteppedViewportWorkspaceOptions): ModeViewportWorkspace<"storage-stepped"> {
  const [rightView, setRightView] = useState<"2d" | "3d">("2d");
  const {
    setSelectedSlotIds,
    resetInteractionState,
  } = interactionState;

  const deactivate = useCallback(() => {
    model.cancelContinuousEdit();
    resetInteractionState();
    model.setLiftedStepIndex(null);
  }, [model, resetInteractionState]);

  const resetForSessionReplacement = useCallback(() => {
    resetInteractionState();
    model.setLiftedStepIndex(null);
    model.setViewMode("assembly");
    model.setSelectedPartId("body");
    setRightView("2d");
  }, [model, resetInteractionState]);

  const canvas = useMemo(
    () => (
      <LayoutCanvas
        key={`storage-stepped-${model.currentStepIndex}`}
        isActive={rightView === "2d"}
        model={buildStorageSteppedLayoutEditorViewportModel({
          params: model.params,
          stepIndex: model.currentStepIndex,
        })}
        commands={{
          updateSlotPosition: model.updateSlotPosition,
          removeSlot: model.removeSlot,
          removeSlots: model.removeSlots,
          updateSlotRotation: model.updateSlotRotation,
          updateMultipleSlots: model.updateMultipleSlots,
          liveUpdateMultipleSlots: model.updateMultipleSlotsLive,
          insertSlots: model.insertSlots,
          duplicateSlots: model.duplicateSlots,
          undo: model.undo,
          beginContinuousEdit: model.beginContinuousEdit,
          commitContinuousEdit: model.commitContinuousEdit,
          cancelContinuousEdit: model.cancelContinuousEdit,
          selectionChanged: setSelectedSlotIds,
        }}
      />
    ),
    [
      model,
      rightView,
      setSelectedSlotIds,
    ],
  );

  const viewer = useMemo(
    () => (
      <StorageSteppedViewer
        parts={model.parts}
        viewMode={model.viewMode}
        onViewModeChange={(mode) => {
          model.setViewMode(mode);
          if (mode === "single" && model.selectedPartId === "body") {
            model.setSelectedPartId(storageSteppedTrayPartId(model.currentStepIndex));
          }
        }}
        selectedPartId={model.selectedPartId}
        onSelectPart={model.setSelectedPartId}
        liftedStepIndex={model.liftedStepIndex}
        onLiftChange={model.setLiftedStepIndex}
        isStale={model.isPreviewStale}
        isGenerating={model.isGenerating}
        onGenerate={() => void model.handleGenerate()}
        missingPartLabels={model.missingPartLabels}
      />
    ),
    [model],
  );

  const viewport = useMemo(
    () => (
      <Tabs
        value={rightView}
        activationMode="manual"
        onValueChange={(value) => {
          const next = value as "2d" | "3d";
          setRightView(next);
          if (next === "3d" && model.isPreviewStale && !model.isGenerating) {
            void model.handleGenerate();
          }
        }}
        className="relative flex flex-1 flex-col"
      >
        <div className="absolute left-5 top-3 z-20 flex items-center gap-2">
          <TabsList className="border border-[#2e2a24] bg-[#1c1a16]">
            <TabsTrigger value="2d" className="text-xs">
              2D 编辑
            </TabsTrigger>
            <TabsTrigger value="3d" className="text-xs">
              3D 装配
            </TabsTrigger>
          </TabsList>
          <span className="hidden border border-[#2e2a24] bg-[#12110e]/90 px-2 py-1 font-mono text-[10px] text-muted-foreground sm:inline">
            第 {model.currentStepIndex + 1} 阶 · {model.params.trays[model.currentStepIndex]?.slots.length ?? 0} 槽
          </span>
        </div>

        <div
          aria-hidden={rightView === "2d" ? undefined : "true"}
          inert={rightView === "2d" ? undefined : true}
          className={`absolute inset-0 m-0 p-0 transition-opacity duration-150 ${
            rightView === "2d" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="h-full w-full border-t border-[#2e2a24]">{canvas}</div>
        </div>

        <div
          className={`absolute inset-0 m-0 transition-opacity duration-150 ${
            rightView === "3d" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {rightView === "3d" ? viewer : null}
        </div>
      </Tabs>
    ),
    [canvas, model, rightView, viewer],
  );

  useEffect(() => {
    if (rightView !== "2d") {
      model.cancelContinuousEdit();
    }
  }, [model, rightView]);

  return {
    mode: "storage-stepped",
    viewport,
    deactivate,
    resetForSessionReplacement,
  };
}
