"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import { useWorkspaceDraftSupport } from "@/workspaces/shared";
import type { ModeWorkspace } from "@/workspaces/types";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import type { UseSteppedLayoutReturn } from "@/hooks/useSteppedLayout";

const SteppedLayoutPanel = dynamic(() =>
  import("@/components/SteppedPanel").then((mod) => mod.SteppedLayoutPanel), {
  ssr: false,
});

interface UseSteppedWorkspaceOptions {
  model: UseSteppedLayoutReturn;
  interactionState: ModeInteractionState;
}

export function useSteppedWorkspace({
  model,
  interactionState,
}: UseSteppedWorkspaceOptions): ModeWorkspace {
  const {
    selectedSlotIds,
    previewGroupId,
    setPreviewGroupId,
    resetInteractionState,
  } = interactionState;
  const { draftActions, overlays, clearDraftBinding } =
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
      <SteppedLayoutPanel
        params={model.params}
        effectiveDimensions={model.effectiveDimensions}
        isPreviewStale={model.isPreviewStale}
        setParams={model.setParams}
        onResetParams={resetWorkspace}
        onImportParams={importIntoWorkspace}
        updateParam={model.updateParam}
        onAddSlot={model.addSlot}
        onGenerate={model.handleGenerate}
        onExportSTL={model.handleExportSTL}
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
      previewGroupId,
      resetWorkspace,
      setPreviewGroupId,
      selectedSlotIds,
    ],
  );

  return {
    panel,
    overlays,
  };
}
