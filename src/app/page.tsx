"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTrayModel } from "@/hooks/useTrayModel";
import { useCustomLayout } from "@/hooks/useCustomLayout";
import { ModeTabs } from "@/components/ModeTabs";
import type { AppMode } from "@/types/custom-tray";
import { Boxes } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Lazy load components
const ParameterPanel = dynamic(() => import("@/components/ParameterPanel"), { ssr: false });
const CustomPanel = dynamic(() => import("@/components/CustomPanel"), { ssr: false });
const LayoutCanvas = dynamic(() => import("@/components/LayoutCanvas"), { ssr: false });
const TrayViewer = dynamic(() => import("@/components/TrayViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-[#0a0908]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-muted-foreground/40 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-mono tracking-wider">LOADING FORGE...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [mode, setMode] = useState<AppMode>("grid");
  const [rightView, setRightView] = useState<"2d" | "3d">("2d");

  // Grid Mode State
  const gridModel = useTrayModel();

  // Custom Mode State
  const customModel = useCustomLayout();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="relative shrink-0">
        <div className="flex items-center justify-between px-6 py-3 bg-[#0e0d0b] border-b-2 border-[#2e2a24]">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 border-2 border-primary/60 bg-[#1c1a16] shadow-inner">
              <Boxes className="w-5 h-5 text-primary" />
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
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-medium bg-[#1c1a16] text-muted-foreground border border-[#2e2a24] tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8b1a1a] animate-ember" />
              FORGE v0.2
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] gold-trim" />
      </header>

      {/* Mode Switcher */}
      <ModeTabs mode={mode} onModeChange={setMode} />

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <aside className="w-[380px] shrink-0 overflow-y-auto bg-[#0e0d0b] [scrollbar-gutter:stable]">
          <div className="p-4 pb-6 h-full">
            {mode === "grid" ? (
              <ParameterPanel
                params={gridModel.params}
                setParams={gridModel.setParams}
                updateParam={gridModel.updateParam}
                onGenerate={() => {
                  gridModel.handleGenerate();
                  setRightView("3d");
                }}
                onExportSTL={gridModel.handleExportSTL}
                isGenerating={gridModel.isGenerating}
              />
            ) : (
              <CustomPanel
                params={customModel.params}
                setParams={customModel.setParams}
                updateParam={customModel.updateParam}
                onAddSlot={customModel.addSlot}
                onGenerate={() => {
                  customModel.handleGenerate();
                  setRightView("3d");
                }}
                onExportSTL={customModel.handleExportSTL}
                isGenerating={customModel.isGenerating}
              />
            )}
          </div>
        </aside>

        {/* Divider */}
        <div className="w-[3px] shrink-0 bg-gradient-to-b from-[#2e2a24] via-[#3d372e] to-[#2e2a24] relative">
          <div className="absolute top-0 left-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-[#b8963a20] to-transparent" />
        </div>

        {/* Right Viewport */}
        <section className="flex-1 bg-[#0a0908] relative flex flex-col">
          {mode === "grid" ? (
            // Grid Mode: Always 3D
            <TrayViewer geometry={gridModel.threeGeometry} />
          ) : (
            // Custom Mode: Toggle between 2D Canvas and 3D Viewer
            <Tabs
              value={rightView}
              onValueChange={(v) => setRightView(v as "2d" | "3d")}
              className="flex-1 flex flex-col relative"
            >
              <div className="absolute top-3 right-5 z-20">
                <TabsList className="bg-[#1c1a16] border border-[#2e2a24]">
                  <TabsTrigger value="2d" className="text-xs">2D 编辑</TabsTrigger>
                  <TabsTrigger value="3d" className="text-xs">3D 预览</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="2d" className="absolute inset-0 m-0 p-0 data-[state=inactive]:hidden">
                <div className="w-full h-full border-t border-[#2e2a24]">
                  <LayoutCanvas
                    params={customModel.params}
                    onUpdateSlot={customModel.updateSlotPosition}
                    onRemoveSlot={customModel.removeSlot}
                    onUpdateSlotRotation={customModel.updateSlotRotation}
                    onUndo={customModel.undo}
                    onSaveSnapshot={customModel.saveSnapshot}
                  />
                </div>
              </TabsContent>

              <TabsContent value="3d" className="absolute inset-0 m-0 data-[state=inactive]:hidden">
                <TrayViewer geometry={customModel.threeGeometry} />
              </TabsContent>
            </Tabs>
          )}
        </section>
      </main>
    </div>
  );
}
