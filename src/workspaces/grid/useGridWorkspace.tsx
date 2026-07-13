"use client";

import { useCallback, useMemo, useState, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { PanelActionSection } from "@/components/PanelActionSection";
import { useAutoPreview } from "@/hooks/useAutoPreview";
import { useWorkspaceDraftSupport, type WorkspaceDraftActions } from "@/workspaces/shared";
import { available, generatingAvailability, type AutomaticDraftActionAreaAdapter } from "@/workspaces/draft-action-area";
import { exportParams, importParams } from "@/lib/param-io";
import type { ModeWorkspace } from "@/workspaces/types";
import type { TrayParams } from "@/types/tray";
import type { useTrayModel } from "@/hooks/useTrayModel";

const ParameterPanel = dynamic(() => import("@/components/ParameterPanel"), {
  ssr: false,
});

interface UseGridWorkspaceOptions {
  model: ReturnType<typeof useTrayModel>;
}

interface GridDraftActionAreaProps {
  params: TrayParams;
  isGenerating: boolean;
  onGenerate: () => void;
  onExportSTL: () => void;
  onReset: () => void;
  onImport: (params: TrayParams) => void;
  draftActions: WorkspaceDraftActions;
}

function GridDraftActionArea({
  params,
  isGenerating,
  onGenerate,
  onExportSTL,
  onReset,
  onImport,
  draftActions,
}: GridDraftActionAreaProps) {
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
          case "export-params": exportParams("grid", params); break;
          case "import-params": onImport(await importParams(intent.file, "grid")); break;
          case "reset": onReset(); break;
          case "set-auto-preview": setAutoPreview(intent.enabled); break;
        }
        return { status: "success" };
      } catch (error) {
        return { status: "error", message: `操作失败：${error instanceof Error ? error.message : "未知错误"}` };
      }
    },
  }), [autoPreview, draftActions, isGenerating, onExportSTL, onGenerate, onImport, onReset, params]);

  return <PanelActionSection adapter={adapter} />;
}

export function useGridWorkspace({
  model,
}: UseGridWorkspaceOptions): ModeWorkspace {
  const setGridParams = useCallback((value: SetStateAction<TrayParams>) => {
    const nextParams = typeof value === "function" ? value(model.params) : value;
    model.replaceParams(nextParams);
  }, [model]);

  const { draftActions, overlays, clearDraftBinding } =
    useWorkspaceDraftSupport({
      mode: "grid",
      params: model.params,
      setParams: setGridParams,
    });

  const resetWorkspace = useCallback(() => {
    model.resetParams();
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const importIntoWorkspace = useCallback((params: TrayParams) => {
    model.replaceParams(params);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const actions = useMemo(
    () => (
      <GridDraftActionArea
        params={model.params}
        isGenerating={model.isGenerating}
        onGenerate={model.handleGenerate}
        onExportSTL={model.handleExportSTL}
        onReset={resetWorkspace}
        onImport={importIntoWorkspace}
        draftActions={draftActions}
      />
    ),
    [
      draftActions,
      importIntoWorkspace,
      model.handleExportSTL,
      model.handleGenerate,
      model.isGenerating,
      model.params,
      resetWorkspace,
    ],
  );

  const panel = useMemo(
    () => (
      <ParameterPanel
        params={model.params}
        updateParam={model.updateParam}
        actions={actions}
        isGenerating={model.isGenerating}
        isPreviewStale={model.isPreviewStale}
        volume={model.volume}
      />
    ),
    [
      actions,
      model.isGenerating,
      model.isPreviewStale,
      model.params,
      model.updateParam,
      model.volume,
    ],
  );

  return {
    panel,
    overlays,
  };
}
