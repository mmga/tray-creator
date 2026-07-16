"use client";

import { useRef } from "react";
import { BookMarked, Download, Ellipsis, Loader2, Play, RotateCcw, Save, Share2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/useToast";
import type { Availability, DraftActionAreaAdapter, DraftActionResult, StandardDraftActionIntent } from "@/workspaces/draft-action-area";

function isDisabled(availability: Availability) {
  return availability.state !== "available";
}

export function PanelActionSection({ adapter }: { adapter: DraftActionAreaAdapter }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { state } = adapter;

  const reportResult = (result: DraftActionResult) => {
    if (result.status === "error") toast("error", result.message);
  };

  const perform = async (intent: StandardDraftActionIntent) => {
    reportResult(await adapter.perform(intent));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await perform({ type: "import-params", file });
    event.target.value = "";
  };

  return (
    <div className="relative flex flex-col gap-2">
      {state.stale ? <div className="rounded-sm border border-[#5a4a2a] bg-[#2a2518]/95 px-3 py-1.5 text-[11px] text-[#d7b95d]">当前预览已过期，请重新锻造。</div> : null}
      {state.hasUnsavedChanges ? <div className="absolute -top-1 right-0 size-2 rounded-full bg-[#e3c774] shadow-[0_0_8px_#e3c774]" title="有未保存修改"><span className="sr-only">有未保存修改</span></div> : null}
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

      <div className="grid grid-cols-[1fr_0.82fr_2.75rem] gap-2">
        <Button title={state.generate.state === "blocked" ? state.generate.reason : undefined} onClick={() => void perform({ type: "generate" })} disabled={isDisabled(state.generate)} className="h-11 min-w-0 blood-red px-2 text-xs font-bold tracking-wider text-[#f0d8b8] border border-[#a02020] shadow-lg shadow-[#8b1a1a30] hover:brightness-125 disabled:opacity-50">
          {state.generate.state === "busy" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {state.generate.state === "busy" ? state.generate.label : "开始锻造"}
        </Button>

        {adapter.kind === "stepped-cad" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button className="h-11 min-w-0 bg-[#2a3528] px-2 text-xs text-[#8cb880] border border-[#4a6741] hover:bg-[#354530]"><Download className="size-4" />导出</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <DropdownMenuLabel>导出模型</DropdownMenuLabel>
              <DropdownMenuItem disabled={isDisabled(state.exportWhole)} title={state.exportWhole.state === "blocked" ? state.exportWhole.reason : undefined} onSelect={() => void perform({ type: "export-whole" })}><Download className="size-4" />完整 STL</DropdownMenuItem>
              <DropdownMenuItem disabled={isDisabled(adapter.state.exportSplit)} title={adapter.state.exportSplit.state === "blocked" ? adapter.state.exportSplit.reason : undefined} onSelect={() => void adapter.perform({ type: "export-split" }).then(reportResult)}><Download className="size-4" />分件 STL</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button title={state.exportWhole.state === "blocked" ? state.exportWhole.reason : undefined} disabled={isDisabled(state.exportWhole)} onClick={() => void perform({ type: "export-whole" })} className="h-11 min-w-0 bg-[#2a3528] px-2 text-xs font-semibold tracking-wider text-[#8cb880] border border-[#4a6741] hover:bg-[#354530]"><Download className="size-4" />导出</Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="更多操作" className="h-11 w-11 border-[#3d372e] bg-[#1c1a16] text-muted-foreground hover:text-primary"><Ellipsis className="size-5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuLabel>项目与文件</DropdownMenuLabel>
            {adapter.kind === "automatic" ? <DropdownMenuCheckboxItem checked={adapter.state.preview.enabled} onCheckedChange={(enabled) => void adapter.perform({ type: "set-auto-preview", enabled }).then(reportResult)}>启用自动预览</DropdownMenuCheckboxItem> : null}
            <DropdownMenuItem onSelect={() => void perform({ type: "save-draft" })}><Save className="size-4" />{state.currentDraftId ? "更新草稿" : "保存草稿"}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void perform({ type: "open-drafts" })}><BookMarked className="size-4" />草稿列表</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void perform({ type: "export-params" })}><Share2 className="size-4" />导出参数</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}><Upload className="size-4" />导入参数</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void perform({ type: "reset" })} className="text-[#d06464] focus:bg-[#3a1919] focus:text-[#ef8585]"><RotateCcw className="size-4" />重置参数</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
