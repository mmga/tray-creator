"use client";

import { useCallback, useState } from "react";
import { ParamImportDialog } from "@/components/ParamImportDialog";
import { useCustomLayout } from "@/hooks/useCustomLayout";
import { useBaseConverter } from "@/hooks/useBaseConverter";
import { useModeInteractionState } from "@/hooks/useModeInteractionState";
import { useModeViewportWorkspaces } from "@/hooks/useModeViewportWorkspaces";
import { useModeWorkspaces } from "@/hooks/useModeWorkspaces";
import { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import { useSteppedCadLayout } from "@/hooks/useSteppedCadLayout";
import { useSteppedLayout } from "@/hooks/useSteppedLayout";
import { useTrayModel } from "@/hooks/useTrayModel";
import type { AppMode } from "@/types/custom-tray";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { ModeWorkspace } from "@/workspaces/types";
import {
  APP_MODE_LABELS,
  prepareParamImport,
  type ImportCandidate,
  type ImportModeSelectionRequired,
} from "@/lib/param-io";
import type { DraftActionResult } from "@/workspaces/draft-action-area";
import { useToast } from "@/hooks/useToast";

interface UseModeEditorWorkspacesOptions {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

interface UseModeEditorWorkspacesReturn {
  activeWorkspace: ModeWorkspace;
  activeViewport: ModeViewportWorkspace;
  importOverlay: React.ReactNode;
}

export function useModeEditorWorkspaces({
  mode,
  onModeChange,
}: UseModeEditorWorkspacesOptions): UseModeEditorWorkspacesReturn {
  const { toast } = useToast();
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [modeSelection, setModeSelection] =
    useState<ImportModeSelectionRequired | null>(null);
  const [importCandidate, setImportCandidate] =
    useState<ImportCandidate | null>(null);
  const [isPreparingImport, setIsPreparingImport] = useState(false);
  const gridModel = useTrayModel();
  const customModel = useCustomLayout();
  const baseConverterModel = useBaseConverter();
  const simpleSteppedModel = useSimpleSteppedLayout();
  const steppedModel = useSteppedLayout();
  const steppedCadModel = useSteppedCadLayout();
  const steppedInteractionState = useModeInteractionState();

  const clearPendingImport = useCallback(() => {
    setPendingImportFile(null);
    setModeSelection(null);
    setImportCandidate(null);
    setIsPreparingImport(false);
  }, []);

  const requestParamImport = useCallback(async (
    file: File,
  ): Promise<DraftActionResult> => {
    setIsPreparingImport(true);
    try {
      const preparation = await prepareParamImport(file);
      setPendingImportFile(file);
      if (preparation.status === "mode-selection-required") {
        setModeSelection(preparation);
        setImportCandidate(null);
      } else {
        setModeSelection(null);
        setImportCandidate(preparation.candidate);
      }
      return { status: "success" };
    } catch (error) {
      clearPendingImport();
      return {
        status: "error",
        message: `操作失败：${error instanceof Error ? error.message : "未知错误"}`,
      };
    } finally {
      setIsPreparingImport(false);
    }
  }, [clearPendingImport]);

  const { activeViewport } = useModeViewportWorkspaces({
    mode,
    gridModel,
    customModel,
    baseConverterModel,
    simpleSteppedModel,
    steppedModel,
    steppedCadModel,
    steppedInteractionState,
  });

  const { activeWorkspace, getImportTarget } = useModeWorkspaces({
    mode,
    gridModel,
    customModel,
    baseConverterModel,
    simpleSteppedModel,
    steppedModel,
    steppedCadModel,
    steppedInteractionState,
    onRequestParamImport: requestParamImport,
  });

  const selectImportMode = useCallback(async (selectedMode: AppMode) => {
    if (!pendingImportFile) return;
    setIsPreparingImport(true);
    try {
      const preparation = await prepareParamImport(
        pendingImportFile,
        selectedMode,
      );
      if (preparation.status !== "ready") {
        throw new Error("所选 Mode 仍无法确定导入目标");
      }
      setModeSelection(null);
      setImportCandidate(preparation.candidate);
    } catch (error) {
      clearPendingImport();
      toast(
        "error",
        `参数文件处理失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setIsPreparingImport(false);
    }
  }, [clearPendingImport, pendingImportFile, toast]);

  const confirmParamImport = useCallback(() => {
    if (!importCandidate) return;
    const importTarget = getImportTarget(importCandidate.targetMode);
    activeViewport.resetTransientState();
    importTarget.commit(importCandidate.params);
    onModeChange(importCandidate.targetMode);
    toast(
      "success",
      importCandidate.targetMode === mode
        ? `已导入「${APP_MODE_LABELS[importCandidate.targetMode]}」参数`
        : `已导入参数并切换到「${APP_MODE_LABELS[importCandidate.targetMode]}」`,
    );
    clearPendingImport();
  }, [
    activeViewport,
    clearPendingImport,
    getImportTarget,
    importCandidate,
    mode,
    onModeChange,
    toast,
  ]);

  const targetRisk = importCandidate
    ? getImportTarget(importCandidate.targetMode)
    : null;

  const importOverlay = (
    <ParamImportDialog
      currentMode={mode}
      modeSelection={modeSelection}
      candidate={importCandidate}
      targetRisk={targetRisk ? {
        currentDraftId: targetRisk.currentDraftId,
        hasUnsavedChanges: targetRisk.hasUnsavedChanges,
      } : null}
      isPreparing={isPreparingImport}
      onSelectMode={(selectedMode) => void selectImportMode(selectedMode)}
      onCancel={clearPendingImport}
      onConfirm={confirmParamImport}
    />
  );

  return {
    activeWorkspace,
    activeViewport,
    importOverlay,
  };
}
