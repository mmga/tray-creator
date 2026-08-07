"use client";

import { Boxes } from "lucide-react";
import { ModeTabs } from "@/components/ModeTabs";
import { useModeEditor } from "@/hooks/useModeEditor";

export default function TrayCreatorEditorRuntime() {
  const editor = useModeEditor();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {editor.active.overlays}

      <header className="relative shrink-0">
        <div className="flex items-center justify-between border-b-2 border-[#2e2a24] bg-[#0e0d0b] px-3 py-2 lg:px-6 lg:py-3">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center border-2 border-primary/60 bg-[#1c1a16] shadow-inner lg:h-10 lg:w-10">
              <Boxes className="h-4 w-4 text-primary lg:h-5 lg:w-5" />
              <div className="absolute -left-px -top-px h-2 w-2 border-l-2 border-t-2 border-primary/80" />
              <div className="absolute -right-px -top-px h-2 w-2 border-r-2 border-t-2 border-primary/80" />
              <div className="absolute -bottom-px -left-px h-2 w-2 border-b-2 border-l-2 border-primary/80" />
              <div className="absolute -bottom-px -right-px h-2 w-2 border-b-2 border-r-2 border-primary/80" />
            </div>
            <div>
              <h1 className="parchment-glow text-sm font-bold leading-tight tracking-[0.15em] text-primary lg:text-base">
                战锤托盘生成器
              </h1>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground lg:inline">
                TRAY CREATOR — FORGEWORLD
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white">
            <span className="hidden items-center gap-1.5 border border-[#2e2a24] bg-[#1c1a16] px-2.5 py-1 font-mono text-[10px] font-medium tracking-wider text-muted-foreground sm:inline-flex">
              <span className="animate-ember h-1.5 w-1.5 rounded-full bg-[#8b1a1a]" />
              FORGE v0.2
            </span>
          </div>
        </div>
        <div className="gold-trim absolute bottom-0 left-0 right-0 h-[2px]" />
      </header>

      <ModeTabs
        mode={editor.active.mode}
        onModeChange={(mode) => editor.perform({ type: "switch-mode", mode })}
      />

      <main className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <aside
          aria-label="参数面板"
          className="h-[46%] w-full min-w-0 shrink-0 overflow-hidden bg-[#0e0d0b] md:h-full md:w-[380px] md:min-w-[320px]"
        >
          <div className="h-full min-h-0">{editor.active.panel}</div>
        </aside>

        <div className="relative h-[3px] w-full shrink-0 bg-gradient-to-r from-[#2e2a24] via-[#3d372e] to-[#2e2a24] md:h-full md:w-[3px] md:bg-gradient-to-b">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#b8963a20] to-transparent md:bg-gradient-to-b" />
        </div>

        <section
          aria-label="建模视口"
          className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#0a0908]"
        >
          {editor.active.viewport}
        </section>
      </main>
    </div>
  );
}
