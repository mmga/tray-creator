"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ChevronDown, ChevronRight, X, Download, ClipboardList, Trash2 } from "lucide-react";
import { fetchOrderList, fetchOrderDetail, deleteOrder } from "@/lib/edgeone-kv";
import type { AppMode } from "@/types/custom-tray";

/** 从 order key 解析可读的时间 */
function parseOrderTime(key: string): string {
    const match = key.match(/^order_(\d+)_/);
    if (!match) return key;
    const ts = parseInt(match[1]);
    return new Date(ts).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

/** 从订单数据中获取模式 */
function getOrderMode(data: unknown): AppMode | null {
    if (data && typeof data === "object" && "mode" in data) {
        const mode = (data as { mode: string }).mode;
        if (mode === "grid" || mode === "custom") return mode;
    }
    return null;
}

/** 获取模式中文名 */
function modeName(mode: AppMode): string {
    return mode === "grid" ? "网格" : "自定义";
}

interface OrderListDialogProps {
    open: boolean;
    onClose: () => void;
    onImportOrder: (mode: AppMode, params: unknown) => void;
}

export default function OrderListDialog({ open, onClose, onImportOrder }: OrderListDialogProps) {
    const [keys, setKeys] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [details, setDetails] = useState<Record<string, unknown>>({});
    const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
    const [deletingKey, setDeletingKey] = useState<string | null>(null);

    // ESC 关闭
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
        [onClose],
    );

    useEffect(() => {
        if (open) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [open, handleKeyDown]);

    // 打开时自动刷新
    useEffect(() => {
        if (open && keys.length === 0) handleRefresh();
    }, [open]);

    const handleRefresh = async () => {
        setIsLoading(true);
        setError(null);
        const result = await fetchOrderList();
        setIsLoading(false);
        if (result.success && result.keys) {
            setKeys(result.keys.sort().reverse());
        } else {
            setError(result.error || "获取订单列表失败");
        }
    };

    const handleToggle = async (key: string) => {
        if (expandedKey === key) {
            setExpandedKey(null);
            return;
        }
        setExpandedKey(key);
        if (!details[key]) {
            setLoadingDetail(key);
            const result = await fetchOrderDetail(key);
            setLoadingDetail(null);
            if (result.success) {
                setDetails((prev) => ({ ...prev, [key]: result.data }));
            } else {
                setDetails((prev) => ({ ...prev, [key]: { error: result.error } }));
            }
        }
    };

    const handleImport = (key: string) => {
        const data = details[key] as { mode?: string; params?: unknown } | undefined;
        if (!data?.params) return;
        const mode = getOrderMode(data);
        if (!mode) return;
        onImportOrder(mode, data.params);
        onClose();
    };

    const handleDelete = async (key: string) => {
        const ok = window.confirm(`确认删除订单？\n${key}`);
        if (!ok) return;

        setDeletingKey(key);
        setError(null);
        const result = await deleteOrder(key);
        setDeletingKey(null);

        if (!result.success) {
            setError(result.error || "删除失败");
            return;
        }

        setKeys((prev) => prev.filter((k) => k !== key));
        setDetails((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        if (expandedKey === key) setExpandedKey(null);
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div className="relative w-[90vw] max-w-[600px] max-h-[80vh] flex flex-col bg-[#0e0d0b] border border-[#2e2a24] shadow-2xl shadow-black/50 rounded-sm animate-fade-in">
                {/* 标题栏 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2a24]">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-primary" />
                        <h2 className="text-sm font-bold tracking-wider text-primary">订单列表</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="h-7 text-xs border-[#2e2a24] text-muted-foreground hover:bg-[#1c1a16]"
                        >
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        </Button>
                        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 列表 */}
                <div className="flex-1 overflow-auto p-3 space-y-1">
                    {error && (
                        <div className="text-xs text-[#c04040] text-center p-2 bg-[#8b1a1a15] border border-[#8b1a1a50] rounded-sm">
                            {error}
                        </div>
                    )}

                    {keys.length === 0 && !isLoading && !error && (
                        <div className="text-xs text-muted-foreground text-center py-8">暂无订单</div>
                    )}

                    {isLoading && keys.length === 0 && (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            <span className="text-xs">加载中...</span>
                        </div>
                    )}

                    {keys.map((key) => {
                        const detail = details[key];
                        const orderMode = detail ? getOrderMode(detail) : null;

                        return (
                            <div key={key} className="border border-[#2e2a24] rounded-sm overflow-hidden">
                                <button
                                    onClick={() => handleToggle(key)}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#1c1a16] hover:bg-[#252220] text-left transition-colors cursor-pointer"
                                >
                                    {expandedKey === key ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                    ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-mono text-foreground/80 truncate block">{key}</span>
                                        <span className="text-[10px] text-muted-foreground">{parseOrderTime(key)}</span>
                                    </div>
                                </button>

                                {expandedKey === key && (
                                    <div className="px-3 py-2 bg-[#0e0d0b] border-t border-[#2e2a24]">
                                        {loadingDetail === key ? (
                                            <div className="flex items-center justify-center py-4 text-muted-foreground">
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                <span className="text-xs">加载中...</span>
                                            </div>
                                        ) : detail ? (
                                            <>
                                                <pre className="text-[11px] font-mono text-[#8cb880] overflow-auto max-h-[250px] whitespace-pre-wrap break-all leading-relaxed mb-2">
                                                    {JSON.stringify(detail, null, 2)}
                                                </pre>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {orderMode ? (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleImport(key)}
                                                            className="h-8 text-xs bg-[#2a3528] hover:bg-[#354530] text-[#8cb880] font-semibold border border-[#4a6741] cursor-pointer"
                                                        >
                                                            <Download className="w-3.5 h-3.5 mr-1.5" />
                                                            导入
                                                        </Button>
                                                    ) : <div />}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleDelete(key)}
                                                        disabled={deletingKey === key}
                                                        className="h-8 text-xs border-[#8b1a1a80] text-[#d46a6a] hover:bg-[#8b1a1a20] cursor-pointer"
                                                    >
                                                        {deletingKey === key ? (
                                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                                        )}
                                                        删除
                                                    </Button>
                                                </div>
                                                {orderMode && (
                                                    <div className="mt-1 text-[10px] text-muted-foreground">
                                                        可导入到「{modeName(orderMode)}」模式
                                                    </div>
                                                )}
                                            </>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {keys.length > 0 && (
                    <div className="text-[10px] text-muted-foreground text-center py-2 border-t border-[#2e2a24]">
                        共 {keys.length} 条订单
                    </div>
                )}
            </div>
        </div>
    );
}
