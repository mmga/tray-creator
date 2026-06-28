"use client";

import { BookMarked, Download, Loader2, Play, RotateCcw, Save } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ParamIOButtons } from "@/components/ParamIOButtons";
import type {
  AppMode,
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";

export interface PanelDraftActions {
  currentDraftId: string | null;
  hasUnsavedChanges: boolean;
  onSaveDraft: () => void;
  onOpenDraftDialog: () => void;
}

interface PanelActionSectionProps {
  autoPreviewId?: string;
  autoPreview?: boolean;
  onAutoPreviewChange?: (checked: boolean) => void;
  onGenerate: () => void;
  onExportSTL: () => void;
  onReset: () => void;
  isGenerating: boolean;
  isOversized: boolean;
  mode: AppMode;
  params:
    | TrayParams
    | CustomLayoutParams
    | SimpleSteppedLayoutParams
    | SteppedLayoutParams;
  onImport: (params: unknown) => void;
  showStaleNotice?: boolean;
  draftActions?: PanelDraftActions;
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
  showStaleNotice = false,
  draftActions,
}: PanelActionSectionProps) {
  return (
    <div className="flex flex-col gap-2.5 pb-4">
      {showStaleNotice ? (
        <div className="rounded border border-[#5a4a2a] bg-[#2a2518]/90 px-3 py-2 text-xs text-[#c8a84e]">
          当前预览已过期，请点击“开始锻造”生成最新模型。
        </div>
      ) : null}

      {autoPreviewId && onAutoPreviewChange ? (
        <div className="flex items-center justify-between p-3 rounded bg-[#1c1a16] border border-[#2e2a24]">
          <Label htmlFor={autoPreviewId} className="text-sm cursor-pointer text-[#f0d8b8]">
            启用自动预览
          </Label>
          <Switch
            id={autoPreviewId}
            checked={autoPreview ?? false}
            onCheckedChange={onAutoPreviewChange}
            className="data-[state=checked]:bg-[#8cb880]"
          />
        </div>
      ) : null}

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
        {isGenerating ? "锻造中..." : "开始锻造"}
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

      {draftActions ? (
        <>
          <div className="rounded border border-[#2e2a24] bg-[#16140e] px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              <BookMarked className="w-3.5 h-3.5 text-[#c8a84e]" />
              <span className="text-muted-foreground">
                {draftActions.currentDraftId ? "当前草稿已绑定" : "当前未绑定草稿"}
              </span>
              {draftActions.hasUnsavedChanges ? (
                <span className="ml-auto rounded border border-[#5a4a2a] bg-[#1f1a12] px-1.5 py-0.5 text-[10px] text-[#e3c774]">
                  有未保存修改
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={draftActions.onSaveDraft}
              className="flex-1 h-9 text-sm tracking-wider border-[#5a4a2a] text-[#c8a84e] cursor-pointer hover:bg-[#2a2518] hover:text-[#e0c870] hover:border-[#7a6a3a] transition-all duration-200"
            >
              <Save className="w-4 h-4 mr-2" />
              {draftActions.currentDraftId ? "更新草稿" : "保存草稿"}
            </Button>
            <Button
              variant="outline"
              onClick={draftActions.onOpenDraftDialog}
              className="flex-1 h-9 text-sm tracking-wider border-[#2e2a24] text-muted-foreground cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e] transition-all duration-200"
            >
              <BookMarked className="w-4 h-4 mr-2" />
              草稿列表
            </Button>
          </div>
        </>
      ) : null}

      <ParamIOButtons
        mode={mode}
        params={params}
        onImport={onImport}
      />
    </div>
  );
}
