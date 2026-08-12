"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CircleDot, Grid3X3, MousePointer2, Layers } from "lucide-react";
import type { AppMode } from "@/types/custom-tray";

interface ModeTabsProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  return (
    <div className="px-1 py-2 sm:px-3 lg:px-6 lg:py-3 bg-[#0e0d0b] border-b border-[#2e2a24]">
      <Tabs
        value={mode}
        onValueChange={(v) => onModeChange(v as AppMode)}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-[1240px] grid-cols-4 bg-[#1c1a16] border border-[#2e2a24]">
          <TabsTrigger
            value="grid"
            aria-label="网格模式"
            className="px-1 data-[state=active]:bg-[#2e2a24] data-[state=active]:text-primary text-muted-foreground transition-colors duration-200 sm:px-2"
          >
            <Grid3X3 aria-hidden="true" className="hidden w-4 h-4 sm:block" />
            <span aria-hidden="true" className="tracking-wider text-[11px] font-bold uppercase sm:text-xs"><span className="sm:hidden">网格</span><span className="hidden sm:inline">网格模式</span></span>
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            aria-label="自定义模式"
            className="px-1 data-[state=active]:bg-[#2e2a24] data-[state=active]:text-primary text-muted-foreground transition-colors duration-200 sm:px-2"
          >
            <MousePointer2 aria-hidden="true" className="hidden w-4 h-4 sm:block" />
            <span aria-hidden="true" className="tracking-wider text-[11px] font-bold uppercase sm:text-xs"><span className="sm:hidden">自定义</span><span className="hidden sm:inline">自定义模式</span></span>
          </TabsTrigger>
          <TabsTrigger
            value="base-converter"
            aria-label="底盘生成"
            className="px-1 data-[state=active]:bg-[#2e2a24] data-[state=active]:text-primary text-muted-foreground transition-colors duration-200 sm:px-2"
          >
            <CircleDot aria-hidden="true" className="hidden w-4 h-4 sm:block" />
            <span aria-hidden="true" className="tracking-wider text-[11px] font-bold uppercase sm:text-xs"><span className="sm:hidden">底盘</span><span className="hidden sm:inline">底盘生成</span></span>
          </TabsTrigger>
          <TabsTrigger
            value="stepped"
            aria-label="自定义阶梯底座"
            className="px-1 data-[state=active]:bg-[#2e2a24] data-[state=active]:text-primary text-muted-foreground transition-colors duration-200 sm:px-2"
          >
            <Layers aria-hidden="true" className="hidden w-4 h-4 sm:block" />
            <span aria-hidden="true" className="tracking-wider text-[11px] font-bold uppercase sm:text-xs"><span className="sm:hidden">阶梯</span><span className="hidden sm:inline">自定义阶梯底座</span></span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
