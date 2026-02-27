"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { fetchOrderList, fetchOrderDetail } from "@/lib/edgeone-kv";
import { SectionHeader } from "@/components/ui/SectionHeader";

/** 从 order key 解析可读的时间 */
function parseOrderTime(key: string): string {
    // key 格式: order_{timestamp}_{hex}
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

export default function OrderListPanel() {
    const [keys, setKeys] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [details, setDetails] = useState<Record<string, unknown>>({});
    const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

    const handleRefresh = async () => {
        setIsLoading(true);
        setError(null);
        const result = await fetchOrderList();
        setIsLoading(false);
        if (result.success && result.keys) {
            // 按时间倒序
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

        // 如果还没加载过详情
        if (!details[key]) {
            setLoadingDetail(key);
            const result = await fetchOrderDetail(key);
            setLoadingDetail(null);
            if (result.success) {
                setDetails((prev) => ({ ...prev, [key]: result.data }));
            } else {
                setDetails((prev) => ({
                    ...prev,
                    [key]: { error: result.error || "加载失败" },
                }));
            }
        }
    };

    return (
        <div className="flex flex-col gap-4 animate-fade-in">
            <div className="iron-panel rounded-sm p-4">
                <SectionHeader icon={ClipboardList} title="订单列表" collapsible={false}>
                    <div className="space-y-3">
                        <Button
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="w-full h-10 bg-[#1e2a3a] hover:bg-[#283848] text-sm text-[#7eb8d8] font-semibold tracking-wider cursor-pointer border border-[#3a5a7a] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            {isLoading ? "加载中..." : "刷新订单"}
                        </Button>

                        {error && (
                            <div className="text-xs text-[#c04040] text-center p-2 bg-[#8b1a1a15] border border-[#8b1a1a50] rounded-sm">
                                {error}
                            </div>
                        )}

                        {keys.length === 0 && !isLoading && !error && (
                            <div className="text-xs text-muted-foreground text-center py-6">
                                点击「刷新订单」加载 KV 中的订单数据
                            </div>
                        )}

                        {/* 订单列表 */}
                        <div className="space-y-1">
                            {keys.map((key) => (
                                <div
                                    key={key}
                                    className="border border-[#2e2a24] rounded-sm overflow-hidden"
                                >
                                    {/* 订单头 */}
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
                                            <span className="text-xs font-mono text-foreground/80 truncate block">
                                                {key}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {parseOrderTime(key)}
                                            </span>
                                        </div>
                                    </button>

                                    {/* 展开详情 */}
                                    {expandedKey === key && (
                                        <div className="px-3 py-2 bg-[#0e0d0b] border-t border-[#2e2a24]">
                                            {loadingDetail === key ? (
                                                <div className="flex items-center justify-center py-4 text-muted-foreground">
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    <span className="text-xs">加载中...</span>
                                                </div>
                                            ) : details[key] ? (
                                                <pre className="text-[11px] font-mono text-[#8cb880] overflow-auto max-h-[300px] whitespace-pre-wrap break-all leading-relaxed">
                                                    {JSON.stringify(details[key], null, 2)}
                                                </pre>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {keys.length > 0 && (
                            <div className="text-[10px] text-muted-foreground text-center">
                                共 {keys.length} 条订单
                            </div>
                        )}
                    </div>
                </SectionHeader>
            </div>
        </div>
    );
}
