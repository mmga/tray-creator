"use client";

import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  type SetStateAction,
} from "react";
import dynamic from "next/dynamic";
import { useTrayModel } from "@/hooks/useTrayModel";
import { useCustomLayout } from "@/hooks/useCustomLayout";
import { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import { useSteppedLayout } from "@/hooks/useSteppedLayout";
import { useModeDrafts } from "@/hooks/useModeDrafts";
import { ModeTabs } from "@/components/ModeTabs";
import { DraftManagerDialog } from "@/components/DraftManagerDialog";
import type { AppMode } from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import { Boxes } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CUSTOM_LAYOUT_DEFAULTS,
} from "@/lib/custom-config";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { AnyDraftListItem } from "@/lib/local-drafts";

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

// Lazy load components
const ParameterPanel = dynamic(() => import("@/components/ParameterPanel"), { ssr: false });
const CustomPanel = dynamic(() => import("@/components/CustomPanel"), { ssr: false });
const SimpleSteppedPanel = dynamic(() => import("@/components/SimpleSteppedPanel"), { ssr: false });
const SteppedPanel = dynamic(() => import("@/components/SteppedPanel"), { ssr: false });
const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), { ssr: false });
const TrayViewer = dynamic(() => import("@/components/TrayViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-[#0a0908]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-muted-foreground/40 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-mono tracking-wider">LOADING FORGE...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [mode, setMode] = useState<AppMode>("grid");
  const [rightView, setRightView] = useState<"2d" | "3d">("2d");
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);

  // Grid Mode State
  const gridModel = useTrayModel();

  // Custom Mode State
  const customModel = useCustomLayout();

  // Simple Stepped Mode State
  const simpleSteppedModel = useSimpleSteppedLayout();

  // Stepped Mode State
  const steppedModel = useSteppedLayout();

  // Stepped 草稿管理
  const handleAfterDraftLoad = useCallback(() => {
    setSelectedSlotIds([]);
    setPreviewGroupId(null);
  }, []);

  const steppedSlots = steppedModel.params.slots;
  const setSteppedActiveGroup = steppedModel.setActiveGroup;

  // ── Stepped 模式：选中凹槽时自动激活所属组 ──
  useEffect(() => {
    if (mode === "stepped" && selectedSlotIds.length > 0) {
      const firstSlotId = selectedSlotIds[0];
      const slot = steppedSlots.find((s) => s.id === firstSlotId);
      if (slot && "groupId" in slot) {
        setSteppedActiveGroup(slot.groupId);
      }
    }
  }, [selectedSlotIds, mode, setSteppedActiveGroup, steppedSlots]);

  const simpleSteppedMoveScopeResolver = useCallback(
    (draggingId: string, selectedIds: string[]) => {
      const draggingSlot = simpleSteppedModel.params.slots.find((slot) => slot.id === draggingId);
      if (!draggingSlot) {
        return [];
      }

      const sameRowSelected = selectedIds.filter((id) => {
        const slot = simpleSteppedModel.params.slots.find((candidate) => candidate.id === id);
        return slot?.rowId === draggingSlot.rowId;
      });

      if (sameRowSelected.length > 0) {
        return sameRowSelected;
      }

      return [draggingId];
    },
    [simpleSteppedModel.params.slots],
  );

  const setGridParams = (value: SetStateAction<TrayParams>) => {
    const nextParams =
      typeof value === "function" ? value(gridModel.params) : value;
    gridModel.replaceParams(nextParams);
  };

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
    onAfterLoad: handleAfterDraftLoad,
  });

  const activeDraftController =
    mode === "grid"
      ? gridDrafts
      : mode === "custom"
        ? customDrafts
        : mode === "simple-stepped"
          ? simpleSteppedDrafts
          : steppedDrafts;

  const [, setDraftListVersion] = useState(0);
  const refreshDraftList = useCallback(() => {
    setDraftListVersion((version) => version + 1);
  }, []);

  const activeDraftList = (() => {
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
  })();

  const openModeDraftDialog = useCallback(
    (openDialog: () => void) => {
      refreshDraftList();
      openDialog();
    },
    [refreshDraftList],
  );

  const gridDraftActions = {
    currentDraftId: gridDrafts.currentDraftId,
    hasUnsavedChanges: gridDrafts.hasUnsavedChanges,
    onSaveDraft: gridDrafts.saveCurrentDraft,
    onOpenDraftDialog: () => openModeDraftDialog(gridDrafts.openDialog),
  };
  const customDraftActions = {
    currentDraftId: customDrafts.currentDraftId,
    hasUnsavedChanges: customDrafts.hasUnsavedChanges,
    onSaveDraft: customDrafts.saveCurrentDraft,
    onOpenDraftDialog: () => openModeDraftDialog(customDrafts.openDialog),
  };
  const simpleSteppedDraftActions = {
    currentDraftId: simpleSteppedDrafts.currentDraftId,
    hasUnsavedChanges: simpleSteppedDrafts.hasUnsavedChanges,
    onSaveDraft: simpleSteppedDrafts.saveCurrentDraft,
    onOpenDraftDialog: () =>
      openModeDraftDialog(simpleSteppedDrafts.openDialog),
  };
  const steppedDraftActions = {
    currentDraftId: steppedDrafts.currentDraftId,
    hasUnsavedChanges: steppedDrafts.hasUnsavedChanges,
    onSaveDraft: steppedDrafts.saveCurrentDraft,
    onOpenDraftDialog: () => openModeDraftDialog(steppedDrafts.openDialog),
  };

  const handleGridReset = useCallback(() => {
    gridModel.resetParams();
    gridDrafts.clearDraftBinding();
  }, [gridDrafts, gridModel]);

  const handleGridImport = useCallback(
    (params: TrayParams) => {
      gridModel.replaceParams(params);
      gridDrafts.clearDraftBinding();
    },
    [gridDrafts, gridModel],
  );

  const handleCustomReset = useCallback(() => {
    customModel.setParams(CUSTOM_LAYOUT_DEFAULTS);
    customDrafts.clearDraftBinding();
  }, [customDrafts, customModel]);

  const handleCustomImport = useCallback(
    (params: typeof customModel.params) => {
      customModel.setParams(params);
      customDrafts.clearDraftBinding();
    },
    [customDrafts, customModel],
  );

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
    setSelectedSlotIds([]);
    setPreviewGroupId(null);
    steppedDrafts.clearDraftBinding();
  }, [steppedDrafts, steppedModel]);

  const handleSteppedImport = useCallback(
    (params: typeof steppedModel.params) => {
      steppedModel.setParams(params);
      setSelectedSlotIds([]);
      setPreviewGroupId(null);
      steppedDrafts.clearDraftBinding();
    },
    [steppedDrafts, steppedModel],
  );

  // 参数面板内容（共享于桌面和移动端）
  const renderParameterPanel = () => {
    if (mode === "grid") {
      return (
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
      );
    }
    if (mode === "simple-stepped") {
      return (
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
      );
    }
    if (mode === "stepped") {
      return (
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
          onPreviewGroupChange={setPreviewGroupId}
          bridgeWarning={steppedModel.bridgeWarning}
          optimizationProposals={steppedModel.optimizationProposals}
          isOptimizingLayout={steppedModel.isOptimizingLayout}
          onGenerateOptimizationProposals={steppedModel.generateOptimizationProposals}
          onApplyOptimizationProposal={steppedModel.applyOptimizationProposal}
          onClearOptimizationProposals={steppedModel.clearOptimizationProposals}
          draftActions={steppedDraftActions}
        />
      );
    }
    return (
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
    );
  };

  // 视口内容（共享于桌面和移动端）
  const renderViewport = () => {
    if (mode === "grid") {
      return <TrayViewer geometry={gridModel.threeGeometry} isStale={gridModel.isPreviewStale} onRegenerate={gridModel.handleGenerate} />;
    }

    // Custom / Stepped: 2D/3D toggle
    const model =
      mode === "stepped"
        ? steppedModel
        : mode === "simple-stepped"
          ? simpleSteppedModel
          : customModel;
    const canvasParams =
      mode === "simple-stepped"
        ? simpleSteppedModel.canvasParams
        : mode === "stepped"
          ? steppedModel.params
          : customModel.params;
    return (
      <Tabs
        value={rightView}
        onValueChange={(v) => {
          setRightView(v as "2d" | "3d");
          if (v === "3d" && model.isPreviewStale) {
            model.handleGenerate();
          }
        }}
        className="flex-1 flex flex-col relative"
      >
        <div className="absolute top-3 left-5 z-20">
          <TabsList
            className="bg-[#1c1a16] border border-[#2e2a24]"
            onKeyDownCapture={(event) => {
              if (
                event.key === "ArrowLeft" ||
                event.key === "ArrowRight"
              ) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          >
            <TabsTrigger value="2d" className="text-xs">2D 编辑</TabsTrigger>
            <TabsTrigger value="3d" className="text-xs">3D 预览</TabsTrigger>
          </TabsList>
        </div>

        <div className={`absolute inset-0 m-0 p-0 transition-opacity duration-150 ${rightView === "2d" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <div className="w-full h-full border-t border-[#2e2a24]">
            <LayoutCanvas
              key={mode}
              isActive={rightView === "2d"}
              params={canvasParams}
              onUpdateSlot={mode === "simple-stepped" ? simpleSteppedModel.updateSlotPosition : model.updateSlotPosition}
              onRemoveSlot={mode === "simple-stepped" ? simpleSteppedModel.removeSlot : model.removeSlot}
              onResizeTray={mode === "simple-stepped" ? simpleSteppedModel.resizeTray : undefined}
              onUpdateSlotRotation={mode === "simple-stepped" ? simpleSteppedModel.updateSlotRotation : model.updateSlotRotation}
              onUpdateMultipleSlots={mode === "simple-stepped" ? simpleSteppedModel.updateMultipleSlots : model.updateMultipleSlots}
              onLiveUpdateMultipleSlots={mode === "simple-stepped" ? simpleSteppedModel.updateMultipleSlotsLive : model.updateMultipleSlotsLive}
              onInsertSlots={mode === "simple-stepped" ? undefined : mode === "stepped" ? steppedModel.insertSlots : customModel.insertSlots}
              onDuplicateSlots={mode === "simple-stepped" ? simpleSteppedModel.duplicateSlots : model.duplicateSlots}
              onUndo={mode === "simple-stepped" ? simpleSteppedModel.undo : model.undo}
              onSaveSnapshot={mode === "simple-stepped" ? simpleSteppedModel.saveSnapshot : model.saveSnapshot}
              onSelectionChange={mode === "stepped" ? setSelectedSlotIds : undefined}
              onEditInteractionChange={mode === "stepped"
                ? (isInteracting) => {
                  if (isInteracting) {
                    steppedModel.pauseOutlinePreview();
                  } else {
                    steppedModel.resumeOutlinePreview();
                  }
                }
                : undefined}
              outlinePreview={mode === "stepped" ? steppedModel.outlinePreview : undefined}
              focusedGroupId={mode === "stepped" ? previewGroupId : undefined}
              rowBands={mode === "simple-stepped" ? simpleSteppedModel.derivedLayout.rowBands : undefined}
              slotMoveScopeResolver={mode === "simple-stepped" ? simpleSteppedMoveScopeResolver : undefined}
            />
          </div>
        </div>

        <div className={`absolute inset-0 m-0 transition-opacity duration-150 ${rightView === "3d" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {rightView === "3d" && (
            <TrayViewer geometry={model.threeGeometry} isStale={model.isPreviewStale} isGenerating={model.isGenerating} onRegenerate={model.handleGenerate} />
          )}
        </div>
      </Tabs>
    );
  };

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden">
      <DraftManagerDialog
        mode={mode}
        open={activeDraftController.isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            activeDraftController.closeDialog();
            return;
          }
          openModeDraftDialog(activeDraftController.openDialog);
        }}
        drafts={activeDraftList}
        currentDraftId={activeDraftController.currentDraftId}
        hasUnsavedChanges={activeDraftController.hasUnsavedChanges}
        draftNameInput={activeDraftController.draftNameInput}
        onDraftNameInputChange={activeDraftController.setDraftNameInput}
        onSaveAsNew={() => {
          activeDraftController.saveAsNewDraft();
          refreshDraftList();
        }}
        onSaveCurrent={() => {
          activeDraftController.saveCurrentDraft();
          refreshDraftList();
        }}
        onLoad={(id) => {
          activeDraftController.loadDraft(id);
          refreshDraftList();
        }}
        onRename={(id, title) => {
          activeDraftController.renameDraftItem(id, title);
          refreshDraftList();
        }}
        onDelete={(id) => {
          activeDraftController.deleteDraftItem(id);
          refreshDraftList();
        }}
        onExport={(id) => activeDraftController.exportDraftItem(id)}
        renderSummary={renderDraftSummary}
      />

      {/* Header */}
      <header className="relative shrink-0">
        <div className="flex items-center justify-between px-3 lg:px-6 py-2 lg:py-3 bg-[#0e0d0b] border-b-2 border-[#2e2a24]">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 border-2 border-primary/60 bg-[#1c1a16] shadow-inner">
              <Boxes className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
              <div className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2 border-primary/80" />
              <div className="absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2 border-primary/80" />
              <div className="absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2 border-primary/80" />
              <div className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2 border-primary/80" />
            </div>
            <div>
              <h1 className="text-sm lg:text-base font-bold tracking-[0.15em] text-primary parchment-glow leading-tight">
                战锤托盘生成器
              </h1>
              <span className="hidden lg:inline text-[10px] text-muted-foreground font-mono tracking-[0.3em] uppercase">
                TRAY CREATOR — FORGEWORLD
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-medium bg-[#1c1a16] text-muted-foreground border border-[#2e2a24] tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8b1a1a] animate-ember" />
              FORGE v0.2
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] gold-trim" />
      </header>

      {/* Mode Switcher */}
      <ModeTabs mode={mode} onModeChange={(m) => {
        setMode(m);
        setSelectedSlotIds([]);
        setPreviewGroupId(null);
      }} />

      {/* ===== 主布局: 左右分栏 ===== */}
      <main className="flex flex-row flex-1 overflow-hidden">
        {/* Left Panel */}
        <aside className="w-[380px] shrink-0 overflow-y-auto bg-[#0e0d0b] [scrollbar-gutter:stable] h-full">
          <div className="p-4 pb-6 h-full">
            {renderParameterPanel()}
          </div>
        </aside>

        {/* Divider */}
        <div className="w-[3px] shrink-0 bg-gradient-to-b from-[#2e2a24] via-[#3d372e] to-[#2e2a24] relative">
          <div className="absolute top-0 left-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-[#b8963a20] to-transparent" />
        </div>

        {/* Right Viewport */}
        <section className="flex-1 bg-[#0a0908] relative flex flex-col">
          {renderViewport()}
        </section>
      </main>
    </div>
  );
}
