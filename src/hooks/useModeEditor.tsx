"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ModeReplacementConfirmDialog } from "@/components/ModeReplacementConfirmDialog";
import { ParamImportDialog } from "@/components/ParamImportDialog";
import { useBaseConverter } from "@/hooks/useBaseConverter";
import { useCustomLayout } from "@/hooks/useCustomLayout";
import { useModeInteractionState } from "@/hooks/useModeInteractionState";
import { useSteppedLayout } from "@/hooks/useSteppedLayout";
import { useToast } from "@/hooks/useToast";
import { useTrayModel } from "@/hooks/useTrayModel";
import {
  APP_MODE_LABELS,
  type ImportCandidate,
  type ImportModeSelectionRequired,
} from "@/lib/historical-param-artifact-reader";
import { prepareParamImport } from "@/lib/param-io";
import { createModeEditorCatalog } from "@/mode-editor/catalog";
import type { AppMode } from "@/types/custom-tray";
import { useBaseConverterViewportWorkspace } from "@/viewports/base-converter/useBaseConverterViewportWorkspace";
import { useCustomViewportWorkspace } from "@/viewports/custom/useCustomViewportWorkspace";
import { useGridViewportWorkspace } from "@/viewports/grid/useGridViewportWorkspace";
import { useSteppedViewportWorkspace } from "@/viewports/stepped/useSteppedViewportWorkspace";
import { useBaseConverterWorkspace } from "@/workspaces/base-converter/useBaseConverterWorkspace";
import { useCustomWorkspace } from "@/workspaces/custom/useCustomWorkspace";
import type { DraftActionResult } from "@/workspaces/draft-action-area";
import { useGridWorkspace } from "@/workspaces/grid/useGridWorkspace";
import { useSteppedWorkspace } from "@/workspaces/stepped/useSteppedWorkspace";
import type { ModeWorkspaceReplacementTarget } from "@/workspaces/types";
import type { PreparedDraftLoad } from "@/hooks/useModeDrafts";

export type ModeEditorIntent =
  | { type: "switch-mode"; mode: AppMode }
  | { type: "request-reset"; mode: AppMode }
  | { type: "request-param-import"; file: File }
  | { type: "select-import-mode"; mode: AppMode }
  | { type: "request-draft-load"; mode: AppMode; draftId: string }
  | { type: "confirm-replacement" }
  | { type: "cancel-replacement" };

