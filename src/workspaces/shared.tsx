"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { DraftManagerDialog } from "@/components/DraftManagerDialog";
import type { DraftManagerDialogProps } from "@/components/DraftManagerDialog";
import { useModeDrafts } from "@/hooks/useModeDrafts";
import type { UseModeDraftsOptions } from "@/hooks/useModeDrafts";
import type { AnyDraftListItem, DraftMode } from "@/lib/local-drafts";

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
    case "base-converter":
      return (
        <>
          <span>{item.sourceLabel} → {item.targetLabel}</span>
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

export interface WorkspaceDraftActions {
  currentDraftId: string | null;
  hasUnsavedChanges: boolean;
  onSaveDraft: () => void;
  onOpenDraftDialog: () => void;
}

interface WorkspaceDraftSupport {
  draftActions: WorkspaceDraftActions;
  overlays: ReactNode;
  clearDraftBinding: () => void;
}

export function useWorkspaceDraftSupport<M extends DraftMode>(
  options: UseModeDraftsOptions<M>,
): WorkspaceDraftSupport {
  const {
    currentDraftId,
    isDialogOpen,
    draftNameInput,
    hasUnsavedChanges,
    setDraftNameInput,
    openDialog,
    closeDialog,
    clearDraftBinding,
    getDraftList,
    saveCurrentDraft,
    saveAsNewDraft,
    loadDraft,
    renameDraftItem,
    deleteDraftItem,
    exportDraftItem,
  } = useModeDrafts(options);

  const [draftListVersion, setDraftListVersion] = useState(0);
  const refreshDraftList = useCallback(() => {
    setDraftListVersion((version) => version + 1);
  }, []);

  const draftList = useMemo(() => {
    void draftListVersion;
    return getDraftList() as unknown as AnyDraftListItem[];
  }, [draftListVersion, getDraftList]);

  const openDraftDialog = useCallback(() => {
    refreshDraftList();
    openDialog();
  }, [openDialog, refreshDraftList]);

  const draftActions = useMemo<WorkspaceDraftActions>(
    () => ({
      currentDraftId,
      hasUnsavedChanges,
      onSaveDraft: saveCurrentDraft,
      onOpenDraftDialog: openDraftDialog,
    }),
    [currentDraftId, hasUnsavedChanges, openDraftDialog, saveCurrentDraft],
  );

  const draftDialogProps = useMemo<DraftManagerDialogProps<AnyDraftListItem>>(
    () => ({
      mode: options.mode,
      open: isDialogOpen,
      onOpenChange: (open) => {
        if (!open) {
          closeDialog();
          return;
        }
        openDraftDialog();
      },
      drafts: draftList,
      currentDraftId,
      hasUnsavedChanges,
      draftNameInput,
      onDraftNameInputChange: setDraftNameInput,
      onSaveAsNew: () => {
        saveAsNewDraft();
        refreshDraftList();
      },
      onSaveCurrent: () => {
        saveCurrentDraft();
        refreshDraftList();
      },
      onLoad: (id) => {
        loadDraft(id);
        refreshDraftList();
      },
      onRename: (id, title) => {
        renameDraftItem(id, title);
        refreshDraftList();
      },
      onDelete: (id) => {
        deleteDraftItem(id);
        refreshDraftList();
      },
      onExport: (id) => exportDraftItem(id),
      renderSummary: renderDraftSummary,
    }),
    [
      closeDialog,
      currentDraftId,
      deleteDraftItem,
      draftList,
      draftNameInput,
      exportDraftItem,
      hasUnsavedChanges,
      isDialogOpen,
      loadDraft,
      openDraftDialog,
      refreshDraftList,
      renameDraftItem,
      saveAsNewDraft,
      saveCurrentDraft,
      setDraftNameInput,
      options.mode,
    ],
  );

  const overlays = useMemo(
    () => <DraftManagerDialog {...draftDialogProps} />,
    [draftDialogProps],
  );

  return {
    draftActions,
    overlays,
    clearDraftBinding,
  };
}
