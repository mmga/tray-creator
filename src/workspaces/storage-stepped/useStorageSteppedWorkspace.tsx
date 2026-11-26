"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { PanelActionSection } from "@/components/PanelActionSection";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { UseStorageSteppedReturn } from "@/hooks/useStorageStepped";
import { useWorkspaceDraftSupport } from "@/workspaces/shared";
import type { ModeWorkspace } from "@/workspaces/types";
import {
  modelExportAvailability,
  modelGenerationAvailability,
  type StorageSteppedDraftActionAreaAdapter,
  type DraftActionResult,
} from "@/workspaces/draft-action-area";
import {
  createDefaultStorageSteppedParams,
  storageSteppedTrayPartId,
} from "@/lib/storage-stepped-config";
import { downloadParamFile } from "@/lib/param-download";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type { StorageSteppedParams } from "@/types/storage-stepped";

const StorageSteppedPanel = dynamic(
  () => import("@/components/StorageSteppedPanel").then((mod) => mod.StorageSteppedPanel),
  { ssr: false },
);

export type StorageSteppedWorkspaceModel = UseStorageSteppedReturn;

interface UseStorageSteppedWorkspaceOptions {
  model: StorageSteppedWorkspaceModel;
  interactionState: ModeInteractionState;
  onRequestParamImport: (file: File) => Promise<DraftActionResult>;
  onRequestReset: () => void;
  onRequestDraftLoad: Parameters<
    typeof useWorkspaceDraftSupport<"storage-stepped">
  >[0]["requestDraftLoad"];
}

export function useStorageSteppedWorkspace({
  model,
  interactionState,
  onRequestParamImport,
  onRequestReset,
  onRequestDraftLoad,
}: UseStorageSteppedWorkspaceOptions): ModeWorkspace<"storage-stepped"> {
  const { selectedSlotIds, resetInteractionState } = interactionState;
  const {
    draftActions,
    overlays,
    clearDraftBinding,
    prepareDraftLoad,
    commitLoadedDraftBinding,
  } = useWorkspaceDraftSupport({
    mode: "storage-stepped",
    params: model.persistedParams,
    requestDraftLoad: onRequestDraftLoad,
  });

  const resetWorkspace = useCallback(() => {
    model.setParams(createDefaultStorageSteppedParams());
    resetInteractionState();
    clearDraftBinding();
  }, [clearDraftBinding, model, resetInteractionState]);

  const importIntoWorkspace = useCallback((params: StorageSteppedParams) => {
    model.setParams(params);
    resetInteractionState();
    clearDraftBinding();
  }, [clearDraftBinding, model, resetInteractionState]);

  const actions = useMemo(() => {
    const currentTrayPartId = storageSteppedTrayPartId(model.currentStepIndex);
    const adapter: StorageSteppedDraftActionAreaAdapter = {
      kind: "storage-stepped",
      state: {
        currentDraftId: draftActions.currentDraftId,
        hasUnsavedChanges: draftActions.hasUnsavedChanges,
        stale: model.isPreviewStale,
        // 单个托盘非法不阻断主体与其他托盘的生成；参数级错误通过主体阻断原因体现。
        generate: modelGenerationAvailability(
          model.isGenerating,
          model.getPartBlockingReason("body"),
        ),
        exportWhole: modelExportAvailability(model.blockingReason),
        exportBody: modelExportAvailability(
          model.getPartBlockingReason("body"),
        ),
        exportTray: modelExportAvailability(
          model.getPartBlockingReason(currentTrayPartId),
        ),
        exportAll: modelExportAvailability(model.blockingReason),
        preview: { kind: "manual" },
      },
      async perform(intent) {
        try {
          switch (intent.type) {
            case "generate":
              await model.handleGenerate();
              break;
            case "export-whole":
            case "export-all":
              await model.handleExportAll();
              break;
            case "export-body":
              await model.handleExportBody();
              break;
            case "export-tray":
              await model.handleExportCurrentTray();
              break;
            case "save-draft":
              draftActions.onSaveDraft();
              break;
            case "open-drafts":
              draftActions.onOpenDraftDialog();
              break;
            case "export-params":
              downloadParamFile(
                captureModeParamSnapshot("storage-stepped", model.persistedParams),
                "storage-stepped-params.json",
              );
              break;
            case "import-params":
              return onRequestParamImport(intent.file);
            case "reset":
              onRequestReset();
              break;
          }
          return { status: "success" };
        } catch (error) {
          return {
            status: "error",
            message: `操作失败：${error instanceof Error ? error.message : "未知错误"}`,
          };
        }
      },
    };
    return <PanelActionSection adapter={adapter} />;
  }, [draftActions, model, onRequestParamImport, onRequestReset]);

  const panel = useMemo(
    () => (
      <StorageSteppedPanel
        model={model}
        selectedSlotIds={selectedSlotIds}
        actions={actions}
      />
    ),
    [actions, model, selectedSlotIds],
  );

  return {
    mode: "storage-stepped",
    panel,
    overlays,
    replacementTarget: {
      mode: "storage-stepped",
      currentDraftId: draftActions.currentDraftId,
      hasUnsavedChanges: draftActions.hasUnsavedChanges,
      paramsRevision: model.transactionRevision,
      prepareDraftLoad,
      commitReset: resetWorkspace,
      commitImport: importIntoWorkspace,
      commitDraftLoad: (prepared) => {
        model.setParams(prepared.snapshot.params);
        resetInteractionState();
        commitLoadedDraftBinding(prepared);
      },
    },
  };
}
