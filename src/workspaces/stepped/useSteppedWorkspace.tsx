"use client";

import { useCallback, useEffect, useMemo } from "react";
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
import { available, modelExportAvailability, modelGenerationAvailability, type DraftActionResult, type SteppedDraftActionAreaAdapter } from "@/workspaces/draft-action-area";

const SteppedLayoutPanel = dynamic(() =>
  import("@/components/SteppedPanel").then((mod) => mod.SteppedLayoutPanel), {
  ssr: false,
});

interface UseSteppedWorkspaceOptions {
  model: UseSteppedLayoutReturn;
  interactionState: ModeInteractionState;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
  onRequestReset: () => void;
  onRequestDraftLoad: Parameters<
    typeof useWorkspaceDraftSupport<"stepped">
  >[0]["requestDraftLoad"];
}

export function useSteppedWorkspace({
  model,
  interactionState,
  onRequestParamImport,
  onRequestReset,
  onRequestDraftLoad,
}: UseSteppedWorkspaceOptions): ModeWorkspace<"stepped"> {
  const {
    selectedSlotIds,
    previewGroupId,
    setPreviewGroupId,
    activeSteppedGroupId,
    setActiveSteppedGroupId,
    resetInteractionState,
  } = interactionState;
  const persistedParams = model.persistedParams ?? model.params;
  useEffect(() => {
    if (
      activeSteppedGroupId === null ||
      !persistedParams.groups.some((group) => group.id === activeSteppedGroupId)
    ) {
      setActiveSteppedGroupId(persistedParams.groups[0]?.id ?? null);
    }
  }, [activeSteppedGroupId, persistedParams.groups, setActiveSteppedGroupId]);
  const {
    draftActions,
    overlays,
    clearDraftBinding,
    prepareDraftLoad,
    commitLoadedDraftBinding,
  } =
    useWorkspaceDraftSupport({
      mode: "stepped",
      params: persistedParams,
      requestDraftLoad: onRequestDraftLoad,
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
      const canExportSplit = persistedParams.enableSplitAssembly && persistedParams.groups.length >= 2 && persistedParams.slots.length > 0;
      const adapter: SteppedDraftActionAreaAdapter = {
        kind: "stepped",
        state: {
          currentDraftId: draftActions.currentDraftId,
          hasUnsavedChanges: draftActions.hasUnsavedChanges,
          stale: model.isPreviewStale,
          generate: modelGenerationAvailability(model.isGenerating, model.baseHoleFitBlockingReason),
          exportWhole: modelExportAvailability(model.baseHoleFitBlockingReason),
          exportSplit: model.baseHoleFitBlockingReason
            ? { state: "blocked", reason: model.baseHoleFitBlockingReason }
            : canExportSplit
              ? available
              : { state: "blocked", reason: persistedParams.enableSplitAssembly
                ? "至少需要两个分组且存在凹槽"
                : "请先启用分件与装配" },
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
              case "export-params": exportParams(captureModeParamSnapshot("stepped", persistedParams)); break;
              case "import-params": return onRequestParamImport(intent.file);
              case "reset": onRequestReset(); break;
            }
            return { status: "success" };
          } catch (error) {
            return { status: "error", message: `操作失败：${error instanceof Error ? error.message : "未知错误"}` };
          }
        },
      };
      return <PanelActionSection adapter={adapter} />;
    },
    [draftActions, model, onRequestParamImport, onRequestReset, persistedParams],
  );

  const panel = useMemo(
    () => (
      <SteppedLayoutPanel
        params={model.params}
        effectiveDimensions={model.effectiveDimensions}
        committedContouredFootprints={model.committedContouredFootprints}
        contouredConstructionError={model.contouredConstructionError}
        isPreviewStale={model.isPreviewStale}
        setParams={model.setParams}
        actions={actions}
        updateParam={model.updateParam}
        onAddSlot={(width, height, ellipseConfig) =>
          model.addSlot(
            width,
            height,
            ellipseConfig,
            activeSteppedGroupId ?? persistedParams.groups[0]?.id,
          )
        }
        isGenerating={model.isGenerating}
        volume={model.volume}
        baseHoleFitViolations={model.baseHoleFitViolations}
        selectedSlotIds={selectedSlotIds}
        activeGroupId={activeSteppedGroupId}
        previewParam={model.previewParam}
        updateSplitParam={model.updateSplitParam}
        previewSplitParam={model.previewSplitParam}
        onSetSplitGrooveType={model.setSplitGrooveType}
        onPreviewGroupHeight={model.previewGroupHeight}
        onPreviewGroupSmoothingRadius={model.previewGroupSmoothingRadius}
        onPreviewGroupDisconnectDistance={model.previewGroupDisconnectDistance}
        onBeginContinuousEdit={model.beginContinuousEdit}
        onCommitContinuousEdit={model.commitContinuousEdit}
        onCancelContinuousEdit={model.cancelContinuousEdit}
        onAddGroup={() => {
          const groupId = model.addGroup();
          if (groupId) setActiveSteppedGroupId(groupId);
        }}
        onRemoveGroup={model.removeGroup}
        onUpdateGroupHeight={model.updateGroupHeight}
        onUpdateGroupSmoothingOverride={model.updateGroupSmoothingOverride}
        onUpdateGroupSmoothingRadius={model.updateGroupSmoothingRadius}
        onUpdateGroupDisconnectOverride={model.updateGroupDisconnectOverride}
        onUpdateGroupDisconnectDistance={model.updateGroupDisconnectDistance}
        onSetActiveGroup={setActiveSteppedGroupId}
        onMoveSelectedSlotsToGroup={model.moveSelectedSlotsToGroup}
        onReorderGroups={model.reorderGroups}
        onUpdateGroupSplitPartTarget={model.updateGroupSplitPartTarget}
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
      activeSteppedGroupId,
      model,
      persistedParams.groups,
      previewGroupId,
      selectedSlotIds,
      setActiveSteppedGroupId,
      setPreviewGroupId,
    ],
  );

  return {
    mode: "stepped",
    panel,
    overlays,
    replacementTarget: {
      mode: "stepped",
      currentDraftId: draftActions.currentDraftId,
      hasUnsavedChanges: draftActions.hasUnsavedChanges,
      paramsRevision: model.transactionRevision ?? 0,
      prepareDraftLoad,
      commitReset: resetWorkspace,
      commitImport: importIntoWorkspace,
      commitDraftLoad: (prepared) => {
        model.setParams(prepared.snapshot.params);
        resetInteractionState();
        commitLoadedDraftBinding(prepared);
      },
    },
  };
}
