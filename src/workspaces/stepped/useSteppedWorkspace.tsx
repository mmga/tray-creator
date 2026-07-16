"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { PanelActionSection } from "@/components/PanelActionSection";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import { useWorkspaceDraftSupport } from "@/workspaces/shared";
import type { ModeWorkspace } from "@/workspaces/types";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import type { UseSteppedLayoutReturn } from "@/hooks/useSteppedLayout";
import { exportParams } from "@/lib/param-download";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { modelExportAvailability, modelGenerationAvailability, type DraftActionResult, type ManualDraftActionAreaAdapter } from "@/workspaces/draft-action-area";

const SteppedLayoutPanel = dynamic(() =>
  import("@/components/SteppedPanel").then((mod) => mod.SteppedLayoutPanel), {
  ssr: false,
});

interface UseSteppedWorkspaceOptions {
  model: UseSteppedLayoutReturn;
  interactionState: ModeInteractionState;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
}

export function useSteppedWorkspace({
  model,
  interactionState,
  onRequestParamImport,
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

  const importIntoWorkspace = useCallback((params: SteppedLayoutParams) => {
    model.setParams(params);
    resetInteractionState();
    clearDraftBinding();
  }, [clearDraftBinding, model, resetInteractionState]);

  const actions = useMemo(
    () => {
      const adapter: ManualDraftActionAreaAdapter = {
        kind: "manual",
        state: {
          currentDraftId: draftActions.currentDraftId,
          hasUnsavedChanges: draftActions.hasUnsavedChanges,
          stale: model.isPreviewStale,
          generate: modelGenerationAvailability(model.isGenerating, model.baseHoleFitBlockingReason),
          exportWhole: modelExportAvailability(model.baseHoleFitBlockingReason),
          preview: { kind: "manual" },
        },
        async perform(intent) {
          try {
            switch (intent.type) {
              case "generate": model.handleGenerate(); break;
              case "export-whole": model.handleExportSTL(); break;
              case "save-draft": draftActions.onSaveDraft(); break;
              case "open-drafts": draftActions.onOpenDraftDialog(); break;
              case "export-params": exportParams(captureModeParamSnapshot("stepped", model.params)); break;
              case "import-params": return onRequestParamImport(intent.file);
              case "reset": resetWorkspace(); break;
            }
            return { status: "success" };
          } catch (error) {
            return { status: "error", message: `操作失败：${error instanceof Error ? error.message : "未知错误"}` };
          }
        },
      };
      return <PanelActionSection adapter={adapter} />;
    },
    [draftActions, model, onRequestParamImport, resetWorkspace],
  );

  const panel = useMemo(
    () => (
      <SteppedLayoutPanel
        params={model.params}
        effectiveDimensions={model.effectiveDimensions}
        isPreviewStale={model.isPreviewStale}
        setParams={model.setParams}
        actions={actions}
        updateParam={model.updateParam}
        onAddSlot={model.addSlot}
        isGenerating={model.isGenerating}
        volume={model.volume}
        baseHoleFitViolations={model.baseHoleFitViolations}
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
      />
    ),
    [
      actions,
      model.addGroup,
      model.addSlot,
      model.applyOptimizationProposal,
      model.bridgeWarning,
      model.clearOptimizationProposals,
      model.effectiveDimensions,
      model.generateOptimizationProposals,
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
      model.baseHoleFitViolations,
      previewGroupId,
      setPreviewGroupId,
      selectedSlotIds,
    ],
  );

  return {
    panel,
    overlays,
    importTarget: {
      currentDraftId: draftActions.currentDraftId,
      hasUnsavedChanges: draftActions.hasUnsavedChanges,
      commit: (params) => importIntoWorkspace(params as SteppedLayoutParams),
    },
  };
}
