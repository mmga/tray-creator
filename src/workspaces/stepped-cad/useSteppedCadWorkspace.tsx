"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { PanelActionSection } from "@/components/PanelActionSection";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import { useWorkspaceDraftSupport } from "@/workspaces/shared";
import type { ModeWorkspace } from "@/workspaces/types";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import type { UseSteppedCadLayoutReturn } from "@/hooks/useSteppedCadLayout";
import { exportParams, importParams } from "@/lib/param-io";
import { available, generatingAvailability, type SteppedCadDraftActionAreaAdapter } from "@/workspaces/draft-action-area";

const SteppedCadPanel = dynamic(() =>
  import("@/components/SteppedPanel").then((mod) => mod.SteppedCadPanel), {
  ssr: false,
});

interface UseSteppedCadWorkspaceOptions {
  model: UseSteppedCadLayoutReturn;
  interactionState: ModeInteractionState;
}

export function useSteppedCadWorkspace({
  model,
  interactionState,
}: UseSteppedCadWorkspaceOptions): ModeWorkspace {
  const {
    selectedSlotIds,
    previewGroupId,
    setPreviewGroupId,
    resetInteractionState,
  } = interactionState;
  // CAD 草稿与普通阶梯共享同一套存储（DraftMode 不含 "stepped-cad"），
  // 仍按 "stepped" 模式落盘，保持向后兼容。
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
      const canExportSplit = model.params.groups.length >= 2 && model.params.slots.length > 0;
      const adapter: SteppedCadDraftActionAreaAdapter = {
        kind: "stepped-cad",
        state: {
          currentDraftId: draftActions.currentDraftId,
          hasUnsavedChanges: draftActions.hasUnsavedChanges,
          stale: model.isPreviewStale,
          generate: generatingAvailability(model.isGenerating),
          exportWhole: available,
          exportSplit: canExportSplit ? available : { state: "blocked", reason: "至少需要两个分组且存在凹槽" },
          preview: { kind: "manual" },
        },
        async perform(intent) {
          try {
            switch (intent.type) {
              case "generate": model.handleGenerate(); break;
              case "export-whole": model.handleExportSTL(); break;
              case "export-split": model.handleExportSplitParts(); break;
              case "save-draft": draftActions.onSaveDraft(); break;
              case "open-drafts": draftActions.onOpenDraftDialog(); break;
              case "export-params": exportParams("stepped-cad", model.params); break;
              case "import-params": importIntoWorkspace(await importParams(intent.file, "stepped-cad")); break;
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
    [draftActions, importIntoWorkspace, model, resetWorkspace],
  );

  const panel = useMemo(
    () => (
      <SteppedCadPanel
        params={model.params}
        effectiveDimensions={model.effectiveDimensions}
        isPreviewStale={model.isPreviewStale}
        setParams={model.setParams}
        actions={actions}
        updateParam={model.updateParam}
        onAddSlot={model.addSlot}
        onUpdateGroupSplitPartTarget={model.updateGroupSplitPartTarget}
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
      model.updateGroupSplitPartTarget,
      model.updateParam,
      model.volume,
      previewGroupId,
      setPreviewGroupId,
      selectedSlotIds,
    ],
  );

  return {
    panel,
    overlays,
  };
}
