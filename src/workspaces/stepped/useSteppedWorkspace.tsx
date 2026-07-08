"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import { useWorkspaceDraftSupport } from "@/workspaces/shared";
import type { ModeWorkspace } from "@/workspaces/types";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { AppMode } from "@/types/custom-tray";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import type { UseSteppedLayoutReturn } from "@/hooks/useSteppedLayout";
import type { UseSteppedCadLayoutReturn } from "@/hooks/useSteppedCadLayout";

const SteppedPanel = dynamic(() => import("@/components/SteppedPanel"), {
  ssr: false,
});

interface UseSteppedWorkspaceOptions {
  model: UseSteppedLayoutReturn | UseSteppedCadLayoutReturn;
  interactionState: ModeInteractionState;
  mode?: Extract<AppMode, "stepped" | "stepped-cad">;
  enableSplitExport?: boolean;
}

export function useSteppedWorkspace({
  model,
  interactionState,
  mode = "stepped",
  enableSplitExport = false,
}: UseSteppedWorkspaceOptions): ModeWorkspace {
  const {
    selectedSlotIds,
    previewGroupId,
    setPreviewGroupId,
    resetInteractionState,
  } = interactionState;
  const exportSplitPartsHandler =
    enableSplitExport && "handleExportSplitParts" in model
      ? model.handleExportSplitParts
      : undefined;
  const updateGroupSplitPartTargetHandler =
    "updateGroupSplitPartTarget" in model
      ? model.updateGroupSplitPartTarget
      : undefined;

  const { draftActions, draftDialogProps, clearDraftBinding } =
    useWorkspaceDraftSupport({
      mode: "stepped",
      params: model.params,
      setParams: model.setParams,
      onAfterLoad: resetInteractionState,
    });

  const resetWorkspace = useCallback(() => {
    model.setParams(STEPPED_LAYOUT_DEFAULTS);
    resetInteractionState();
    clearDraftBinding();
  }, [clearDraftBinding, model, resetInteractionState]);

  const importIntoWorkspace = useCallback((params: unknown) => {
    model.setParams(params as SteppedLayoutParams);
    resetInteractionState();
    clearDraftBinding();
  }, [clearDraftBinding, model, resetInteractionState]);

  const panel = useMemo(
    () => (
      <SteppedPanel
        params={model.params}
        mode={mode}
        effectiveDimensions={model.effectiveDimensions}
        isPreviewStale={model.isPreviewStale}
        setParams={model.setParams}
        onResetParams={resetWorkspace}
        onImportParams={importIntoWorkspace}
        updateParam={model.updateParam}
        onAddSlot={model.addSlot}
        onGenerate={model.handleGenerate}
        onExportSTL={model.handleExportSTL}
        onExportSplitParts={exportSplitPartsHandler}
        isGenerating={model.isGenerating}
        volume={model.volume}
        selectedSlotIds={selectedSlotIds}
        onAddGroup={model.addGroup}
        onRemoveGroup={model.removeGroup}
        onUpdateGroupHeight={model.updateGroupHeight}
        onUpdateGroupSmoothingOverride={model.updateGroupSmoothingOverride}
        onUpdateGroupSmoothingRadius={model.updateGroupSmoothingRadius}
        onUpdateGroupDisconnectOverride={model.updateGroupDisconnectOverride}
        onUpdateGroupDisconnectDistance={model.updateGroupDisconnectDistance}
        onUpdateGroupSplitPartTarget={updateGroupSplitPartTargetHandler}
        onSetActiveGroup={model.setActiveGroup}
        onMoveSelectedSlotsToGroup={model.moveSelectedSlotsToGroup}
        onReorderGroups={model.reorderGroups}
        previewGroupId={previewGroupId}
        onPreviewGroupChange={setPreviewGroupId}
        bridgeWarning={model.bridgeWarning}
        optimizationProposals={model.optimizationProposals}
        isOptimizingLayout={model.isOptimizingLayout}
        onGenerateOptimizationProposals={model.generateOptimizationProposals}
        onApplyOptimizationProposal={model.applyOptimizationProposal}
        onClearOptimizationProposals={model.clearOptimizationProposals}
        draftActions={draftActions}
      />
    ),
    [
      draftActions,
      importIntoWorkspace,
      model.addGroup,
      model.addSlot,
      model.applyOptimizationProposal,
      model.bridgeWarning,
      model.clearOptimizationProposals,
      model.effectiveDimensions,
      model.generateOptimizationProposals,
      model.handleExportSTL,
      model.handleGenerate,
      model.isGenerating,
      model.isOptimizingLayout,
      model.isPreviewStale,
      model.moveSelectedSlotsToGroup,
      mode,
      model.optimizationProposals,
      model.params,
      model.removeGroup,
      model.reorderGroups,
      model.setActiveGroup,
      model.setParams,
      model.updateGroupDisconnectDistance,
      model.updateGroupDisconnectOverride,
      model.updateGroupHeight,
      model.updateGroupSmoothingOverride,
      model.updateGroupSmoothingRadius,
      model.updateParam,
      model.volume,
      enableSplitExport,
      exportSplitPartsHandler,
      previewGroupId,
      resetWorkspace,
      setPreviewGroupId,
      selectedSlotIds,
      updateGroupSplitPartTargetHandler,
    ],
  );

  return {
    mode,
    panel,
    draftDialogProps,
    commands: {
      resetWorkspace,
      importIntoWorkspace,
    },
  };
}
