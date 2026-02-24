"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useTrayModel } from "@/hooks/useTrayModel";
import { useCustomLayout } from "@/hooks/useCustomLayout";
import { ModeTabs } from "@/components/ModeTabs";
import type { AppMode } from "@/types/custom-tray";
import { Boxes, Settings2, PenTool, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAdmin } from "@/lib/permissions";
import { Inbox } from "lucide-react";
import { OrdersInbox } from "@/components/OrdersInbox";

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

/** 检测是否为移动端 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function Home() {
  const [mode, setMode] = useState<AppMode>("grid");
  const [rightView, setRightView] = useState<"2d" | "3d">("2d");
  const [mobileTab, setMobileTab] = useState<"params" | "2d" | "3d">("params");
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const isMobile = useIsMobile();

  // Grid Mode State
  const gridModel = useTrayModel();

  // Custom Mode State
  const customModel = useCustomLayout();

  const handleLoadOrder = (orderMode: AppMode, params: unknown) => {
    setMode(orderMode);
    if (orderMode === "grid") {
      gridModel.setParams(params as any);
      setRightView("3d");
      setMobileTab("3d");
    } else {
      customModel.setParams(params as any);
      setRightView("2d");
      setMobileTab("2d");
    }
  };

  // 参数面板内容（共享于桌面和移动端）
  const renderParameterPanel = () =>
    mode === "grid" ? (
      <ParameterPanel
        params={gridModel.params}
        setParams={gridModel.setParams}
        updateParam={gridModel.updateParam}
        onGenerate={() => {
          gridModel.handleGenerate();
          setRightView("3d");
          if (isMobile) setMobileTab("3d");
        }}
        onExportSTL={gridModel.handleExportSTL}
        isGenerating={gridModel.isGenerating}
        volume={gridModel.volume}
      />
    ) : (
      <CustomPanel
        params={customModel.params}
        setParams={customModel.setParams}
        updateParam={customModel.updateParam}
        onAddSlot={customModel.addSlot}
        onTrimBaseplate={customModel.trimBaseplate}
        onGenerate={() => {
          customModel.handleGenerate();
          setRightView("3d");
          if (isMobile) setMobileTab("3d");
        }}
        onExportSTL={customModel.handleExportSTL}
        isGenerating={customModel.isGenerating}
        volume={customModel.volume}
      />
    );

  // 视口内容（共享于桌面和移动端）
  const renderViewport = () => {
    if (mode === "grid") {
      return <TrayViewer geometry={gridModel.threeGeometry} />;
    }
    // Custom mode: 2D/3D toggle
    return (
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
              onUpdateMultipleSlots={customModel.updateMultipleSlots}
              onDuplicateSlots={customModel.duplicateSlots}
              onUndo={customModel.undo}
              onSaveSnapshot={customModel.saveSnapshot}
            />
          </div>
        </TabsContent>

        <TabsContent value="3d" className="absolute inset-0 m-0 data-[state=inactive]:hidden">
          <TrayViewer geometry={customModel.threeGeometry} />
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
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
            {isAdmin && (
              <button
                onClick={() => setIsInboxOpen(true)}
                className="flex items-center gap-1.5 px-2 lg:px-3 py-1 text-xs font-semibold bg-[#2a3528] text-[#8cb880] border border-[#4a6741] hover:bg-[#354530] transition-colors shadow-lg shadow-[#2a352830]"
              >
                <Inbox className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">收件箱</span>
              </button>
            )}
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
        setMode(m);
        // 切换模式时，如果移动端停在2d tab但进了grid模式，回退到params
        if (m === "grid" && mobileTab === "2d") setMobileTab("params");
      }} />

      {/* ===== 桌面端布局 (≥1024px): 左右分栏 ===== */}
      <main className="hidden lg:flex flex-row flex-1 overflow-hidden">
        {/* Left Panel */}
        <aside className="w-[380px] shrink-0 overflow-y-auto bg-[#0e0d0b] [scrollbar-gutter:stable] h-full">
          <div className="p-4 pb-6 h-full">
            {renderParameterPanel()}
          </div>
        </aside>

        {/* Divider */}
        <div className="w-[3px] shrink-0 bg-gradient-to-b from-[#2e2a24] via-[#3d372e] to-[#2e2a24] relative">
          <div className="absolute top-0 left-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-[#b8963a20] to-transparent" />
        </div>

        {/* Right Viewport */}
        <section className="flex-1 bg-[#0a0908] relative flex flex-col">
          {renderViewport()}
        </section>
      </main>

      {/* ===== 移动端布局 (<1024px): 底部 Tab 切换全屏视图 ===== */}
      <div className="flex lg:hidden flex-col flex-1 overflow-hidden">
        {/* 内容区 - 占满剩余空间 */}
        <div className="flex-1 overflow-hidden relative">
          {/* 参数面板 */}
          <div className={`absolute inset-0 overflow-y-auto bg-[#0e0d0b] transition-opacity duration-200 ${mobileTab === 'params' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <div className="p-4 pb-6">
              {renderParameterPanel()}
            </div>
          </div>

          {/* 2D 画布 */}
          {mode === "custom" && (
            <div className={`absolute inset-0 bg-[#0a0908] transition-opacity duration-200 ${mobileTab === '2d' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
              <LayoutCanvas
                params={customModel.params}
                onUpdateSlot={customModel.updateSlotPosition}
                onRemoveSlot={customModel.removeSlot}
                onUpdateSlotRotation={customModel.updateSlotRotation}
                onUpdateMultipleSlots={customModel.updateMultipleSlots}
                onDuplicateSlots={customModel.duplicateSlots}
                onUndo={customModel.undo}
                onSaveSnapshot={customModel.saveSnapshot}
              />
            </div>
          )}

          {/* 3D 预览 - 仅在选中时挂载以节省GPU资源 */}
          {mobileTab === '3d' && (
            <div className="absolute inset-0 bg-[#0a0908] z-10">
              {mode === "grid" ? (
                <TrayViewer geometry={gridModel.threeGeometry} />
              ) : (
                <TrayViewer geometry={customModel.threeGeometry} />
              )}
            </div>
          )}
        </div>

        {/* 底部 Tab Bar */}
        <nav className="shrink-0 flex items-center bg-[#0e0d0b] border-t-2 border-[#2e2a24] safe-area-bottom">
          <button
            onClick={() => setMobileTab("params")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${mobileTab === 'params' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Settings2 className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">参数</span>
          </button>
          {mode === "custom" && (
            <button
              onClick={() => setMobileTab("2d")}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${mobileTab === '2d' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <PenTool className="w-5 h-5" />
              <span className="text-[10px] font-bold tracking-wider uppercase">2D 编辑</span>
            </button>
          )}
          <button
            onClick={() => setMobileTab("3d")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${mobileTab === '3d' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Eye className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">3D 预览</span>
          </button>
        </nav>
      </div>

      {/* Admin Inbox Modal */}
      {isAdmin && (
        <OrdersInbox
          isOpen={isInboxOpen}
          onClose={() => setIsInboxOpen(false)}
          onLoadOrder={handleLoadOrder}
        />
      )}
    </div>
  );
}
