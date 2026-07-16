"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { PanelActionSection } from "@/components/PanelActionSection";
import { useWorkspaceDraftSupport } from "@/workspaces/shared";
import type { ModeWorkspace } from "@/workspaces/types";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";
import type { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import { exportParams } from "@/lib/param-download";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { modelExportAvailability, modelGenerationAvailability, type DraftActionResult, type ManualDraftActionAreaAdapter } from "@/workspaces/draft-action-area";

const SimpleSteppedPanel = dynamic(
  () => import("@/components/SimpleSteppedPanel"),
  { ssr: false },
);

interface UseSimpleSteppedWorkspaceOptions {
  model: ReturnType<typeof useSimpleSteppedLayout>;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
}

export function useSimpleSteppedWorkspace({
  model,
  onRequestParamImport,
}: UseSimpleSteppedWorkspaceOptions): ModeWorkspace {
  const { draftActions, overlays, clearDraftBinding } =
    useWorkspaceDraftSupport({
      mode: "simple-stepped",
      params: model.params,
      setParams: model.setParams,
    });

  const resetWorkspace = useCallback(() => {
    model.setParams(SIMPLE_STEPPED_LAYOUT_DEFAULTS);
    model.setActiveRow(null);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const importIntoWorkspace = useCallback((params: SimpleSteppedLayoutParams) => {
    model.setParams(params);
    model.setActiveRow(null);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

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
              case "export-params": exportParams(captureModeParamSnapshot("simple-stepped", model.params)); break;
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
      <SimpleSteppedPanel
        params={model.params}
        derivedLayout={model.derivedLayout}
        activeRowId={model.activeRowId}
        effectiveDimensions={model.effectiveDimensions}
        actions={actions}
        updateParam={model.updateParam}
        onSetActiveRow={model.setActiveRow}
        onAddRow={model.addRow}
        onRemoveRow={model.removeRow}
        onRenameRow={model.renameRow}
        onClearRow={model.clearRow}
        onReorderRows={model.reorderRows}
        onAddSlotToRow={model.addSlotToRow}
        onTrimTray={model.trimTray}
        isGenerating={model.isGenerating}
        isPreviewStale={model.isPreviewStale}
        volume={model.volume}
        baseHoleFitViolations={model.baseHoleFitViolations}
      />
    ),
    [
      actions,
      model.activeRowId,
      model.addRow,
      model.addSlotToRow,
      model.clearRow,
      model.derivedLayout,
      model.effectiveDimensions,
      model.isGenerating,
      model.isPreviewStale,
      model.params,
      model.removeRow,
      model.renameRow,
      model.reorderRows,
      model.setActiveRow,
      model.trimTray,
      model.updateParam,
      model.volume,
      model.baseHoleFitViolations,
    ],
  );

  return {
    panel,
    overlays,
    importTarget: {
      currentDraftId: draftActions.currentDraftId,
      hasUnsavedChanges: draftActions.hasUnsavedChanges,
      commit: (params) => importIntoWorkspace(params as SimpleSteppedLayoutParams),
    },
  };
}
