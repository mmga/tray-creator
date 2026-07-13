"use client";

import {
  useState,
} from "react";
import { useModeEditorWorkspaces } from "@/hooks/useModeEditorWorkspaces";
import { ModeTabs } from "@/components/ModeTabs";
import { DraftManagerDialog } from "@/components/DraftManagerDialog";
import type { AppMode } from "@/types/custom-tray";
import { Boxes } from "lucide-react";

export default function Home() {
  const [mode, setMode] = useState<AppMode>("grid");
  const { activeWorkspace, activeViewport } = useModeEditorWorkspaces({
    mode,
  });

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden">
      <DraftManagerDialog
        {...activeWorkspace.draftDialogProps}
      />

      {/* Header */}
      <header className="relative shrink-0">
        <div className="flex items-center justify-between px-3 lg:px-6 py-2 lg:py-3 bg-[#0e0d0b] border-b-2 border-[#2e2a24]">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 border-2 border-primary/60 bg-[#1c1a16] shadow-inner">
              <Boxes className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
              <div className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2 border-primary/80" />
              <div className="absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2 border-primary/80" />
              <div className="absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2 border-primary/80" />
              <div className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2 border-primary/80" />
            </div>
            <div>
              <h1 className="text-sm lg:text-base font-bold tracking-[0.15em] text-primary parchment-glow leading-tight">
                战锤托盘生成器
              </h1>
              <span className="hidden lg:inline text-[10px] text-muted-foreground font-mono tracking-[0.3em] uppercase">
                TRAY CREATOR — FORGEWORLD
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-medium bg-[#1c1a16] text-muted-foreground border border-[#2e2a24] tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8b1a1a] animate-ember" />
              FORGE v0.2
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] gold-trim" />
      </header>

      {/* Mode Switcher */}
      <ModeTabs mode={mode} onModeChange={(m) => {
        activeViewport.resetTransientState();
        setMode(m);
      }} />

      {/* ===== 主布局: 左右分栏 ===== */}
      <main className="flex flex-row flex-1 overflow-hidden">
        {/* Left Panel */}
        <aside className="h-full w-[380px] min-w-[320px] shrink-0 overflow-hidden bg-[#0e0d0b]">
          <div className="h-full min-h-0">{activeWorkspace.panel}</div>
        </aside>

        {/* Divider */}
        <div className="w-[3px] shrink-0 bg-gradient-to-b from-[#2e2a24] via-[#3d372e] to-[#2e2a24] relative">
          <div className="absolute top-0 left-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-[#b8963a20] to-transparent" />
        </div>

        {/* Right Viewport */}
        <section className="flex-1 bg-[#0a0908] relative flex flex-col">
          {activeViewport.viewport}
        </section>
      </main>
    </div>
  );
}
