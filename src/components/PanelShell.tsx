"use client";

import type { ReactNode } from "react";

interface PanelShellProps {
  summary: ReactNode;
  children: ReactNode;
  actions: ReactNode;
}

/** 左侧工作区统一骨架：结果固定、参数滚动、主操作固定。 */
export function PanelShell({ summary, children, actions }: PanelShellProps) {
  return (
    <div data-testid="panel-shell" className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-[#0e0d0b]">
      <div data-testid="panel-summary" className="relative z-20 border-b border-[#2e2a24] px-4 pt-3 pb-2 shadow-lg shadow-black/20">
        {summary}
      </div>
      <div data-testid="panel-scroll-region" className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-gutter:stable]">
        {children}
      </div>
      <div data-testid="panel-action-bar" className="relative z-20 border-t border-[#3d372e] bg-[#11100d]/98 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        {actions}
      </div>
    </div>
  );
}
