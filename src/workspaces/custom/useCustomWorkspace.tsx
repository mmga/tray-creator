"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PanelActionSection } from "@/components/PanelActionSection";
import { useAutoPreview } from "@/hooks/useAutoPreview";
import { useWorkspaceDraftSupport, type WorkspaceDraftActions } from "@/workspaces/shared";
import { modelExportAvailability, modelGenerationAvailability, type AutomaticDraftActionAreaAdapter, type DraftActionResult } from "@/workspaces/draft-action-area";
import { exportParams } from "@/lib/param-download";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type { ModeWorkspace } from "@/workspaces/types";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import type { CustomLayoutParams } from "@/types/custom-tray";
import type { useCustomLayout } from "@/hooks/useCustomLayout";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";

const CustomPanel = dynamic(() => import("@/components/CustomPanel"), {
  ssr: false,
});

interface UseCustomWorkspaceOptions {
  model: ReturnType<typeof useCustomLayout>;
  interactionState: ModeInteractionState;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
}

interface CustomDraftActionAreaProps {
  params: CustomLayoutParams;
  isGenerating: boolean;
  isPreviewStale: boolean;
  blockingReason: string | null;
  onGenerate: () => void;
  onExportSTL: () => void;
  onReset: () => void;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
  draftActions: WorkspaceDraftActions;
}

function CustomDraftActionArea({
  params,
  isGenerating,
  isPreviewStale,
  blockingReason,
  onGenerate,
  onExportSTL,
  onReset,
  onRequestParamImport,
  draftActions,
}: CustomDraftActionAreaProps) {
  const [autoPreview, setAutoPreview] = useState(false);

  useAutoPreview(params, {
    enabled: autoPreview,
    isGenerating,
    isBlocked: Boolean(blockingReason),
    onGenerate,
  });

  const adapter = useMemo<AutomaticDraftActionAreaAdapter>(() => ({
    kind: "automatic",
    state: {
      currentDraftId: draftActions.currentDraftId,
      hasUnsavedChanges: draftActions.hasUnsavedChanges,
      stale: isPreviewStale,
      generate: modelGenerationAvailability(isGenerating, blockingReason),
      exportWhole: modelExportAvailability(blockingReason),
      preview: { kind: "automatic", enabled: autoPreview },
    },
    async perform(intent) {
      try {
        switch (intent.type) {
          case "generate": onGenerate(); break;
          case "export-whole": onExportSTL(); break;
          case "save-draft": draftActions.onSaveDraft(); break;
          case "open-drafts": draftActions.onOpenDraftDialog(); break;
          case "export-params": exportParams(captureModeParamSnapshot("custom", params)); break;
          case "import-params": return onRequestParamImport(intent.file);
          case "reset": onReset(); break;
          case "set-auto-preview": setAutoPreview(intent.enabled); break;
        }
        return { status: "success" };
      } catch (error) {
        return { status: "error", message: `操作失败：${error instanceof Error ? error.message : "未知错误"}` };
      }
    },
  }), [autoPreview, blockingReason, draftActions, isGenerating, isPreviewStale, onExportSTL, onGenerate, onRequestParamImport, onReset, params]);

  return <PanelActionSection adapter={adapter} />;
}

export function useCustomWorkspace({
  model,
  interactionState,
  onRequestParamImport,
}: UseCustomWorkspaceOptions): ModeWorkspace {
  const { draftActions, overlays, clearDraftBinding } =
    useWorkspaceDraftSupport({
      mode: "custom",
      params: model.params,
      setParams: model.setParams,
    });

  const resetWorkspace = useCallback(() => {
    model.setParams(CUSTOM_LAYOUT_DEFAULTS);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const importIntoWorkspace = useCallback((params: CustomLayoutParams) => {
    model.setParams(params);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const actions = useMemo(
    () => (
      <CustomDraftActionArea
        params={model.params}
        isGenerating={model.isGenerating}
        isPreviewStale={model.isPreviewStale}
        blockingReason={model.baseHoleFitBlockingReason}
        onGenerate={model.handleGenerate}
        onExportSTL={model.handleExportSTL}
        onReset={resetWorkspace}
        onRequestParamImport={onRequestParamImport}
        draftActions={draftActions}
      />
    ),
    [
      draftActions,
      model.handleExportSTL,
      model.handleGenerate,
      model.baseHoleFitBlockingReason,
      model.isGenerating,
      model.isPreviewStale,
      model.params,
      onRequestParamImport,
      resetWorkspace,
    ],
  );

  const panel = useMemo(
    () => (
      <CustomPanel
        params={model.params}
        effectiveDimensions={model.effectiveDimensions}
        actions={actions}
        updateParam={model.updateParam}
        onAddSlot={model.addSlot}
        isGenerating={model.isGenerating}
        isPreviewStale={model.isPreviewStale}
        volume={model.volume}
        baseHoleFitViolations={model.baseHoleFitViolations}
        selectedSlotIds={interactionState.selectedSlotIds}
      />
    ),
    [
      actions,
      model.addSlot,
      model.effectiveDimensions,
      model.isGenerating,
      model.isPreviewStale,
      model.params,
      model.updateParam,
      model.volume,
      model.baseHoleFitViolations,
      interactionState.selectedSlotIds,
    ],
  );

  return {
    panel,
    overlays,
    importTarget: {
      currentDraftId: draftActions.currentDraftId,
      hasUnsavedChanges: draftActions.hasUnsavedChanges,
      commit: (params) => importIntoWorkspace(params as CustomLayoutParams),
    },
  };
}
