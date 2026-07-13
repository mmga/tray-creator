"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PanelActionSection } from "@/components/PanelActionSection";
import { useAutoPreview } from "@/hooks/useAutoPreview";
import { useWorkspaceDraftSupport, type WorkspaceDraftActions } from "@/workspaces/shared";
import { available, generatingAvailability, type AutomaticDraftActionAreaAdapter } from "@/workspaces/draft-action-area";
import { exportParams, importParams } from "@/lib/param-io";
import type { ModeWorkspace } from "@/workspaces/types";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import type { CustomLayoutParams } from "@/types/custom-tray";
import type { useCustomLayout } from "@/hooks/useCustomLayout";

const CustomPanel = dynamic(() => import("@/components/CustomPanel"), {
  ssr: false,
});

interface UseCustomWorkspaceOptions {
  model: ReturnType<typeof useCustomLayout>;
}

interface CustomDraftActionAreaProps {
  params: CustomLayoutParams;
  isGenerating: boolean;
  onGenerate: () => void;
  onExportSTL: () => void;
  onReset: () => void;
  onImport: (params: CustomLayoutParams) => void;
  draftActions: WorkspaceDraftActions;
}

function CustomDraftActionArea({
  params,
  isGenerating,
  onGenerate,
  onExportSTL,
  onReset,
  onImport,
  draftActions,
}: CustomDraftActionAreaProps) {
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
          case "export-params": exportParams("custom", params); break;
          case "import-params": onImport(await importParams(intent.file, "custom")); break;
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

export function useCustomWorkspace({
  model,
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
      <CustomPanel
        params={model.params}
        effectiveDimensions={model.effectiveDimensions}
        actions={actions}
        updateParam={model.updateParam}
        onAddSlot={model.addSlot}
        onRandomizeSlots={model.randomizeSlots}
        isGenerating={model.isGenerating}
        isPreviewStale={model.isPreviewStale}
        volume={model.volume}
      />
    ),
    [
      actions,
      model.addSlot,
      model.effectiveDimensions,
      model.isGenerating,
      model.isPreviewStale,
      model.params,
      model.randomizeSlots,
      model.updateParam,
      model.volume,
    ],
  );

  return {
    panel,
    overlays,
  };
}
