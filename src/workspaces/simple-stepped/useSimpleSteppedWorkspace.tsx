"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { PanelActionSection } from "@/components/PanelActionSection";
import { useWorkspaceDraftSupport } from "@/workspaces/shared";
import type { ModeWorkspace } from "@/workspaces/types";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";
import type { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";

const SimpleSteppedPanel = dynamic(
  () => import("@/components/SimpleSteppedPanel"),
  { ssr: false },
);

interface UseSimpleSteppedWorkspaceOptions {
  model: ReturnType<typeof useSimpleSteppedLayout>;
}

export function useSimpleSteppedWorkspace({
  model,
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
    () => (
      <PanelActionSection
        onGenerate={model.handleGenerate}
        onExportSTL={model.handleExportSTL}
        onReset={resetWorkspace}
        isGenerating={model.isGenerating}
        mode="simple-stepped"
        params={model.params}
        onImport={importIntoWorkspace}
        showStaleNotice={model.isPreviewStale}
        draftActions={draftActions}
      />
    ),
    [
      draftActions,
      importIntoWorkspace,
      model.handleExportSTL,
      model.handleGenerate,
      model.isGenerating,
      model.isPreviewStale,
      model.params,
      resetWorkspace,
    ],
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
    ],
  );

  return {
    panel,
    overlays,
  };
}
