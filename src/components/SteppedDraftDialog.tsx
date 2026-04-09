"use client";

import { useState } from "react";
import {
    FolderOpen,
    Save,
    Download,
    Trash2,
    Pencil,
    Check,
    X,
    BookMarked,
    Clock,
    Layers,
    Grid2x2,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDraftTime, MAX_DRAFTS_PER_MODE, type DraftListItem } from "@/lib/local-drafts";

// ═══════════════════════════════════════════
// Props
// ═══════════════════════════════════════════

interface SteppedDraftDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 草稿列表（从 Hook 传入，每次 open 时刷新） */
    drafts: DraftListItem[];
    /** 当前已绑定的草稿 id，null 代表未绑定 */
    currentDraftId: string | null;
    /** 名称输入框的当前值 */
    draftNameInput: string;
    onDraftNameInputChange: (v: string) => void;
    onSaveAsNew: () => void;
    onSaveCurrent: () => void;
    onLoad: (id: string) => void;
    onRename: (id: string, newTitle: string) => void;
    onDelete: (id: string) => void;
    onExport: (id: string) => void;
}

// ═══════════════════════════════════════════
// 草稿列表行
// ═══════════════════════════════════════════

interface DraftItemRowProps {
    item: DraftListItem;
    isCurrent: boolean;
    onLoad: () => void;
    onRename: (newTitle: string) => void;
    onDelete: () => void;
    onExport: () => void;
}

