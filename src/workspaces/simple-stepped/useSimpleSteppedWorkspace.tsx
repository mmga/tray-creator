"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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
  const { draftActions, draftDialogProps, clearDraftBinding } =
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

  const importIntoWorkspace = useCallback((params: unknown) => {
    model.setParams(params as SimpleSteppedLayoutParams);
    model.setActiveRow(null);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const panel = useMemo(
    () => (
      <SimpleSteppedPanel
        params={model.params}
        derivedLayout={model.derivedLayout}
        activeRowId={model.activeRowId}
        effectiveDimensions={model.effectiveDimensions}
        setParams={model.setParams}
        onResetParams={resetWorkspace}
        onImportParams={importIntoWorkspace}
        updateParam={model.updateParam}
        onSetActiveRow={model.setActiveRow}
        onAddRow={model.addRow}
        onRemoveRow={model.removeRow}
        onRenameRow={model.renameRow}
        onClearRow={model.clearRow}
        onReorderRows={model.reorderRows}
        onAddSlotToRow={model.addSlotToRow}
        onGenerate={model.handleGenerate}
        onExportSTL={model.handleExportSTL}
        onTrimTray={model.trimTray}
        isGenerating={model.isGenerating}
        isPreviewStale={model.isPreviewStale}
        volume={model.volume}
        draftActions={draftActions}
      />
    ),
    [
      draftActions,
      importIntoWorkspace,
      model.activeRowId,
      model.addRow,
      model.addSlotToRow,
      model.clearRow,
      model.derivedLayout,
      model.effectiveDimensions,
      model.handleExportSTL,
      model.handleGenerate,
      model.isGenerating,
      model.isPreviewStale,
      model.params,
      model.removeRow,
      model.renameRow,
      model.reorderRows,
      model.setActiveRow,
      model.setParams,
      model.trimTray,
      model.updateParam,
      model.volume,
      resetWorkspace,
    ],
  );

  return {
    mode: "simple-stepped",
    panel,
    draftDialogProps,
    commands: {
      resetWorkspace,
      importIntoWorkspace,
    },
  };
}
