"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PanelActionSection } from "@/components/PanelActionSection";
import { useAutoPreview } from "@/hooks/useAutoPreview";
import type { useBaseConverter } from "@/hooks/useBaseConverter";
import { downloadParamFile } from "@/lib/param-download";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type { BaseConverterParams } from "@/types/custom-tray";
import { validateBaseConverterParams } from "@/lib/base-converter-config";
import {
  modelExportAvailability,
  modelGenerationAvailability,
  type AutomaticDraftActionAreaAdapter,
  type DraftActionResult,
} from "@/workspaces/draft-action-area";
import {
  useWorkspaceDraftSupport,
  type WorkspaceDraftActions,
} from "@/workspaces/shared";
import type { ModeWorkspace } from "@/workspaces/types";

const BaseConverterPanel = dynamic(
  () => import("@/components/BaseConverterPanel"),
  { ssr: false },
);

interface BaseConverterActionAreaProps {
  params: BaseConverterParams;
  isGenerating: boolean;
  onGenerate: () => void;
  onExportSTL: () => void;
  onReset: () => void;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
  draftActions: WorkspaceDraftActions;
  blockingReason: string | null;
}

function BaseConverterActionArea({
  params,
  isGenerating,
  onGenerate,
  onExportSTL,
  onReset,
  onRequestParamImport,
  draftActions,
  blockingReason,
}: BaseConverterActionAreaProps) {
  const [autoPreview, setAutoPreview] = useState(true);
  useAutoPreview(params, {
    enabled: autoPreview,
    isGenerating,
    isBlocked: blockingReason !== null,
    onGenerate,
    delayMs: 300,
  });

  const adapter = useMemo<AutomaticDraftActionAreaAdapter>(() => ({
    kind: "automatic",
    state: {
      currentDraftId: draftActions.currentDraftId,
      hasUnsavedChanges: draftActions.hasUnsavedChanges,
      stale: false,
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
          case "export-params": downloadParamFile(captureModeParamSnapshot("base-converter", params)); break;
          case "import-params": return onRequestParamImport(intent.file);
          case "reset": onReset(); break;
          case "set-auto-preview": setAutoPreview(intent.enabled); break;
        }
        return { status: "success" };
      } catch (error) {
        return {
          status: "error",
          message: `操作失败：${error instanceof Error ? error.message : "未知错误"}`,
        };
      }
    },
  }), [autoPreview, blockingReason, draftActions, isGenerating, onExportSTL, onGenerate, onRequestParamImport, onReset, params]);

  return <PanelActionSection adapter={adapter} />;
}

interface UseBaseConverterWorkspaceOptions {
  model: ReturnType<typeof useBaseConverter>;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
  onRequestReset: () => void;
  onRequestDraftLoad: Parameters<
    typeof useWorkspaceDraftSupport<"base-converter">
  >[0]["requestDraftLoad"];
}

export function useBaseConverterWorkspace({
  model,
  onRequestParamImport,
  onRequestReset,
  onRequestDraftLoad,
}: UseBaseConverterWorkspaceOptions): ModeWorkspace<"base-converter"> {
  const {
    draftActions,
    overlays,
    clearDraftBinding,
    prepareDraftLoad,
    commitLoadedDraftBinding,
  } =
    useWorkspaceDraftSupport({
      mode: "base-converter",
      params: model.params,
      requestDraftLoad: onRequestDraftLoad,
    });
  const resetWorkspace = useCallback(() => {
    model.resetParams();
    clearDraftBinding();
  }, [clearDraftBinding, model]);
  const importIntoWorkspace = useCallback((params: BaseConverterParams) => {
    model.replaceParams(params);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const actions = useMemo(() => (
    <BaseConverterActionArea
      params={model.params}
      isGenerating={model.isGenerating}
      onGenerate={model.handleGenerate}
      onExportSTL={model.handleExportSTL}
      onReset={onRequestReset}
      onRequestParamImport={onRequestParamImport}
      draftActions={draftActions}
      blockingReason={validateBaseConverterParams(model.params)}
    />
  ), [draftActions, model.handleExportSTL, model.handleGenerate, model.isGenerating, model.params, onRequestParamImport, onRequestReset]);

  const panel = useMemo(() => (
    <BaseConverterPanel
      params={model.viewParams}
      updateParam={model.updateParam}
      updateParams={model.updateParams}
      beginContinuousEdit={model.beginContinuousEdit}
      previewParam={model.previewParam}
      commitContinuousEdit={model.commitContinuousEdit}
      cancelContinuousEdit={model.cancelContinuousEdit}
      undo={model.undo}
      canUndo={model.canUndo}
      actions={actions}
      isGenerating={model.isGenerating}
      isPreviewStale={model.isPreviewStale}
      volume={model.volume}
    />
  ), [
    actions,
    model.beginContinuousEdit,
    model.canUndo,
    model.cancelContinuousEdit,
    model.commitContinuousEdit,
    model.isGenerating,
    model.isPreviewStale,
    model.previewParam,
    model.undo,
    model.updateParam,
    model.updateParams,
    model.viewParams,
    model.volume,
  ]);

  return {
    mode: "base-converter",
    panel,
    overlays,
    replacementTarget: {
      mode: "base-converter",
      currentDraftId: draftActions.currentDraftId,
      hasUnsavedChanges: draftActions.hasUnsavedChanges,
      paramsRevision: model.transactionRevision ?? 0,
      prepareDraftLoad,
      commitReset: resetWorkspace,
      commitImport: importIntoWorkspace,
      commitDraftLoad: (prepared) => {
        model.replaceParams(prepared.snapshot.params);
        commitLoadedDraftBinding(prepared);
      },
    },
  };
}
