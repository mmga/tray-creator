"use client";

import { useModeEditor } from "@/hooks/useModeEditor";
import { ModeTabs } from "@/components/ModeTabs";
import { Boxes } from "lucide-react";

export default function Home() {
  const editor = useModeEditor();

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden">
      {editor.active.overlays}

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
      <ModeTabs
        mode={editor.active.mode}
        onModeChange={(mode) => editor.perform({ type: "switch-mode", mode })}
      />

      {/* ===== 主布局: 左右分栏 ===== */}
      <main className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Left Panel */}
        <aside
          aria-label="参数面板"
          className="h-[46%] w-full min-w-0 shrink-0 overflow-hidden bg-[#0e0d0b] md:h-full md:w-[380px] md:min-w-[320px]"
        >
          <div className="h-full min-h-0">{editor.active.panel}</div>
        </aside>

        {/* Divider */}
        <div className="relative h-[3px] w-full shrink-0 bg-gradient-to-r from-[#2e2a24] via-[#3d372e] to-[#2e2a24] md:h-full md:w-[3px] md:bg-gradient-to-b">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#b8963a20] to-transparent md:bg-gradient-to-b" />
        </div>

        {/* Right Viewport */}
        <section aria-label="建模视口" className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#0a0908]">
          {editor.active.viewport}
        </section>
      </main>
    </div>
  );
}
