"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Share2 } from "lucide-react";
import { exportParams, importParams } from "@/lib/param-io";
import { useToast } from "@/hooks/useToast";
import type {
    AppMode,
    CustomLayoutParams,
    SimpleSteppedLayoutParams,
    SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";

interface ParamIOButtonsProps {
    mode: AppMode;
    params: TrayParams | CustomLayoutParams | SimpleSteppedLayoutParams | SteppedLayoutParams;
    onImport: (params: unknown) => void;
}

export function ParamIOButtons({ mode, params, onImport }: ParamIOButtonsProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleExport = () => {
        exportParams(mode, params);
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
            toast("success", "参数导入成功");
        } catch (err) {
            toast("error", `导入失败：${err instanceof Error ? err.message : "未知错误"}`);
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
                <Button
                    variant="outline"
                    onClick={handleExport}
                    className={outlineBtnClasses}
                >
                    <Share2 className="w-4 h-4 mr-2" />
                    导出参数
                </Button>
                <Button
                    variant="outline"
                    onClick={handleImportClick}
                    className={outlineBtnClasses}
                >
                    <Upload className="w-4 h-4 mr-2" />
                    导入参数
                </Button>
            </div>

        </>
    );
}
