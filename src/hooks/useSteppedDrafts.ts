"use client";

import { useState, useCallback } from "react";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import {
  listDrafts,
  getDraft,
  createDraft,
  updateDraft,
  renameDraft,
  deleteDraft,
  exportDraft,
  defaultDraftTitle,
  type DraftListItem,
} from "@/lib/local-drafts";
import { parseParamFileObject } from "@/lib/param-io";
import { useToast } from "@/hooks/useToast";

// ═══════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════

export interface UseSteppedDraftsOptions {
  /** 当前 stepped 参数 */
  params: SteppedLayoutParams;
  /** 替换当前编辑器参数 */
  setParams: React.Dispatch<React.SetStateAction<SteppedLayoutParams>>;
  /** 加载草稿成功后执行，用于清理页面级状态（选中槽位、组预览等） */
  onAfterLoad?: () => void;
}

export interface UseSteppedDraftsReturn {
  /** 当前绑定的草稿 id，若未绑定则为 null */
  currentDraftId: string | null;
  /** 草稿弹窗是否打开 */
  isDialogOpen: boolean;
  /** 弹窗内的名称输入框值 */
  draftNameInput: string;
  /** 设置名称输入框 */
  setDraftNameInput: (v: string) => void;
  /** 打开草稿弹窗 */
  openDialog: () => void;
  /** 关闭草稿弹窗 */
  closeDialog: () => void;
  /** 获取所有草稿列表（每次调用会重新读 localStorage） */
  getDraftList: () => DraftListItem[];
  /**
   * 覆盖保存当前已绑定的草稿。
   * 若 currentDraftId 为 null，则自动走 saveAsNewDraft 逻辑。
   */
  saveCurrentDraft: () => void;
  /** 将当前参数另存为新草稿 */
  saveAsNewDraft: (title?: string) => void;
  /** 加载指定草稿 */
  loadDraft: (id: string) => void;
  /** 重命名草稿（只改名称，不改参数） */
  renameDraftItem: (id: string, newTitle: string) => void;
  /** 删除草稿 */
  deleteDraftItem: (id: string) => void;
  /** 将草稿导出为 JSON 文件下载 */
  exportDraftItem: (id: string) => void;
}

// ═══════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════

export function useSteppedDrafts({
  params,
  setParams,
  onAfterLoad,
}: UseSteppedDraftsOptions): UseSteppedDraftsReturn {
  const { toast } = useToast();
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftNameInput, setDraftNameInput] = useState<string>(() =>
    defaultDraftTitle(),
  );

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const getDraftList = useCallback((): DraftListItem[] => {
    return listDrafts("stepped");
  }, []);

  const saveCurrentDraft = useCallback(() => {
    if (!currentDraftId) {
      // 没有绑定草稿 → 自动打开弹窗让用户输入名称
      setIsDialogOpen(true);
      return;
    }
    try {
      const existing = getDraft(currentDraftId);
      const title = existing?.item.title ?? defaultDraftTitle();
      updateDraft(currentDraftId, title, params);
      toast("success", `草稿「${title}」已更新`);
    } catch (e) {
      toast("error", `保存失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }, [currentDraftId, params, toast]);

  const saveAsNewDraft = useCallback(
    (title?: string) => {
      const cleanTitle = (title ?? draftNameInput).trim() || defaultDraftTitle();
      try {
        const record = createDraft(cleanTitle, params);
        setCurrentDraftId(record.item.id);
        setDraftNameInput(defaultDraftTitle());
        toast("success", `草稿「${cleanTitle}」已保存`);
        setIsDialogOpen(false);
      } catch (e) {
        toast("error", `保存失败：${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [draftNameInput, params, toast],
  );

  const loadDraft = useCallback(
    (id: string) => {
      try {
        const record = getDraft(id);
        if (!record) {
          toast("error", "草稿不存在或已损坏，无法加载");
          return;
        }
        // 使用共享校验逻辑解析参数
        const loaded = parseParamFileObject(record.paramFile, "stepped");
        setParams(loaded as SteppedLayoutParams);
        setCurrentDraftId(id);
        onAfterLoad?.();
        setIsDialogOpen(false);
        toast("success", `已加载草稿「${record.item.title}」`);
      } catch (e) {
        toast(
          "error",
          `加载失败：${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [onAfterLoad, setParams, toast],
  );

  const renameDraftItem = useCallback(
    (id: string, newTitle: string) => {
      try {
        const record = renameDraft(id, newTitle);
        toast("success", `已重命名为「${record.item.title}」`);
      } catch (e) {
        toast(
          "error",
          `重命名失败：${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [toast],
  );

  const deleteDraftItem = useCallback(
    (id: string) => {
      try {
        const record = getDraft(id);
        const title = record?.item.title ?? id;
        deleteDraft(id);
        // 若删除的是当前绑定草稿，解绑
        if (currentDraftId === id) {
          setCurrentDraftId(null);
        }
        toast("success", `草稿「${title}」已删除`);
      } catch (e) {
        toast(
          "error",
          `删除失败：${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [currentDraftId, toast],
  );

  const exportDraftItem = useCallback(
    (id: string) => {
      try {
        exportDraft(id);
        toast("success", "草稿已导出为 JSON 文件");
      } catch (e) {
        toast(
          "error",
          `导出失败：${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [toast],
  );

  return {
    currentDraftId,
    isDialogOpen,
    draftNameInput,
    setDraftNameInput,
    openDialog,
    closeDialog,
    getDraftList,
    saveCurrentDraft,
    saveAsNewDraft,
    loadDraft,
    renameDraftItem,
    deleteDraftItem,
    exportDraftItem,
  };
}
