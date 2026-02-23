"use client";

import { useEffect, useState } from "react";
import { fetchOrders, deleteOrder, type OrderData } from "@/lib/order-api";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Download, RefreshCcw, X, Archive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { generateSTLFilename, generateCustomSTLFilename } from "@/lib/stl-export";
import JSZip from "jszip";

interface OrdersInboxProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadOrder: (mode: OrderData["mode"], params: unknown) => void;
}

export function OrdersInbox({ isOpen, onClose, onLoadOrder }: OrdersInboxProps) {
    const [orders, setOrders] = useState<OrderData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const loadOrders = async () => {
        setIsLoading(true);
        setError(null);
        setSelectedIds(new Set()); // Reset selection on load
        try {
            const data = await fetchOrders();
            setOrders(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "获取失败");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadOrders();
        }
    }, [isOpen]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("确定要删除这个订单吗？")) return;

        try {
            await deleteOrder(id);
            setOrders(prev => prev.filter(o => o.id !== id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (err) {
            alert("删除失败: " + (err instanceof Error ? err.message : String(err)));
        }
    };

    const toggleSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === orders.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(orders.map(o => o.id)));
        }
    };

    const handleBatchExport = async () => {
        if (selectedIds.size === 0 || !trayWorkerService) return;

        setIsExporting(true);
        setError(null);
        const zip = new JSZip();

        try {
            const selectedOrders = orders.filter(o => selectedIds.has(o.id));

            for (let i = 0; i < selectedOrders.length; i++) {
                const order = selectedOrders[i];
                let geometry;
                let filename;

                // 1. Generate Geometry
                if (order.mode === 'grid') {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const params = order.params as any;
                    const res = await trayWorkerService.generateGrid(params);
                    geometry = res.geometry;
                    filename = generateSTLFilename(params.rows, params.columns, params.holeDiameter);
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const params = order.params as any;
                    const res = await trayWorkerService.generateCustom(params);
                    geometry = res.geometry;
                    filename = generateCustomSTLFilename(params.trayWidth, params.trayDepth, params.slots?.length || 0);
                }

                // Append short ID to prevent filename collisions
                const shortId = order.id.split('_').pop() || String(i);
                filename = filename.replace('.stl', `_${shortId}.stl`);

                // 2. Export STL Blob
                const stlResult = await trayWorkerService.exportSTL(geometry, filename);

                // 3. Add to ZIP
                zip.file(filename, stlResult.blob);
            }

            // 4. Generate and download ZIP
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(zipBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `Tray_Orders_Batch_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error("Batch export failed", err);
            setError("批量导出失败: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    const allSelected = orders.length > 0 && selectedIds.size === orders.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl bg-[#16140f] border-[#3d372e] flex flex-col max-h-[80vh] shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-[#2e2a24]">
                    <h2 className="text-lg font-bold text-[#f0d8b8] tracking-wider flex items-center gap-2">
                        📥 定制订单收件箱
                        <span className="text-xs bg-[#2e2a24] text-muted-foreground px-2 py-0.5 rounded-full">
                            {orders.length}
                        </span>
                    </h2>
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleBatchExport}
                                disabled={isExporting}
                                className="h-8 border-[#4a6741] text-[#8cb880] hover:bg-[#2a3528] bg-transparent disabled:opacity-50"
                            >
                                {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
                                导出ZIP ({selectedIds.size})
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={loadOrders}
                            disabled={isLoading || isExporting}
                            className="h-8 w-8 border-[#2e2a24] hover:bg-[#2e2a24] hover:text-primary transition-colors disabled:opacity-50"
                            title="刷新"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8 border-[#2e2a24] hover:bg-[#8b1a1a]/20 hover:text-[#c04040] hover:border-[#8b1a1a]/50 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {orders.length > 0 && (
                    <div className="px-4 py-2 border-b border-[#2e2a24]/50 flex items-center gap-3 bg-[#11100c]">
                        <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                            className="border-[#4a6741] data-[state=checked]:bg-[#4a6741] data-[state=checked]:text-white"
                        />
                        <span className="text-xs text-muted-foreground">全选</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {error && (
                        <div className="p-3 text-sm text-[#c04040] bg-[#8b1a1a]/10 border border-[#8b1a1a]/30 rounded-md">
                            {error}
                        </div>
                    )}

                    {!isLoading && orders.length === 0 && !error && (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>暂无订单</p>
                        </div>
                    )}

                    {isLoading && orders.length === 0 && (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
                        </div>
                    )}

                    {orders.map((order) => {
                        const isSelected = selectedIds.has(order.id);
                        return (
                            <div
                                key={order.id}
                                className={`flex items-center gap-3 p-3 rounded-md border transition-colors group cursor-pointer ${isSelected ? 'bg-[#2a3528]/20 border-[#4a6741]' : 'bg-[#1c1a16] border-[#2e2a24] hover:border-[#4a6741]/50'
                                    }`}
                                onClick={() => {
                                    onLoadOrder(order.mode, order.params);
                                    onClose();
                                }}
                            >
                                <div onClick={(e) => toggleSelection(order.id, e)} className="p-1 cursor-pointer">
                                    <Checkbox
                                        checked={isSelected}
                                        className="border-[#4a6741] data-[state=checked]:bg-[#4a6741] data-[state=checked]:text-white"
                                    />
                                </div>
                                <div className="flex-1 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-[#f0d8b8]">
                                            {order.mode === 'grid' ? '普通网格托盘' : '自定义布局托盘'}
                                        </span>
                                        <span className="text-xs font-mono text-muted-foreground/60 px-1.5 py-0.5 bg-[#16140f] rounded">
                                            {order.id.split('_').pop()}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground/70">
                                        {new Date(order.timestamp).toLocaleString('zh-CN', {
                                            year: 'numeric', month: '2-digit', day: '2-digit',
                                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                                        })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 border-[#4a6741] text-[#8cb880] hover:bg-[#2a3528] bg-transparent"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onLoadOrder(order.mode, order.params);
                                            onClose();
                                        }}
                                    >
                                        <Download className="w-3.5 h-3.5 mr-1" />
                                        加载
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 border-[#8b1a1a]/30 text-[#c04040] hover:bg-[#8b1a1a]/20 bg-transparent"
                                        onClick={(e) => handleDelete(order.id, e)}
                                        title="删除"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}