export type ModeEditorResult =
  | { status: "completed" }
  | { status: "awaiting-confirmation" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export interface ModeEditor {
  readonly active: {
    readonly mode: AppMode;
    readonly panel: React.ReactNode;
    readonly viewport: React.ReactNode;
    readonly overlays: React.ReactNode;
  };
  perform: (intent: ModeEditorIntent) => Promise<ModeEditorResult>;
}

type DraftReplacementRequest = {
  [M in AppMode]: {
      kind: "draft";
      mode: M;
      prepared: PreparedDraftLoad<M>;
    };
}[AppMode];

type ReplacementRequest =
  | { kind: "reset"; mode: AppMode }
  | DraftReplacementRequest;

type ReplacementRisk = Pick<
  ModeWorkspaceReplacementTarget<AppMode>,
  "currentDraftId" | "hasUnsavedChanges" | "paramsRevision"
>;

interface PendingReplacement {
  request: ReplacementRequest;
  acknowledgedRisk: ReplacementRisk;
}

function readRisk(
  target: ReplacementRisk,
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

function commitDraftReplacement(
  catalog: ReturnType<typeof createModeEditorCatalog>,
  request: DraftReplacementRequest,
): void {
  switch (request.mode) {
    case "grid":
      catalog.grid.workspace.replacementTarget.commitDraftLoad(request.prepared);
      return;
    case "custom":
      catalog.custom.workspace.replacementTarget.commitDraftLoad(request.prepared);
      return;
    case "base-converter":
      catalog["base-converter"].workspace.replacementTarget.commitDraftLoad(
        request.prepared,
      );
      return;
    case "stepped":
      catalog.stepped.workspace.replacementTarget.commitDraftLoad(
        request.prepared,
      );
  }
}

function commitImportedCandidate(
  catalog: ReturnType<typeof createModeEditorCatalog>,
  candidate: ImportCandidate,
): void {
  switch (candidate.mode) {
    case "grid":
      catalog.grid.workspace.replacementTarget.commitImport(
        candidate.snapshot.params,
      );
      return;
    case "custom":
      catalog.custom.workspace.replacementTarget.commitImport(
        candidate.snapshot.params,
      );
      return;
    case "base-converter":
      catalog["base-converter"].workspace.replacementTarget.commitImport(
        candidate.snapshot.params,
      );
      return;
    case "stepped":
      catalog.stepped.workspace.replacementTarget.commitImport(
        candidate.snapshot.params,
      );
  }
}

function prepareDraftReplacement(
  catalog: ReturnType<typeof createModeEditorCatalog>,
  mode: AppMode,
  draftId: string,
): DraftReplacementRequest | null {
  switch (mode) {
    case "grid": {
      const prepared =
        catalog.grid.workspace.replacementTarget.prepareDraftLoad(draftId);
      return prepared ? { kind: "draft", mode, prepared } : null;
    }
    case "custom": {
      const prepared =
        catalog.custom.workspace.replacementTarget.prepareDraftLoad(draftId);
      return prepared ? { kind: "draft", mode, prepared } : null;
    }
    case "base-converter": {
      const prepared = catalog[
        "base-converter"
      ].workspace.replacementTarget.prepareDraftLoad(draftId);
      return prepared ? { kind: "draft", mode, prepared } : null;
    }
    case "stepped": {
      const prepared =
        catalog.stepped.workspace.replacementTarget.prepareDraftLoad(draftId);
      return prepared ? { kind: "draft", mode, prepared } : null;
    }
  }
}

/** 页面唯一的 Mode 生命周期与 Editing Session 替换入口。 */
export function useModeEditor(initialMode: AppMode = "grid"): ModeEditor {
  const { toast } = useToast();
  const [mode, setMode] = useState<AppMode>(initialMode);
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
  const performRef = useRef<
    (intent: ModeEditorIntent) => Promise<ModeEditorResult>
  >(async () => ({ status: "error", message: "Mode Editor 尚未装配" }));

  const requestParamImport = useCallback(async (
    file: File,
  ): Promise<DraftActionResult> => {
    const result = await performRef.current({
      type: "request-param-import",
      file,
    });
    return result.status === "error"
      ? result
      : { status: "success" };
  }, []);
  const requestReset = useCallback((targetMode: AppMode) => {
    void performRef.current({ type: "request-reset", mode: targetMode });
  }, []);
  const requestDraftLoad = useCallback((
    targetMode: AppMode,
    draftId: string,
  ) => {
    void performRef.current({
      type: "request-draft-load",
      mode: targetMode,
      draftId,
    });
  }, []);

  const gridWorkspace = useGridWorkspace({
    model: gridModel,
    onRequestParamImport: requestParamImport,
    onRequestReset: () => requestReset("grid"),
    onRequestDraftLoad: (draftId) => requestDraftLoad("grid", draftId),
  });
  const customWorkspace = useCustomWorkspace({
    model: customModel,
    interactionState: customInteractionState,
    onRequestParamImport: requestParamImport,
    onRequestReset: () => requestReset("custom"),
    onRequestDraftLoad: (draftId) => requestDraftLoad("custom", draftId),
  });
  const baseConverterWorkspace = useBaseConverterWorkspace({
    model: baseConverterModel,
    onRequestParamImport: requestParamImport,
    onRequestReset: () => requestReset("base-converter"),
    onRequestDraftLoad: (draftId) =>
      requestDraftLoad("base-converter", draftId),
  });
  const steppedWorkspace = useSteppedWorkspace({
    model: steppedModel,
    interactionState: steppedInteractionState,
    onRequestParamImport: requestParamImport,
    onRequestReset: () => requestReset("stepped"),
    onRequestDraftLoad: (draftId) => requestDraftLoad("stepped", draftId),
  });

  const gridViewport = useGridViewportWorkspace({ model: gridModel });
  const customViewport = useCustomViewportWorkspace({
    model: customModel,
    interactionState: customInteractionState,
  });
  const baseConverterViewport = useBaseConverterViewportWorkspace({
    model: baseConverterModel,
  });
  const steppedViewport = useSteppedViewportWorkspace({
    model: steppedModel,
    interactionState: steppedInteractionState,
    splitPreview: steppedModel.params.enableSplitAssembly ? {
      parts: steppedModel.splitPreviewParts,
      isGenerating: steppedModel.isGeneratingSplitPreview,
      generate: steppedModel.handleGenerateSplitPreview,
    } : undefined,
  }).workspace;

  const catalog = useMemo(() => createModeEditorCatalog({
    grid: { workspace: gridWorkspace, viewport: gridViewport },
    custom: { workspace: customWorkspace, viewport: customViewport },
    "base-converter": {
      workspace: baseConverterWorkspace,
      viewport: baseConverterViewport,
    },
    stepped: { workspace: steppedWorkspace, viewport: steppedViewport },
  }), [
    baseConverterViewport,
    baseConverterWorkspace,
    customViewport,
    customWorkspace,
    gridViewport,
    gridWorkspace,
    steppedViewport,
    steppedWorkspace,
  ]);
  const activeEntry = catalog[mode];

  const clearPendingImport = useCallback(() => {
    setPendingImportFile(null);
    setModeSelection(null);
    setImportCandidate(null);
    setImportRisk(null);
    setIsPreparingImport(false);
  }, []);

  const commitReplacement = useCallback((request: ReplacementRequest) => {
    const entry = catalog[request.mode];
    if (request.kind === "reset") {
      entry.workspace.replacementTarget.commitReset();
    } else {
      commitDraftReplacement(catalog, request);
    }
    entry.viewport.resetForSessionReplacement();
  }, [catalog]);

  const startReplacement = useCallback((
    request: ReplacementRequest,
  ): ModeEditorResult => {
    const target = catalog[request.mode].workspace.replacementTarget;
    const risk = readRisk(target);
    if (risk.hasUnsavedChanges) {
      setPendingReplacement({ request, acknowledgedRisk: risk });
      return { status: "awaiting-confirmation" };
    }
    commitReplacement(request);
    return { status: "completed" };
  }, [catalog, commitReplacement]);

  const prepareImport = useCallback(async (
    file: File,
    selectedMode?: AppMode,
  ): Promise<ModeEditorResult> => {
    setIsPreparingImport(true);
    try {
      const preparation = await prepareParamImport(file, selectedMode);
      setPendingImportFile(file);
      if (preparation.status === "mode-selection-required") {
        setModeSelection(preparation);
        setImportCandidate(null);
        setImportRisk(null);
      } else {
        setModeSelection(null);
        setImportCandidate(preparation.candidate);
        setImportRisk(readRisk(
          catalog[preparation.candidate.mode].workspace.replacementTarget,
        ));
      }
      return { status: "awaiting-confirmation" };
    } catch (error) {
      clearPendingImport();
      return {
        status: "error",
        message: `参数文件处理失败：${error instanceof Error ? error.message : "未知错误"}`,
      };
    } finally {
      setIsPreparingImport(false);
    }
  }, [catalog, clearPendingImport]);

  const confirmReplacement = useCallback((): ModeEditorResult => {
    if (importCandidate) {
      const entry = catalog[importCandidate.mode];
      const target = entry.workspace.replacementTarget;
      const currentRisk = readRisk(target);
      if (!importRisk || !isSameRisk(importRisk, currentRisk)) {
        setImportRisk(currentRisk);
        return { status: "awaiting-confirmation" };
      }
      if (importCandidate.mode !== mode) {
        activeEntry.viewport.deactivate();
      }
      commitImportedCandidate(catalog, importCandidate);
      entry.viewport.resetForSessionReplacement();
      setMode(importCandidate.mode);
      toast(
        "success",
        importCandidate.mode === mode
          ? `已导入「${APP_MODE_LABELS[importCandidate.mode]}」参数`
          : `已导入参数并切换到「${APP_MODE_LABELS[importCandidate.mode]}」`,
      );
      clearPendingImport();
      return { status: "completed" };
    }
    if (!pendingReplacement) {
      return { status: "error", message: "当前没有待确认的替换操作" };
    }
    const target =
      catalog[pendingReplacement.request.mode].workspace.replacementTarget;
    const currentRisk = readRisk(target);
    if (!isSameRisk(pendingReplacement.acknowledgedRisk, currentRisk)) {
      setPendingReplacement({
        request: pendingReplacement.request,
        acknowledgedRisk: currentRisk,
      });
      return { status: "awaiting-confirmation" };
    }
    commitReplacement(pendingReplacement.request);
    setPendingReplacement(null);
    return { status: "completed" };
  }, [
    activeEntry.viewport,
    catalog,
    clearPendingImport,
    commitReplacement,
    importCandidate,
    importRisk,
    mode,
    pendingReplacement,
    toast,
  ]);

  const perform = useCallback(async (
    intent: ModeEditorIntent,
  ): Promise<ModeEditorResult> => {
    switch (intent.type) {
      case "switch-mode":
        if (intent.mode !== mode) {
          activeEntry.viewport.deactivate();
          setMode(intent.mode);
        }
        return { status: "completed" };
      case "request-reset":
        return startReplacement({ kind: "reset", mode: intent.mode });
      case "request-param-import":
        return prepareImport(intent.file);
      case "select-import-mode":
        if (!pendingImportFile) {
          return { status: "error", message: "没有等待选择 Mode 的参数文件" };
        }
        return prepareImport(pendingImportFile, intent.mode);
      case "request-draft-load": {
        const request = prepareDraftReplacement(
          catalog,
          intent.mode,
          intent.draftId,
        );
        if (!request) {
          return { status: "error", message: "Draft 不存在或无法读取" };
        }
        return startReplacement(request);
      }
      case "confirm-replacement":
        return confirmReplacement();
      case "cancel-replacement":
        clearPendingImport();
        setPendingReplacement(null);
        return { status: "cancelled" };
    }
  }, [
    activeEntry.viewport,
    catalog,
    clearPendingImport,
    confirmReplacement,
    mode,
    pendingImportFile,
    prepareImport,
    startReplacement,
  ]);
  performRef.current = perform;

  const overlays = (
    <>
      {activeEntry.workspace.overlays}
      <ParamImportDialog
        currentMode={mode}
        modeSelection={modeSelection}
        candidate={importCandidate}
        targetRisk={importRisk}
        isPreparing={isPreparingImport}
        onSelectMode={(selectedMode) => {
          void perform({ type: "select-import-mode", mode: selectedMode });
        }}
        onCancel={() => {
          void perform({ type: "cancel-replacement" });
        }}
        onConfirm={() => {
          void perform({ type: "confirm-replacement" });
        }}
      />
      <ModeReplacementConfirmDialog
        mode={pendingReplacement?.request.mode ?? null}
        kind={pendingReplacement?.request.kind ?? null}
        onCancel={() => {
          void perform({ type: "cancel-replacement" });
        }}
        onConfirm={() => {
          void perform({ type: "confirm-replacement" });
        }}
      />
    </>
  );

  return {
    active: {
      mode,
      panel: activeEntry.workspace.panel,
      viewport: activeEntry.viewport.viewport,
      overlays,
    },
    perform,
  };
}
