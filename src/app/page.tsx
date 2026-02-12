"use client";

import dynamic from "next/dynamic";
import { useTrayModel } from "@/hooks/useTrayModel";
import ParameterPanel from "@/components/ParameterPanel";
import { Boxes } from "lucide-react";

// Three.js / R3F 需要客户端加载，禁用 SSR
const TrayViewer = dynamic(() => import("@/components/TrayViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-zinc-950 rounded-xl flex items-center justify-center border border-zinc-800">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
        <p className="text-sm">加载 3D 视口...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const { params, setParams, updateParam, threeGeometry, isGenerating, handleGenerate, handleExportSTL } =
    useTrayModel();

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <Boxes className="w-6 h-6 text-emerald-500" />
          <h1 className="text-lg font-bold tracking-tight">
            战锤托盘生成器
          </h1>
        </div>
        <span className="text-xs text-zinc-600 ml-2">Tray Creator</span>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* 左侧参数面板 */}
        <aside className="w-80 shrink-0 border-r border-zinc-800 bg-zinc-950 overflow-y-auto p-4">
          <ParameterPanel
            params={params}
            setParams={setParams}
            updateParam={updateParam}
            onGenerate={handleGenerate}
            onExportSTL={handleExportSTL}
            isGenerating={isGenerating}
          />
        </aside>

        {/* 右侧 3D 视口 */}
        <section className="flex-1 p-4">
          <TrayViewer geometry={threeGeometry} />
        </section>
      </main>
    </div>
  );
}
