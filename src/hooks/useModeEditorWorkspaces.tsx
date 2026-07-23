"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ParamImportDialog } from "@/components/ParamImportDialog";
import { useCustomLayout } from "@/hooks/useCustomLayout";
import { useBaseConverter } from "@/hooks/useBaseConverter";
import { useModeInteractionState } from "@/hooks/useModeInteractionState";
import { useModeViewportWorkspaces } from "@/hooks/useModeViewportWorkspaces";
import { useModeWorkspaces } from "@/hooks/useModeWorkspaces";
import { useSteppedLayout } from "@/hooks/useSteppedLayout";
import { useTrayModel } from "@/hooks/useTrayModel";
import type { AppMode } from "@/types/custom-tray";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { ModeWorkspace } from "@/workspaces/types";
import {
  prepareParamImport,
} from "@/lib/param-io";
import {
  APP_MODE_LABELS,
  type ImportCandidate,
  type ImportModeSelectionRequired,
} from "@/lib/historical-param-artifact-reader";
import type { DraftActionResult } from "@/workspaces/draft-action-area";
import { useToast } from "@/hooks/useToast";
import { createModeEditorCatalog } from "@/mode-editor/catalog";
import type { PreparedDraftLoad } from "@/hooks/useModeDrafts";

type ReplacementRequest =
  | { kind: "reset"; mode: AppMode }
  | {
      kind: "draft";
      mode: AppMode;
      prepared: PreparedDraftLoad<AppMode>;
    };

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
  const steppedModel = useSteppedLayout();
  const customInteractionState = useModeInteractionState();
  const steppedInteractionState = useModeInteractionState();
  const replacementRequestRef = useRef<(request: ReplacementRequest) => void>(
    () => {},
  );
  const requestReset = useCallback((targetMode: AppMode) => {
    replacementRequestRef.current({ kind: "reset", mode: targetMode });
  }, []);
  const requestDraftLoad = useCallback((
    targetMode: AppMode,
    prepared: PreparedDraftLoad<AppMode>,
  ) => {
    replacementRequestRef.current({
      kind: "draft",
      mode: targetMode,
      prepared,
    });
  }, []);

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

  const { getViewport } = useModeViewportWorkspaces({
    mode,
    gridModel,
    customModel,
    baseConverterModel,
    steppedModel,
    customInteractionState,
    steppedInteractionState,
  });

  const { getWorkspace, getReplacementTarget } = useModeWorkspaces({
    mode,
    gridModel,
    customModel,
    baseConverterModel,
    steppedModel,
    customInteractionState,
    steppedInteractionState,
    onRequestParamImport: requestParamImport,
    onRequestReset: requestReset,
    onRequestDraftLoad: requestDraftLoad,
  });

  const catalog = useMemo(() => createModeEditorCatalog({
    grid: { workspace: getWorkspace("grid"), viewport: getViewport("grid") },
    custom: { workspace: getWorkspace("custom"), viewport: getViewport("custom") },
    "base-converter": {
      workspace: getWorkspace("base-converter"),
      viewport: getViewport("base-converter"),
    },
    stepped: { workspace: getWorkspace("stepped"), viewport: getViewport("stepped") },
  }), [getViewport, getWorkspace]);
  const activeWorkspace = catalog[mode].workspace;
  const activeViewport = catalog[mode].viewport;
  replacementRequestRef.current = (request) => {
    const target = getReplacementTarget(request.mode);
    getViewport(request.mode).resetForSessionReplacement();
    if (request.kind === "reset") {
      target.commitReset();
      return;
    }
    target.commitDraftLoad(request.prepared);
  };

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
    const importTarget = getReplacementTarget(importCandidate.mode);
    if (importCandidate.mode !== mode) {
      activeViewport.deactivate();
    }
    getViewport(importCandidate.mode).resetForSessionReplacement();
    importTarget.commitImport(importCandidate.snapshot.params);
    onModeChange(importCandidate.mode);
    toast(
      "success",
      importCandidate.mode === mode
        ? `已导入「${APP_MODE_LABELS[importCandidate.mode]}」参数`
        : `已导入参数并切换到「${APP_MODE_LABELS[importCandidate.mode]}」`,
    );
    clearPendingImport();
  }, [
    clearPendingImport,
    getReplacementTarget,
    getViewport,
    importCandidate,
    mode,
    onModeChange,
    toast,
  ]);

  const targetRisk = importCandidate
    ? getReplacementTarget(importCandidate.mode)
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