function DraftItemRow({
    item,
    isCurrent,
    onLoad,
    onRename,
    onDelete,
    onExport,
}: DraftItemRowProps) {
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
            className={`rounded border transition-colors ${isCurrent
                ? "border-[#5a4a2a] bg-[#1e1a10]"
                : "border-[#2e2a24] bg-[#16140e] hover:border-[#3d372e]"
                }`}
        >
            {/* 标题行 */}
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                {editingTitle ? (
                    <>
                        <Input
                            value={pendingTitle}
                            onChange={(e) => setPendingTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") cancelRename();
                            }}
                            autoFocus
                            className="h-6 text-xs flex-1 bg-[#1c1a16] border-[#5a4a2a] px-2"
                        />
                        <button
                            onClick={commitRename}
                            className="text-[#8cb880] hover:text-[#a8d49a] transition-colors"
                            title="确认"
                        >
                            <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={cancelRename}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="取消"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </>
                ) : (
                    <>
                        <span className="flex-1 text-xs font-medium text-foreground truncate">
                            {item.title}
                        </span>
                        {isCurrent && (
                            <span className="text-[10px] text-[#c8a84e] border border-[#5a4a2a] bg-[#2a2518] px-1.5 py-0.5 rounded shrink-0">
                                当前
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* 元信息行 */}
            <div className="flex items-center gap-3 px-3 pb-2 text-[10px] text-muted-foreground/70">
                <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDraftTime(item.updatedAt)}
                </span>
                <span className="flex items-center gap-1">
                    <Grid2x2 className="w-3 h-3" />
                    {item.slotCount} 槽
                </span>
                <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {item.groupCount} 组
                </span>
                <span className="font-mono">
                    {item.trayWidth}×{item.trayDepth}mm
                </span>
            </div>

            {/* 操作行 */}
            <div className="flex items-center gap-1 border-t border-[#2a2518] px-2 py-1.5">
                {confirmDelete ? (
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-[10px] text-red-400">确认删除？</span>
                        <button
                            onClick={() => {
                                onDelete();
                                setConfirmDelete(false);
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 border border-red-800 rounded px-2 py-0.5 transition-colors"
                        >
                            删除
                        </button>
                        <button
                            onClick={() => setConfirmDelete(false)}
                            className="text-[10px] text-muted-foreground hover:text-foreground border border-[#2e2a24] rounded px-2 py-0.5 transition-colors"
                        >
                            取消
                        </button>
                    </div>
                ) : (
                    <>
                        <button
                            onClick={onLoad}
                            className="flex items-center gap-1 text-[10px] text-[#8cb880] hover:text-[#a8d49a] border border-[#4a6741] hover:border-[#5a7a51] rounded px-2 py-0.5 transition-colors"
                        >
                            <FolderOpen className="w-3 h-3" />
                            加载
                        </button>
                        <button
                            onClick={startRename}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-[#2e2a24] hover:border-[#3d372e] rounded px-2 py-0.5 transition-colors"
                        >
                            <Pencil className="w-3 h-3" />
                            重命名
                        </button>
                        <button
                            onClick={onExport}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-[#2e2a24] hover:border-[#3d372e] rounded px-2 py-0.5 transition-colors"
                        >
                            <Download className="w-3 h-3" />
                            导出
                        </button>
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-red-400 border border-transparent hover:border-red-900 rounded px-2 py-0.5 transition-colors ml-auto"
                        >
                            <Trash2 className="w-3 h-3" />
                            删除
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// 主弹窗
// ═══════════════════════════════════════════

export function SteppedDraftDialog({
    open,
    onOpenChange,
    drafts,
    currentDraftId,
    draftNameInput,
    onDraftNameInputChange,
    onSaveAsNew,
    onSaveCurrent,
    onLoad,
    onRename,
    onDelete,
    onExport,
}: SteppedDraftDialogProps) {
    const currentDraft = drafts.find((d) => d.id === currentDraftId) ?? null;
    const isAtLimit = drafts.length >= MAX_DRAFTS_PER_MODE;
    const isNearLimit = !isAtLimit && drafts.length >= MAX_DRAFTS_PER_MODE - 5;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookMarked className="w-4 h-4 text-[#c8a84e]" />
                        阶梯模式草稿
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
                    {/* 保存区 */}
                    <div className="rounded border border-[#2e2a24] bg-[#16140e] p-3 space-y-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                            保存当前配置
                        </div>

                        {/* 当前绑定草稿信息 */}
                        {currentDraft && (
                            <div className="flex items-center gap-2 text-xs text-[#c8a84e]/80 bg-[#2a2518]/60 rounded px-2 py-1.5">
                                <BookMarked className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">{currentDraft.title}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                    {formatDraftTime(currentDraft.updatedAt)}
                                </span>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Input
                                value={draftNameInput}
                                onChange={(e) => onDraftNameInputChange(e.target.value)}
                                placeholder="草稿名称（留空自动生成）"
                                disabled={isAtLimit}
                                className="flex-1 h-8 text-xs bg-[#1c1a16] border-[#3d372e] placeholder:text-muted-foreground/40"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") onSaveAsNew();
                                }}
                            />
                            <Button
                                size="sm"
                                onClick={onSaveAsNew}
                                disabled={isAtLimit}
                                className="h-8 text-xs shrink-0 bg-[#2a3528] hover:bg-[#354530] text-[#8cb880] border border-[#4a6741] shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Save className="w-3 h-3 mr-1" />
                                另存新草稿
                            </Button>
                        </div>

                        {currentDraft && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onSaveCurrent}
                                className="w-full h-8 text-xs border-[#5a4a2a] text-[#c8a84e] hover:bg-[#2a2518] hover:border-[#7a6a3a]"
                            >
                                <Save className="w-3 h-3 mr-1" />
                                覆盖「{currentDraft.title}」
                            </Button>
                        )}
                    </div>

                    {/* 草稿列表 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                                已保存草稿
                            </div>
                            <div className={`text-[10px] font-mono ${isAtLimit ? "text-red-400" : isNearLimit ? "text-[#c8a84e]" : "text-muted-foreground/50"
                                }`}>
                                {drafts.length} / {MAX_DRAFTS_PER_MODE}
                            </div>
                        </div>

                        {isAtLimit && (
                            <div className="text-[10px] text-red-400 bg-red-950/30 border border-red-900/50 rounded px-2.5 py-1.5">
                                草稿数量已达上限，请在列表中删除不需要的草稿
                            </div>
                        )}
                        {isNearLimit && (
                            <div className="text-[10px] text-[#c8a84e] bg-[#2a2518]/60 border border-[#5a4a2a]/50 rounded px-2.5 py-1.5">
                                草稿数量即将达到上限，建议清理旧草稿
                            </div>
                        )}

                        {drafts.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/50">
                                <BookMarked className="w-8 h-8" />
                                <p className="text-xs">暂无已保存草稿</p>
                                <p className="text-[10px]">输入名称后点击「另存新草稿」开始保存</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {drafts.map((item) => (
                                    <DraftItemRow
                                        key={item.id}
                                        item={item}
                                        isCurrent={item.id === currentDraftId}
                                        onLoad={() => onLoad(item.id)}
                                        onRename={(newTitle) => onRename(item.id, newTitle)}
                                        onDelete={() => onDelete(item.id)}
                                        onExport={() => onExport(item.id)}
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
