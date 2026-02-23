"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Share2, Send, Loader2 } from "lucide-react";
import { exportParams, importParams } from "@/lib/param-io";
import { submitOrder } from "@/lib/order-api";
import type { AppMode } from "@/types/custom-tray";
import { isAdmin } from "@/lib/permissions";

interface ParamIOButtonsProps {
    mode: AppMode;
    params: Record<string, unknown>;
    onImport: (params: unknown) => void;
}

export function ParamIOButtons({ mode, params, onImport }: ParamIOButtonsProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleExport = () => {
        exportParams(mode, params as any);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleSubmitOrder = async () => {
        try {
            setIsSubmitting(true);
            const res = await submitOrder(mode, params);
            if (res.success) {
                alert(`提交成功！订单号: ${res.id?.split('_').pop()}`);
            }
        } catch (err) {
            alert(`提交失败：${err instanceof Error ? err.message : "未知错误"}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const imported = await importParams(file, mode);
            onImport(imported);
        } catch (err) {
            alert(`导入失败：${err instanceof Error ? err.message : "未知错误"}`);
        }

        // 重置 input 以允许重复选择同一文件
        e.target.value = "";
    };

    const outlineBtnClasses = "flex-1 h-9 text-sm tracking-wider border-[#2e2a24] text-muted-foreground cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e] transition-all duration-200";

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* 顶排按钮 (导出/导入) */}
            <div className="flex gap-2">
                {isAdmin && (
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        className={outlineBtnClasses}
                    >
                        <Share2 className="w-4 h-4 mr-2" />
                        导出参数
                    </Button>
                )}
                <Button
                    variant="outline"
                    onClick={handleImportClick}
                    className={outlineBtnClasses}
                >
                    <Upload className="w-4 h-4 mr-2" />
                    导入参数
                </Button>
            </div>

            {/* 底排按钮 (客户提交订单) */}
            {!isAdmin && (
                <div className="flex mt-2">
                    <Button
                        variant="outline"
                        onClick={handleSubmitOrder}
                        disabled={isSubmitting}
                        className="w-full h-10 border-[#4a6741] text-[#8cb880] hover:bg-[#2a3528] hover:text-[#a5cd99] transition-all flex items-center justify-center font-bold tracking-widest shadow-lg shadow-[#2a352820]"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4 mr-2" />
                        )}
                        {isSubmitting ? "正在发送..." : "发送配置至制作者"}
                    </Button>
                </div>
            )}
        </>
    );
}
