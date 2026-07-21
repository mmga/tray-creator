"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRightLeft, Grid3X3, MousePointer2, Layers } from "lucide-react";
import type { AppMode } from "@/types/custom-tray";

interface ModeTabsProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  return (
    <div className="px-3 lg:px-6 py-2 lg:py-3 bg-[#0e0d0b] border-b border-[#2e2a24]">
      <Tabs
        value={mode}
        onValueChange={(v) => onModeChange(v as AppMode)}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-[1240px] grid-cols-4 bg-[#1c1a16] border border-[#2e2a24]">
          <TabsTrigger
            value="grid"
            className="data-[state=active]:bg-[#2e2a24] data-[state=active]:text-primary text-muted-foreground transition-all duration-200"
          >
            <Grid3X3 className="w-4 h-4 mr-2" />
            <span className="tracking-wider text-xs font-bold uppercase">网格模式</span>
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className="data-[state=active]:bg-[#2e2a24] data-[state=active]:text-primary text-muted-foreground transition-all duration-200"
          >
            <MousePointer2 className="w-4 h-4 mr-2" />
            <span className="tracking-wider text-xs font-bold uppercase">自定义模式</span>
          </TabsTrigger>
          <TabsTrigger
            value="base-converter"
            className="data-[state=active]:bg-[#2e2a24] data-[state=active]:text-primary text-muted-foreground transition-all duration-200"
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            <span className="tracking-wider text-xs font-bold uppercase">转换底盘</span>
          </TabsTrigger>
          <TabsTrigger
            value="stepped"
            className="data-[state=active]:bg-[#2e2a24] data-[state=active]:text-primary text-muted-foreground transition-all duration-200"
          >
            <Layers className="w-4 h-4 mr-2" />
            <span className="tracking-wider text-xs font-bold uppercase">自定义阶梯底座</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
