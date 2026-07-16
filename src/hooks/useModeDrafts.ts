"use client";

import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  createDraft,
  defaultDraftTitle,
  deleteDraft,
  exportDraft,
  getDraft,
  listDrafts,
  renameDraft,
  updateDraft,
  type DraftListItem,
  type DraftMode,
} from "@/lib/local-drafts";
import {
  bindDraftSession,
  clearDraftSession,
  createEmptyDraftSession,
  hasUnsavedDraftChanges,
  removeDraftSessionBinding,
  type DraftSession,
} from "@/lib/draft-session";
import { parseParamFileObject } from "@/lib/param-io";
import { serializeCurrentParamArtifact } from "@/lib/current-param-artifact-encoder";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type { DraftParamsByMode } from "@/lib/draft-summary";
import { useToast } from "@/hooks/useToast";

export interface UseModeDraftsOptions<M extends DraftMode> {
  mode: M;
  params: DraftParamsByMode[M];
  setParams: Dispatch<SetStateAction<DraftParamsByMode[M]>>;
  onAfterLoad?: () => void;
}

export interface UseModeDraftsReturn<M extends DraftMode> {
  currentDraftId: string | null;
  isDialogOpen: boolean;
  draftNameInput: string;
  hasUnsavedChanges: boolean;
  setDraftNameInput: (value: string) => void;
  openDialog: () => void;
  closeDialog: () => void;
  clearDraftBinding: () => void;
  getDraftList: () => DraftListItem<M>[];
  saveCurrentDraft: () => void;
  saveAsNewDraft: (title?: string) => void;
  loadDraft: (id: string) => void;
  renameDraftItem: (id: string, newTitle: string) => void;
  deleteDraftItem: (id: string) => void;
  exportDraftItem: (id: string) => void;
}

export function useModeDrafts<M extends DraftMode>({
  mode,
  params,
  setParams,
  onAfterLoad,
}: UseModeDraftsOptions<M>): UseModeDraftsReturn<M> {
  const { toast } = useToast();
  const [draftSession, setDraftSession] = useState<DraftSession>(() =>
    createEmptyDraftSession(),
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftNameInput, setDraftNameInput] = useState<string>(() =>
    defaultDraftTitle(mode),
  );
  const currentDraftId = draftSession.currentDraftId;

  const snapshot = useMemo(
    () => captureModeParamSnapshot(mode, params),
    [mode, params],
  );
  const serializedParams = useMemo(
    () => serializeCurrentParamArtifact(snapshot),
    [snapshot],
  );

  const hasUnsavedChanges = hasUnsavedDraftChanges(
    draftSession,
    serializedParams,
  );

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const clearDraftBinding = useCallback(() => {
    setDraftSession(clearDraftSession());
  }, []);

  const getDraftList = useCallback((): DraftListItem<M>[] => {
    return listDrafts(mode);
  }, [mode]);

  const saveCurrentDraft = useCallback(() => {
    if (!currentDraftId) {
      setIsDialogOpen(true);
      return;
    }

    try {
      const existing = getDraft(mode, currentDraftId);
      const title = existing?.item.title ?? defaultDraftTitle(mode);
      updateDraft(currentDraftId, title, snapshot);
      setDraftSession(bindDraftSession(currentDraftId, serializedParams));
      toast("success", `草稿「${title}」已更新`);
    } catch (error) {
      toast(
        "error",
        `保存失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [currentDraftId, mode, serializedParams, snapshot, toast]);

  const saveAsNewDraft = useCallback(
    (title?: string) => {
      const cleanTitle =
        (title ?? draftNameInput).trim() || defaultDraftTitle(mode);

      try {
        const record = createDraft(cleanTitle, snapshot);
        setDraftSession(bindDraftSession(record.item.id, serializedParams));
        setDraftNameInput(defaultDraftTitle(mode));
        setIsDialogOpen(false);
        toast("success", `草稿「${cleanTitle}」已保存`);
      } catch (error) {
        toast(
          "error",
          `保存失败：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [draftNameInput, mode, serializedParams, snapshot, toast],
  );

  const loadDraft = useCallback(
    (id: string) => {
      try {
        const record = getDraft(mode, id);
        if (!record) {
          toast("error", "草稿不存在或已损坏，无法加载");
          return;
        }

        const loaded = parseParamFileObject(record.paramFile, mode);

        setParams(loaded);
        setDraftSession(bindDraftSession(
          id,
          serializeCurrentParamArtifact(
            captureModeParamSnapshot(mode, loaded),
          ),
        ));
        setIsDialogOpen(false);
        onAfterLoad?.();
        toast("success", `已加载草稿「${record.item.title}」`);
      } catch (error) {
        toast(
          "error",
          `加载失败：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [mode, onAfterLoad, setParams, toast],
  );

  const renameDraftItem = useCallback(
    (id: string, newTitle: string) => {
      try {
        const record = renameDraft(mode, id, newTitle);
        toast("success", `已重命名为「${record.item.title}」`);
      } catch (error) {
        toast(
          "error",
          `重命名失败：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [mode, toast],
  );

  const deleteDraftItem = useCallback(
    (id: string) => {
      try {
        const record = getDraft(mode, id);
        const title = record?.item.title ?? id;
        deleteDraft(mode, id);
        setDraftSession((session) => removeDraftSessionBinding(session, id));
        toast("success", `草稿「${title}」已删除`);
      } catch (error) {
        toast(
          "error",
          `删除失败：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [mode, toast],
  );

  const exportDraftItem = useCallback(
    (id: string) => {
      try {
        exportDraft(mode, id);
        toast("success", "草稿已导出为 JSON 文件");
      } catch (error) {
        toast(
          "error",
          `导出失败：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [mode, toast],
  );

  return {
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
  };
}
