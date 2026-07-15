"use client";

import { useState, type ReactNode } from "react";
import {
  BookMarked,
  Check,
  Clock,
  Download,
  FolderOpen,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { AppMode } from "@/types/custom-tray";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDraftTime, MAX_DRAFTS_PER_MODE } from "@/lib/local-drafts";

const MODE_DIALOG_TITLE: Record<AppMode, string> = {
  grid: "网格模式草稿",
  custom: "自定义模式草稿",
  "base-converter": "转换底盘草稿",
  "simple-stepped": "简易阶梯草稿",
  stepped: "阶梯模式草稿",
  "stepped-cad": "CAD 阶梯草稿",
};

export interface DraftManagerItem {
  id: string;
  title: string;
  updatedAt: string;
}

export interface DraftManagerDialogProps<TItem extends DraftManagerItem> {
  mode: AppMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: TItem[];
  currentDraftId: string | null;
  hasUnsavedChanges: boolean;
  draftNameInput: string;
  onDraftNameInputChange: (value: string) => void;
  onSaveAsNew: () => void;
  onSaveCurrent: () => void;
  onLoad: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  renderSummary: (item: TItem) => ReactNode;
}

interface DraftItemRowProps<TItem extends DraftManagerItem> {
  item: TItem;
  isCurrent: boolean;
  onLoad: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
  onExport: () => void;
  renderSummary: (item: TItem) => ReactNode;
}

