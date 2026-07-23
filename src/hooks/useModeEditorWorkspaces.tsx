"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ParamImportDialog } from "@/components/ParamImportDialog";
import { ModeReplacementConfirmDialog } from "@/components/ModeReplacementConfirmDialog";
import { useCustomLayout } from "@/hooks/useCustomLayout";
import { useBaseConverter } from "@/hooks/useBaseConverter";
import { useModeInteractionState } from "@/hooks/useModeInteractionState";
import { useModeViewportWorkspaces } from "@/hooks/useModeViewportWorkspaces";
import { useModeWorkspaces } from "@/hooks/useModeWorkspaces";
import { useSteppedLayout } from "@/hooks/useSteppedLayout";
import { useTrayModel } from "@/hooks/useTrayModel";
import type { AppMode } from "@/types/custom-tray";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type {
  ModeWorkspace,
  ModeWorkspaceReplacementTarget,
} from "@/workspaces/types";
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

type ReplacementRisk = Pick<
  ModeWorkspaceReplacementTarget,
  "currentDraftId" | "hasUnsavedChanges" | "paramsRevision"
>;

interface PendingReplacement {
  request: ReplacementRequest;
  acknowledgedRisk: ReplacementRisk;
}

function readRisk(
  target: ModeWorkspaceReplacementTarget,
): ReplacementRisk {
  return {
    currentDraftId: target.currentDraftId,
    hasUnsavedChanges: target.hasUnsavedChanges,
    paramsRevision: target.paramsRevision,
  };
}

function isSameRisk(left: ReplacementRisk, right: ReplacementRisk): boolean {
  return (
    left.currentDraftId === right.currentDraftId &&
    left.hasUnsavedChanges === right.hasUnsavedChanges &&
    left.paramsRevision === right.paramsRevision
  );
}

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
  const [importRisk, setImportRisk] = useState<ReplacementRisk | null>(null);
  const [pendingReplacement, setPendingReplacement] =
    useState<PendingReplacement | null>(null);
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
  const replacementTargetGetterRef = useRef<
    (mode: AppMode) => ModeWorkspaceReplacementTarget
  >(() => {
    throw new Error("Mode Editor replacement target 尚未装配");
  });
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
    setImportRisk(null);
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
        setImportRisk(readRisk(
          replacementTargetGetterRef.current(preparation.candidate.mode),
        ));
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
  replacementTargetGetterRef.current = getReplacementTarget;

  const commitReplacement = useCallback((request: ReplacementRequest) => {
    const target = getReplacementTarget(request.mode);
    getViewport(request.mode).resetForSessionReplacement();
    if (request.kind === "reset") {
      target.commitReset();
      return;
    }
    target.commitDraftLoad(request.prepared);
  }, [getReplacementTarget, getViewport]);
  replacementRequestRef.current = (request) => {
    const target = getReplacementTarget(request.mode);
    const risk = readRisk(target);
    if (risk.hasUnsavedChanges) {
      setPendingReplacement({ request, acknowledgedRisk: risk });
      return;
    }
    commitReplacement(request);
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
      setImportRisk(readRisk(
        replacementTargetGetterRef.current(preparation.candidate.mode),
      ));
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
    const currentRisk = readRisk(importTarget);
    if (!importRisk || !isSameRisk(importRisk, currentRisk)) {
      setImportRisk(currentRisk);
      return;
    }
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
    importRisk,
    mode,
    onModeChange,
    activeViewport,
    toast,
  ]);

  const confirmPendingReplacement = useCallback(() => {
    if (!pendingReplacement) return;
    const target = getReplacementTarget(pendingReplacement.request.mode);
    const currentRisk = readRisk(target);
    if (!isSameRisk(pendingReplacement.acknowledgedRisk, currentRisk)) {
      setPendingReplacement({
        request: pendingReplacement.request,
        acknowledgedRisk: currentRisk,
      });
      return;
    }
    commitReplacement(pendingReplacement.request);
    setPendingReplacement(null);
  }, [commitReplacement, getReplacementTarget, pendingReplacement]);

  const importOverlay = (
    <>
      <ParamImportDialog
        currentMode={mode}
        modeSelection={modeSelection}
        candidate={importCandidate}
        targetRisk={importRisk}
        isPreparing={isPreparingImport}
        onSelectMode={(selectedMode) => void selectImportMode(selectedMode)}
        onCancel={clearPendingImport}
        onConfirm={confirmParamImport}
      />
      <ModeReplacementConfirmDialog
        mode={pendingReplacement?.request.mode ?? null}
        kind={pendingReplacement?.request.kind ?? null}
        onCancel={() => setPendingReplacement(null)}
        onConfirm={confirmPendingReplacement}
      />
    </>
  );

  return {
    activeWorkspace,
    activeViewport,
    importOverlay,
  };
}
