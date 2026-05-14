"use client";

import { useCallback, useMemo, useState, type ReactNode, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { useModeDrafts } from "@/hooks/useModeDrafts";
import type { DraftManagerDialogProps } from "@/components/DraftManagerDialog";
import type { PanelDraftActions } from "@/components/PanelActionSection";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import type { AnyDraftListItem } from "@/lib/local-drafts";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { AppMode } from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import { useCustomLayout } from "@/hooks/useCustomLayout";
import { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import { useSteppedLayout } from "@/hooks/useSteppedLayout";
import { useTrayModel } from "@/hooks/useTrayModel";

const ParameterPanel = dynamic(() => import("@/components/ParameterPanel"), {
  ssr: false,
});
const CustomPanel = dynamic(() => import("@/components/CustomPanel"), {
  ssr: false,
});
const SimpleSteppedPanel = dynamic(
  () => import("@/components/SimpleSteppedPanel"),
  { ssr: false },
);
const SteppedPanel = dynamic(() => import("@/components/SteppedPanel"), {
  ssr: false,
});

interface ModeWorkspace {
  mode: AppMode;
  panel: ReactNode;
}

interface UseModeWorkspacesOptions {
  mode: AppMode;
  gridModel: ReturnType<typeof useTrayModel>;
  customModel: ReturnType<typeof useCustomLayout>;
  simpleSteppedModel: ReturnType<typeof useSimpleSteppedLayout>;
  steppedModel: ReturnType<typeof useSteppedLayout>;
  selectedSlotIds: string[];
  previewGroupId: string | null;
  onPreviewGroupChange: (groupId: string | null) => void;
  onSteppedWorkspaceReset: () => void;
}

interface UseModeWorkspacesReturn {
  activeWorkspace: ModeWorkspace;
  draftDialogProps: DraftManagerDialogProps<AnyDraftListItem>;
}

function renderDraftSummary(item: AnyDraftListItem): ReactNode {
  switch (item.mode) {
    case "grid":
      return (
        <>
          <span>{item.rows}×{item.columns}</span>
          <span>{item.baseSizeLabel}</span>
          <span>{item.trayWidth.toFixed(0)}×{item.trayDepth.toFixed(0)}mm</span>
        </>
      );
    case "custom":
      return (
        <>
          <span>{item.slotCount} 槽</span>
          <span>{item.trayWidth.toFixed(0)}×{item.trayDepth.toFixed(0)}mm</span>
        </>
      );
    case "simple-stepped":
      return (
        <>
          <span>{item.rowCount} 行</span>
          <span>{item.slotCount} 槽</span>
          <span>{item.trayWidth.toFixed(0)}×{item.trayDepth.toFixed(0)}mm</span>
        </>
      );
    case "stepped":
      return (
        <>
          <span>{item.groupCount} 组</span>
          <span>{item.slotCount} 槽</span>
          <span>{item.trayWidth.toFixed(0)}×{item.trayDepth.toFixed(0)}mm</span>
        </>
      );
    default:
      return null;
  }
}

export function useModeWorkspaces({
  mode,
  gridModel,
  customModel,
  simpleSteppedModel,
  steppedModel,
  selectedSlotIds,
  previewGroupId,
  onPreviewGroupChange,
  onSteppedWorkspaceReset,
}: UseModeWorkspacesOptions): UseModeWorkspacesReturn {
  const setGridParams = useCallback((value: SetStateAction<TrayParams>) => {
    const nextParams =
      typeof value === "function" ? value(gridModel.params) : value;
    gridModel.replaceParams(nextParams);
  }, [gridModel]);

  const gridDrafts = useModeDrafts({
    mode: "grid",
    params: gridModel.params,
    setParams: setGridParams,
  });
  const customDrafts = useModeDrafts({
    mode: "custom",
    params: customModel.params,
    setParams: customModel.setParams,
  });
  const simpleSteppedDrafts = useModeDrafts({
    mode: "simple-stepped",
    params: simpleSteppedModel.params,
    setParams: simpleSteppedModel.setParams,
  });
  const steppedDrafts = useModeDrafts({
    mode: "stepped",
    params: steppedModel.params,
    setParams: steppedModel.setParams,
    onAfterLoad: onSteppedWorkspaceReset,
  });

  const activeDraftController =
    mode === "grid"
      ? gridDrafts
      : mode === "custom"
        ? customDrafts
        : mode === "simple-stepped"
          ? simpleSteppedDrafts
          : steppedDrafts;

  const [draftListVersion, setDraftListVersion] = useState(0);
  const refreshDraftList = useCallback(() => {
    setDraftListVersion((version) => version + 1);
  }, []);

  const activeDraftList = useMemo(() => {
    void draftListVersion;
    switch (mode) {
      case "grid":
        return gridDrafts.getDraftList() as AnyDraftListItem[];
      case "custom":
        return customDrafts.getDraftList() as AnyDraftListItem[];
      case "simple-stepped":
        return simpleSteppedDrafts.getDraftList() as AnyDraftListItem[];
      case "stepped":
        return steppedDrafts.getDraftList() as AnyDraftListItem[];
      default:
        return [];
    }
  }, [
    customDrafts,
    draftListVersion,
    gridDrafts,
    mode,
    simpleSteppedDrafts,
    steppedDrafts,
  ]);

  const openModeDraftDialog = useCallback((openDialog: () => void) => {
    refreshDraftList();
    openDialog();
  }, [refreshDraftList]);

  const createDraftActions = useCallback(
    (
      currentDraftId: string | null,
      hasUnsavedChanges: boolean,
      saveCurrentDraft: () => void,
      openDialog: () => void,
    ): PanelDraftActions => ({
      currentDraftId,
      hasUnsavedChanges,
      onSaveDraft: saveCurrentDraft,
      onOpenDraftDialog: () => openModeDraftDialog(openDialog),
    }),
    [openModeDraftDialog],
  );

  const gridDraftActions = createDraftActions(
    gridDrafts.currentDraftId,
    gridDrafts.hasUnsavedChanges,
    gridDrafts.saveCurrentDraft,
    gridDrafts.openDialog,
  );
  const customDraftActions = createDraftActions(
    customDrafts.currentDraftId,
    customDrafts.hasUnsavedChanges,
    customDrafts.saveCurrentDraft,
    customDrafts.openDialog,
  );
  const simpleSteppedDraftActions = createDraftActions(
    simpleSteppedDrafts.currentDraftId,
    simpleSteppedDrafts.hasUnsavedChanges,
    simpleSteppedDrafts.saveCurrentDraft,
    simpleSteppedDrafts.openDialog,
  );
  const steppedDraftActions = createDraftActions(
    steppedDrafts.currentDraftId,
    steppedDrafts.hasUnsavedChanges,
    steppedDrafts.saveCurrentDraft,
    steppedDrafts.openDialog,
  );

  const handleGridReset = useCallback(() => {
    gridModel.resetParams();
    gridDrafts.clearDraftBinding();
  }, [gridDrafts, gridModel]);

  const handleGridImport = useCallback((params: TrayParams) => {
    gridModel.replaceParams(params);
    gridDrafts.clearDraftBinding();
  }, [gridDrafts, gridModel]);

  const handleCustomReset = useCallback(() => {
    customModel.setParams(CUSTOM_LAYOUT_DEFAULTS);
    customDrafts.clearDraftBinding();
  }, [customDrafts, customModel]);

  const handleCustomImport = useCallback((params: typeof customModel.params) => {
    customModel.setParams(params);
    customDrafts.clearDraftBinding();
  }, [customDrafts, customModel]);

  const handleSimpleSteppedReset = useCallback(() => {
    simpleSteppedModel.setParams(SIMPLE_STEPPED_LAYOUT_DEFAULTS);
    simpleSteppedModel.setActiveRow(null);
    simpleSteppedDrafts.clearDraftBinding();
  }, [simpleSteppedDrafts, simpleSteppedModel]);

  const handleSimpleSteppedImport = useCallback(
    (params: typeof simpleSteppedModel.params) => {
      simpleSteppedModel.setParams(params);
      simpleSteppedModel.setActiveRow(null);
      simpleSteppedDrafts.clearDraftBinding();
    },
    [simpleSteppedDrafts, simpleSteppedModel],
  );

  const handleSteppedReset = useCallback(() => {
    steppedModel.setParams(STEPPED_LAYOUT_DEFAULTS);
    onSteppedWorkspaceReset();
    steppedDrafts.clearDraftBinding();
  }, [onSteppedWorkspaceReset, steppedDrafts, steppedModel]);

  const handleSteppedImport = useCallback((params: typeof steppedModel.params) => {
    steppedModel.setParams(params);
    onSteppedWorkspaceReset();
    steppedDrafts.clearDraftBinding();
  }, [onSteppedWorkspaceReset, steppedDrafts, steppedModel]);

  const activeWorkspace = useMemo<ModeWorkspace>(() => {
    if (mode === "grid") {
      return {
        mode,
        panel: (
          <ParameterPanel
            params={gridModel.params}
            updateParam={gridModel.updateParam}
            replaceParams={handleGridImport}
            resetParams={handleGridReset}
            onGenerate={gridModel.handleGenerate}
            onExportSTL={gridModel.handleExportSTL}
            isGenerating={gridModel.isGenerating}
            volume={gridModel.volume}
            draftActions={gridDraftActions}
          />
        ),
      };
    }

    if (mode === "simple-stepped") {
      return {
        mode,
        panel: (
          <SimpleSteppedPanel
            params={simpleSteppedModel.params}
            derivedLayout={simpleSteppedModel.derivedLayout}
            activeRowId={simpleSteppedModel.activeRowId}
            effectiveDimensions={simpleSteppedModel.effectiveDimensions}
            setParams={simpleSteppedModel.setParams}
            onResetParams={handleSimpleSteppedReset}
            onImportParams={handleSimpleSteppedImport}
            updateParam={simpleSteppedModel.updateParam}
            onSetActiveRow={simpleSteppedModel.setActiveRow}
            onAddRow={simpleSteppedModel.addRow}
            onRemoveRow={simpleSteppedModel.removeRow}
            onRenameRow={simpleSteppedModel.renameRow}
            onClearRow={simpleSteppedModel.clearRow}
            onReorderRows={simpleSteppedModel.reorderRows}
            onAddSlotToRow={simpleSteppedModel.addSlotToRow}
            onGenerate={simpleSteppedModel.handleGenerate}
            onExportSTL={simpleSteppedModel.handleExportSTL}
            onTrimTray={simpleSteppedModel.trimTray}
            isGenerating={simpleSteppedModel.isGenerating}
            isPreviewStale={simpleSteppedModel.isPreviewStale}
            volume={simpleSteppedModel.volume}
            draftActions={simpleSteppedDraftActions}
          />
        ),
      };
    }

    if (mode === "stepped") {
      return {
        mode,
        panel: (
          <SteppedPanel
            params={steppedModel.params}
            effectiveDimensions={steppedModel.effectiveDimensions}
            isPreviewStale={steppedModel.isPreviewStale}
            setParams={steppedModel.setParams}
            onResetParams={handleSteppedReset}
            onImportParams={handleSteppedImport}
            updateParam={steppedModel.updateParam}
            onAddSlot={steppedModel.addSlot}
            onGenerate={steppedModel.handleGenerate}
            onExportSTL={steppedModel.handleExportSTL}
            isGenerating={steppedModel.isGenerating}
            volume={steppedModel.volume}
            selectedSlotIds={selectedSlotIds}
            onAddGroup={steppedModel.addGroup}
            onRemoveGroup={steppedModel.removeGroup}
            onUpdateGroupHeight={steppedModel.updateGroupHeight}
            onUpdateGroupSmoothingOverride={steppedModel.updateGroupSmoothingOverride}
            onUpdateGroupSmoothingRadius={steppedModel.updateGroupSmoothingRadius}
            onUpdateGroupDisconnectOverride={steppedModel.updateGroupDisconnectOverride}
            onUpdateGroupDisconnectDistance={steppedModel.updateGroupDisconnectDistance}
            onSetActiveGroup={steppedModel.setActiveGroup}
            onMoveSelectedSlotsToGroup={steppedModel.moveSelectedSlotsToGroup}
            onReorderGroups={steppedModel.reorderGroups}
            previewGroupId={previewGroupId}
            onPreviewGroupChange={onPreviewGroupChange}
            bridgeWarning={steppedModel.bridgeWarning}
            optimizationProposals={steppedModel.optimizationProposals}
            isOptimizingLayout={steppedModel.isOptimizingLayout}
            onGenerateOptimizationProposals={steppedModel.generateOptimizationProposals}
            onApplyOptimizationProposal={steppedModel.applyOptimizationProposal}
            onClearOptimizationProposals={steppedModel.clearOptimizationProposals}
            draftActions={steppedDraftActions}
          />
        ),
      };
    }

    return {
      mode,
      panel: (
        <CustomPanel
          params={customModel.params}
          effectiveDimensions={customModel.effectiveDimensions}
          setParams={customModel.setParams}
          onResetParams={handleCustomReset}
          onImportParams={handleCustomImport}
          updateParam={customModel.updateParam}
          onAddSlot={customModel.addSlot}
          onGenerate={customModel.handleGenerate}
          onExportSTL={customModel.handleExportSTL}
          isGenerating={customModel.isGenerating}
          volume={customModel.volume}
          draftActions={customDraftActions}
        />
      ),
    };
  }, [
    customDraftActions,
    customModel,
    gridDraftActions,
    gridModel,
    handleCustomImport,
    handleCustomReset,
    handleGridImport,
    handleGridReset,
    handleSimpleSteppedImport,
    handleSimpleSteppedReset,
    handleSteppedImport,
    handleSteppedReset,
    mode,
    onPreviewGroupChange,
    previewGroupId,
    selectedSlotIds,
    simpleSteppedDraftActions,
    simpleSteppedModel,
    steppedDraftActions,
    steppedModel,
  ]);

  const draftDialogProps = useMemo<DraftManagerDialogProps<AnyDraftListItem>>(
    () => ({
      mode,
      open: activeDraftController.isDialogOpen,
      onOpenChange: (open) => {
        if (!open) {
          activeDraftController.closeDialog();
          return;
        }
        openModeDraftDialog(activeDraftController.openDialog);
      },
      drafts: activeDraftList,
      currentDraftId: activeDraftController.currentDraftId,
      hasUnsavedChanges: activeDraftController.hasUnsavedChanges,
      draftNameInput: activeDraftController.draftNameInput,
      onDraftNameInputChange: activeDraftController.setDraftNameInput,
      onSaveAsNew: () => {
        activeDraftController.saveAsNewDraft();
        refreshDraftList();
      },
      onSaveCurrent: () => {
        activeDraftController.saveCurrentDraft();
        refreshDraftList();
      },
      onLoad: (id) => {
        activeDraftController.loadDraft(id);
        refreshDraftList();
      },
      onRename: (id, title) => {
        activeDraftController.renameDraftItem(id, title);
        refreshDraftList();
      },
      onDelete: (id) => {
        activeDraftController.deleteDraftItem(id);
        refreshDraftList();
      },
      onExport: (id) => activeDraftController.exportDraftItem(id),
      renderSummary: renderDraftSummary,
    }),
    [activeDraftController, activeDraftList, mode, openModeDraftDialog, refreshDraftList],
  );

  return {
    activeWorkspace,
    draftDialogProps,
  };
}
