"use client";

import dynamic from "next/dynamic";
import { useTrayModel } from "@/hooks/useTrayModel";
import ParameterPanel from "@/components/ParameterPanel";
import { Boxes } from "lucide-react";

// Three.js / R3F 需要客户端加载，禁用 SSR
const TrayViewer = dynamic(() => import("@/components/TrayViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] rounded-sm flex items-center justify-center forged-viewport bg-[#0a0908]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-muted-foreground/40 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-mono tracking-wider">LOADING FORGE...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const { params, setParams, updateParam, threeGeometry, isGenerating, handleGenerate, handleExportSTL } =
    useTrayModel();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header — Heavy Imperial bar */}
      <header className="relative shrink-0">
        <div className="flex items-center justify-between px-6 py-3 bg-[#0e0d0b] border-b-2 border-[#2e2a24]">
          <div className="flex items-center gap-3">
            {/* Imperial insignia */}
            <div className="relative flex items-center justify-center w-10 h-10 border-2 border-primary/60 bg-[#1c1a16] shadow-inner">
              <Boxes className="w-5 h-5 text-primary" />
              {/* Corner notches */}
              <div className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2 border-primary/80" />
              <div className="absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2 border-primary/80" />
              <div className="absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2 border-primary/80" />
              <div className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2 border-primary/80" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-[0.15em] text-primary parchment-glow leading-tight">
                战锤托盘生成器
              </h1>
              <span className="text-[10px] text-muted-foreground font-mono tracking-[0.3em] uppercase">
                TRAY CREATOR — FORGEWORLD
              </span>
            </div>
          </div>
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-medium bg-[#1c1a16] text-muted-foreground border border-[#2e2a24] tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8b1a1a] animate-ember" />
              FORGE v0.1
            </span>
          </div>
        </div>
        {/* Gold trim line under header */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] gold-trim" />
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* 左侧参数面板 */}
        <aside className="w-[340px] shrink-0 overflow-y-auto bg-[#0e0d0b]">
          <div className="p-4 pb-6">
            <ParameterPanel
              params={params}
              setParams={setParams}
              updateParam={updateParam}
              onGenerate={handleGenerate}
              onExportSTL={handleExportSTL}
              isGenerating={isGenerating}
            />
          </div>
        </aside>

        {/* Heavy iron divider */}
        <div className="w-[3px] shrink-0 bg-gradient-to-b from-[#2e2a24] via-[#3d372e] to-[#2e2a24] relative">
          <div className="absolute top-0 left-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-[#b8963a20] to-transparent" />
        </div>

        {/* 右侧 3D 视口 */}
        <section className="flex-1 p-4 bg-[#0a0908]">
          <TrayViewer geometry={threeGeometry} />
        </section>
      </main>
    </div>
  );
}