function DraftItemRow<TItem extends DraftManagerItem>({
  item,
  isCurrent,
  onLoad,
  onRename,
  onDelete,
  onExport,
  renderSummary,
}: DraftItemRowProps<TItem>) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [pendingTitle, setPendingTitle] = useState(item.title);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const commitRename = () => {
    if (pendingTitle.trim()) {
      onRename(pendingTitle.trim());
    }
    setEditingTitle(false);
  };

  const cancelRename = () => {
    setPendingTitle(item.title);
    setEditingTitle(false);
  };

  const startRename = () => {
    setPendingTitle(item.title);
    setConfirmDelete(false);
    setEditingTitle(true);
  };

  return (
    <div
      className={`rounded border transition-colors ${
        isCurrent
          ? "border-[#5a4a2a] bg-[#1e1a10]"
          : "border-[#2e2a24] bg-[#16140e] hover:border-[#3d372e]"
      }`}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        {editingTitle ? (
          <>
            <Input
              value={pendingTitle}
              onChange={(event) => setPendingTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitRename();
                if (event.key === "Escape") cancelRename();
              }}
              autoFocus
              className="h-6 flex-1 bg-[#1c1a16] px-2 text-xs border-[#5a4a2a]"
            />
            <button
              type="button"
              onClick={commitRename}
              className="text-[#8cb880] transition-colors hover:text-[#a8d49a]"
              title="确认"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelRename}
              className="text-muted-foreground transition-colors hover:text-foreground"
              title="取消"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 truncate text-xs font-medium text-foreground">
              {item.title}
            </span>
            {isCurrent ? (
              <span className="shrink-0 rounded border border-[#5a4a2a] bg-[#2a2518] px-1.5 py-0.5 text-[10px] text-[#c8a84e]">
                当前
              </span>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-3 pb-2 text-[10px] text-muted-foreground/70">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDraftTime(item.updatedAt)}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {renderSummary(item)}
        </div>
      </div>

      <div className="flex items-center gap-1 border-t border-[#2a2518] px-2 py-1.5">
        {confirmDelete ? (
          <div className="flex flex-1 items-center gap-2">
            <span className="text-[10px] text-red-400">确认删除？</span>
            <button
              type="button"
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              className="rounded border border-red-800 px-2 py-0.5 text-[10px] text-red-400 transition-colors hover:text-red-300"
            >
              删除
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded border border-[#2e2a24] px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              取消
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onLoad}
              className="flex items-center gap-1 rounded border border-[#4a6741] px-2 py-0.5 text-[10px] text-[#8cb880] transition-colors hover:border-[#5a7a51] hover:text-[#a8d49a]"
            >
              <FolderOpen className="h-3 w-3" />
              加载
            </button>
            <button
              type="button"
              onClick={startRename}
              className="flex items-center gap-1 rounded border border-[#2e2a24] px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-[#3d372e] hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              重命名
            </button>
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-1 rounded border border-[#2e2a24] px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-[#3d372e] hover:text-foreground"
            >
              <Download className="h-3 w-3" />
              导出
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto flex items-center gap-1 rounded border border-transparent px-2 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:border-red-900 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
              删除
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function DraftManagerDialog<TItem extends DraftManagerItem>({
  mode,
  open,
  onOpenChange,
  drafts,
  currentDraftId,
  hasUnsavedChanges,
  draftNameInput,
  onDraftNameInputChange,
  onSaveAsNew,
  onSaveCurrent,
  onLoad,
  onRename,
  onDelete,
  onExport,
  renderSummary,
}: DraftManagerDialogProps<TItem>) {
  const currentDraft = drafts.find((draft) => draft.id === currentDraftId) ?? null;
  const isAtLimit = drafts.length >= MAX_DRAFTS_PER_MODE;
  const isNearLimit = !isAtLimit && drafts.length >= MAX_DRAFTS_PER_MODE - 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-[#c8a84e]" />
            {MODE_DIALOG_TITLE[mode]}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
          <div className="space-y-2.5 rounded border border-[#2e2a24] bg-[#16140e] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              保存当前配置
            </div>

            {currentDraft ? (
              <div className="flex flex-wrap items-center gap-2 rounded bg-[#2a2518]/60 px-2 py-1.5 text-xs text-[#c8a84e]/80">
                <BookMarked className="h-3 w-3 shrink-0" />
                <span className="flex-1 truncate">{currentDraft.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatDraftTime(currentDraft.updatedAt)}
                </span>
                {hasUnsavedChanges ? (
                  <span className="shrink-0 rounded border border-[#5a4a2a] bg-[#1f1a12] px-1.5 py-0.5 text-[10px] text-[#e3c774]">
                    有未保存修改
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="flex gap-2">
              <Input
                value={draftNameInput}
                onChange={(event) => onDraftNameInputChange(event.target.value)}
                placeholder="草稿名称（留空自动生成）"
                disabled={isAtLimit}
                className="h-8 flex-1 border-[#3d372e] bg-[#1c1a16] text-xs placeholder:text-muted-foreground/40"
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSaveAsNew();
                }}
              />
              <Button
                size="sm"
                onClick={onSaveAsNew}
                disabled={isAtLimit}
                className="h-8 shrink-0 border border-[#4a6741] bg-[#2a3528] text-xs text-[#8cb880] shadow-none hover:bg-[#354530] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="mr-1 h-3 w-3" />
                另存新草稿
              </Button>
            </div>

            {currentDraft ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onSaveCurrent}
                className="h-8 w-full border-[#5a4a2a] text-xs text-[#c8a84e] hover:border-[#7a6a3a] hover:bg-[#2a2518]"
              >
                <Save className="mr-1 h-3 w-3" />
                覆盖「{currentDraft.title}」
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                已保存草稿
              </div>
              <div
                className={`text-[10px] font-mono ${
                  isAtLimit
                    ? "text-red-400"
                    : isNearLimit
                      ? "text-[#c8a84e]"
                      : "text-muted-foreground/50"
                }`}
              >
                {drafts.length} / {MAX_DRAFTS_PER_MODE}
              </div>
            </div>

            {isAtLimit ? (
              <div className="rounded border border-red-900/50 bg-red-950/30 px-2.5 py-1.5 text-[10px] text-red-400">
                草稿数量已达上限，请在列表中删除不需要的草稿
              </div>
            ) : null}
            {isNearLimit ? (
              <div className="rounded border border-[#5a4a2a]/50 bg-[#2a2518]/60 px-2.5 py-1.5 text-[10px] text-[#c8a84e]">
                草稿数量即将达到上限，建议清理旧草稿
              </div>
            ) : null}

            {drafts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/50">
                <BookMarked className="h-8 w-8" />
                <p className="text-xs">暂无已保存草稿</p>
                <p className="text-[10px]">输入名称后点击「另存新草稿」开始保存</p>
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {drafts.map((item) => (
                  <DraftItemRow
                    key={item.id}
                    item={item}
                    isCurrent={item.id === currentDraftId}
                    onLoad={() => onLoad(item.id)}
                    onRename={(newTitle) => onRename(item.id, newTitle)}
                    onDelete={() => onDelete(item.id)}
                    onExport={() => onExport(item.id)}
                    renderSummary={renderSummary}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
