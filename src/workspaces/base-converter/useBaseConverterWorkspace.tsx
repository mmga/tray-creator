"use client";

import { useCallback, useMemo, useState, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { PanelActionSection } from "@/components/PanelActionSection";
import { useAutoPreview } from "@/hooks/useAutoPreview";
import type { useBaseConverter } from "@/hooks/useBaseConverter";
import { exportParams } from "@/lib/param-io";
import type { BaseConverterParams } from "@/types/custom-tray";
import {
  available,
  generatingAvailability,
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
}

function BaseConverterActionArea({
  params,
  isGenerating,
  onGenerate,
  onExportSTL,
  onReset,
  onRequestParamImport,
  draftActions,
}: BaseConverterActionAreaProps) {
  const [autoPreview, setAutoPreview] = useState(false);
  useAutoPreview(params, {
    enabled: autoPreview,
    isGenerating,
    isBlocked: false,
    onGenerate,
  });

  const adapter = useMemo<AutomaticDraftActionAreaAdapter>(() => ({
    kind: "automatic",
    state: {
      currentDraftId: draftActions.currentDraftId,
      hasUnsavedChanges: draftActions.hasUnsavedChanges,
      stale: false,
      generate: generatingAvailability(isGenerating),
      exportWhole: available,
      preview: { kind: "automatic", enabled: autoPreview },
    },
    async perform(intent) {
      try {
        switch (intent.type) {
          case "generate": onGenerate(); break;
          case "export-whole": onExportSTL(); break;
          case "save-draft": draftActions.onSaveDraft(); break;
          case "open-drafts": draftActions.onOpenDraftDialog(); break;
          case "export-params": exportParams("base-converter", params); break;
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
  }), [autoPreview, draftActions, isGenerating, onExportSTL, onGenerate, onRequestParamImport, onReset, params]);

  return <PanelActionSection adapter={adapter} />;
}

interface UseBaseConverterWorkspaceOptions {
  model: ReturnType<typeof useBaseConverter>;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
}

export function useBaseConverterWorkspace({
  model,
  onRequestParamImport,
}: UseBaseConverterWorkspaceOptions): ModeWorkspace {
  const setParams = useCallback((value: SetStateAction<BaseConverterParams>) => {
    model.replaceParams(typeof value === "function" ? value(model.params) : value);
  }, [model]);
  const { draftActions, overlays, clearDraftBinding } =
    useWorkspaceDraftSupport({
      mode: "base-converter",
      params: model.params,
      setParams,
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
      onReset={resetWorkspace}
      onRequestParamImport={onRequestParamImport}
      draftActions={draftActions}
    />
  ), [draftActions, model.handleExportSTL, model.handleGenerate, model.isGenerating, model.params, onRequestParamImport, resetWorkspace]);

  const panel = useMemo(() => (
    <BaseConverterPanel
      params={model.params}
      updateParam={model.updateParam}
      actions={actions}
      isGenerating={model.isGenerating}
      isPreviewStale={model.isPreviewStale}
      volume={model.volume}
    />
  ), [actions, model.isGenerating, model.isPreviewStale, model.params, model.updateParam, model.volume]);

  return {
    panel,
    overlays,
    importTarget: {
      currentDraftId: draftActions.currentDraftId,
      hasUnsavedChanges: draftActions.hasUnsavedChanges,
      commit: (params) => importIntoWorkspace(params as BaseConverterParams),
    },
  };
}
