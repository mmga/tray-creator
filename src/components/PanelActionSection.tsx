"use client";

import { BookMarked, Download, Ellipsis, Loader2, Play, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParamIOButtons } from "@/components/ParamIOButtons";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppMode, CustomLayoutParams, SimpleSteppedLayoutParams, SteppedLayoutParams } from "@/types/custom-tray";
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
  params: TrayParams | CustomLayoutParams | SimpleSteppedLayoutParams | SteppedLayoutParams;
  onImport: (params: unknown) => void;
  showStaleNotice?: boolean;
  draftActions?: PanelDraftActions;
  onExportSplitParts?: () => void;
  canExportSplitParts?: boolean;
}

export function PanelActionSection({
  autoPreviewId,
  autoPreview,
  onAutoPreviewChange,
  onGenerate,
  onExportSTL,
  onReset,
  isGenerating,
  mode,
  params,
  onImport,
  showStaleNotice = false,
  draftActions,
  onExportSplitParts,
  canExportSplitParts = false,
}: PanelActionSectionProps) {
  return (
    <div className="relative flex flex-col gap-2">
      {showStaleNotice ? <div className="rounded-sm border border-[#5a4a2a] bg-[#2a2518]/95 px-3 py-1.5 text-[11px] text-[#d7b95d]">当前预览已过期，请重新锻造。</div> : null}
      {draftActions?.hasUnsavedChanges ? <div className="absolute -top-1 right-0 size-2 rounded-full bg-[#e3c774] shadow-[0_0_8px_#e3c774]" title="有未保存修改"><span className="sr-only">有未保存修改</span></div> : null}

      <div className="grid grid-cols-[1fr_0.82fr_2.75rem] gap-2">
        <Button onClick={onGenerate} disabled={isGenerating} className="h-11 min-w-0 blood-red px-2 text-xs font-bold tracking-wider text-[#f0d8b8] border border-[#a02020] shadow-lg shadow-[#8b1a1a30] hover:brightness-125 disabled:opacity-50">
          {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {isGenerating ? "锻造中" : "开始锻造"}
        </Button>

        {onExportSplitParts ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button className="h-11 min-w-0 bg-[#2a3528] px-2 text-xs text-[#8cb880] border border-[#4a6741] hover:bg-[#354530]"><Download className="size-4" />导出</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <DropdownMenuLabel>导出模型</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onExportSTL}><Download className="size-4" />完整 STL</DropdownMenuItem>
              <DropdownMenuItem disabled={!canExportSplitParts} onSelect={onExportSplitParts}><Download className="size-4" />分件 STL</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button onClick={onExportSTL} className="h-11 min-w-0 bg-[#2a3528] px-2 text-xs font-semibold tracking-wider text-[#8cb880] border border-[#4a6741] hover:bg-[#354530]"><Download className="size-4" />导出</Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="更多操作" className="h-11 w-11 border-[#3d372e] bg-[#1c1a16] text-muted-foreground hover:text-primary"><Ellipsis className="size-5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuLabel>项目与文件</DropdownMenuLabel>
            {autoPreviewId && onAutoPreviewChange ? <DropdownMenuCheckboxItem checked={autoPreview ?? false} onCheckedChange={onAutoPreviewChange}>启用自动预览</DropdownMenuCheckboxItem> : null}
            {draftActions ? <>
              <DropdownMenuItem onSelect={draftActions.onSaveDraft}><Save className="size-4" />{draftActions.currentDraftId ? "更新草稿" : "保存草稿"}</DropdownMenuItem>
              <DropdownMenuItem onSelect={draftActions.onOpenDraftDialog}><BookMarked className="size-4" />草稿列表</DropdownMenuItem>
            </> : null}
            <DropdownMenuSeparator />
            <ParamIOButtons mode={mode} params={params} onImport={onImport} variant="menu" />
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onReset} className="text-[#d06464] focus:bg-[#3a1919] focus:text-[#ef8585]"><RotateCcw className="size-4" />重置参数</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
