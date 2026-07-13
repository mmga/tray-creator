"use client";

import { AlertTriangle, ChevronDown, Hammer, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";

interface ResultSummaryProps {
  itemLabel: string;
  dimensions: [number, number, number];
  price: string;
  oversized?: boolean;
  generating?: boolean;
  stale?: boolean;
  details?: ReactNode;
}

export function ResultSummary({ itemLabel, dimensions, price, oversized = false, generating = false, stale = false, details }: ResultSummaryProps) {
  const [open, setOpen] = useState(false);
  const status = oversized ? "超出常规尺寸" : generating ? "正在锻造" : stale ? "预览待更新" : "可锻造";
  return (
    <div className={`rounded-sm border bg-[#16140f] ${oversized ? "border-[#8b1a1a]" : stale ? "border-[#5a4a2a]" : "border-[#2e2a24]"}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60">
        <div className={`flex size-7 shrink-0 items-center justify-center border ${oversized ? "border-[#8b1a1a]/70 bg-[#3a1717] text-[#e06565]" : "border-primary/30 bg-[#1c1a16] text-primary"}`}>
          {oversized ? <AlertTriangle className="size-3.5" /> : generating ? <RefreshCw className="size-3.5 animate-spin" /> : <Hammer className="size-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold text-[#e6ded0]">{itemLabel} · {dimensions.map((value) => value.toFixed(1)).join(" × ")} mm</div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px]"><span className="font-mono font-bold text-[#eab308]">报价 {price}</span><span className={oversized ? "text-[#d75b5b]" : stale ? "text-[#d7b95d]" : "text-muted-foreground"}>{status}</span></div>
        </div>
        {details ? <ChevronDown className={`size-4 text-primary/60 transition-transform ${open ? "rotate-180" : ""}`} /> : null}
      </button>
      {details ? <div className={`grid transition-[grid-template-rows,opacity] duration-200 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="min-h-0 overflow-hidden"><div className="border-t border-[#2e2a24] px-3 py-2">{details}</div></div></div> : null}
    </div>
  );
}
