"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Share2 } from "lucide-react";
import { exportParams, importParams } from "@/lib/param-io";
import type { AppMode } from "@/types/custom-tray";
import { isAdmin } from "@/lib/permissions";

interface ParamIOButtonsProps {
    mode: AppMode;
    params: Record<string, unknown>;
    onImport: (params: unknown) => void;
}

export function ParamIOButtons({ mode, params, onImport }: ParamIOButtonsProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        exportParams(mode, params as any);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
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

    const exportBtnClasses = "flex-1 h-9 text-sm tracking-wider border-[#2e2a24] text-muted-foreground cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e] transition-all duration-200";

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
            />
            <div className="flex gap-2">
                {isAdmin && (
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        className={exportBtnClasses}
                    >
                        <Share2 className="w-4 h-4 mr-2" />
                        导出参数
                    </Button>
                )}
                <Button
                    variant="outline"
                    onClick={handleImportClick}
                    className="flex-1 h-9 text-sm tracking-wider border-[#2e2a24] text-muted-foreground cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e] transition-all duration-200"
                >
                    <Upload className="w-4 h-4 mr-2" />
                    导入参数
                </Button>
            </div>
        </>
    );
}
