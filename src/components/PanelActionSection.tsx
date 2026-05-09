"use client";

import { Download, Loader2, Play, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ParamIOButtons } from "@/components/ParamIOButtons";
import type { AppMode, CustomLayoutParams, SteppedLayoutParams } from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";

interface PanelActionSectionProps {
  autoPreviewId: string;
  autoPreview: boolean;
  onAutoPreviewChange: (checked: boolean) => void;
  onGenerate: () => void;
  onExportSTL: () => void;
  onReset: () => void;
  isGenerating: boolean;
  isOversized: boolean;
  mode: AppMode;
  params: TrayParams | CustomLayoutParams | SteppedLayoutParams;
  onImport: (params: unknown) => void;
}

export function PanelActionSection({
  autoPreviewId,
  autoPreview,
  onAutoPreviewChange,
  onGenerate,
  onExportSTL,
  onReset,
  isGenerating,
  isOversized,
  mode,
  params,
  onImport,
}: PanelActionSectionProps) {
  return (
    <div className="flex flex-col gap-2.5 pb-4">
      <div className="flex items-center justify-between p-3 rounded bg-[#1c1a16] border border-[#2e2a24]">
        <Label htmlFor={autoPreviewId} className="text-sm cursor-pointer text-[#f0d8b8]">
          启用自动预览
        </Label>
        <Switch
          id={autoPreviewId}
          checked={autoPreview}
          onCheckedChange={onAutoPreviewChange}
          className="data-[state=checked]:bg-[#8cb880]"
        />
      </div>

      <Button
        onClick={onGenerate}
        disabled={isGenerating}
        className="w-full h-11 blood-red text-sm text-[#f0d8b8] font-bold tracking-wider cursor-pointer transition-all duration-200 border border-[#a02020] shadow-lg shadow-[#8b1a1a30] hover:shadow-xl hover:shadow-[#8b1a1a50] hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Play className="w-4 h-4 mr-2" />
        )}
        {isGenerating ? "锻造中..." : isOversized ? "尺寸超限" : "开始锻造"}
      </Button>

      <Button
        onClick={onExportSTL}
        className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-sm text-[#8cb880] font-semibold tracking-wider cursor-pointer transition-all duration-200 border border-[#4a6741] shadow-lg shadow-[#2a352830]"
      >
        <Download className="w-4 h-4 mr-2" />
        导出 STL
      </Button>

      <Button
        variant="outline"
        onClick={onReset}
        className="w-full h-11 lg:h-9 text-sm border-[#2e2a24] text-muted-foreground tracking-wider cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e] transition-all duration-200"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        重置参数
      </Button>

      <ParamIOButtons
        mode={mode}
        params={params}
        onImport={onImport}
      />
    </div>
  );
}
