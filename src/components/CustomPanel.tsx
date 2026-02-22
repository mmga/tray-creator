"use client";

import type { CustomLayoutParams } from "@/types/custom-tray";
import { BASE_PRESETS, ELLIPSE_PRESETS, CUSTOM_LIMITS, PARAM_CONFIG, MAX_BUILD_SIZE } from "@/lib/config";
import { calculateCustomTrayDimensions } from "@/lib/custom-tray-model";
import { Button } from "@/components/ui/button";
import {
  Download,
  RotateCcw,
  Play,
  Loader2,
  Plus,
  Trash2,
  Minimize,
  Layout,
  Wrench,
  Ruler,
  BoxSelect,
  Share2,
} from "lucide-react";
import { BaseHoleConfig } from "@/components/BaseHoleConfig";
import { ParamIOButtons } from "@/components/ParamIOButtons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { isAdmin } from "@/lib/permissions";
import { exportParams } from "@/lib/param-io";

interface CustomPanelProps {
  params: CustomLayoutParams;
  updateParam: <K extends keyof CustomLayoutParams>(key: K, value: CustomLayoutParams[K]) => void;
  setParams: React.Dispatch<React.SetStateAction<CustomLayoutParams>>;
  onAddSlot: (width: number, height?: number) => void;
  onTrimBaseplate: () => void;
  onGenerate: () => void;
  onExportSTL: () => void;
  isGenerating: boolean;
}

export default function CustomPanel({
  params,
  updateParam,
  setParams,
  onAddSlot,
  onTrimBaseplate,
  onGenerate,
  onExportSTL,
  isGenerating,
}: CustomPanelProps) {
  const dimensions = calculateCustomTrayDimensions(params);
  const isOversized = dimensions.width > MAX_BUILD_SIZE || dimensions.depth > MAX_BUILD_SIZE;

  const handleReset = () => {
    // Reset to defaults but keep current logic if needed
    // For now, simpler to reload or re-init state in parent, 
    // but here we can just reset specific params if we want.
    // However, CustomPanelProps passes setParams which expects full object.
    // We'll trust the parent or import default.
    // Let's import default to be safe.
    const { CUSTOM_LAYOUT_DEFAULTS } = require("@/lib/config");
    setParams(CUSTOM_LAYOUT_DEFAULTS);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 托盘尺寸 */}
      <div className="iron-panel rounded-sm p-4 space-y-4">
        <SectionHeader icon={Layout} title="托盘尺寸" />
        <ParamSlider
          label={CUSTOM_LIMITS.trayWidth.label}
          value={params.trayWidth}
          config={CUSTOM_LIMITS.trayWidth}
          onChange={(v) => updateParam("trayWidth", v)}
          unit={CUSTOM_LIMITS.trayWidth.unit}
        />
        <ParamSlider
          label={CUSTOM_LIMITS.trayDepth.label}
          value={params.trayDepth}
          config={CUSTOM_LIMITS.trayDepth}
          onChange={(v) => updateParam("trayDepth", v)}
          unit={CUSTOM_LIMITS.trayDepth.unit}
        />
        <Button
          variant="outline"
          onClick={onTrimBaseplate}
          disabled={params.slots.length === 0}
          className="w-full h-9 border-[#2e2a24] text-[#8cb880] cursor-pointer hover:bg-[#2a3528]/30 hover:border-[#4a6741] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Minimize className="w-3.5 h-3.5 mr-2" />
          <span className="text-sm tracking-wider">裁剪底板</span>
        </Button>
      </div>

      {/* 添加凹槽 */}
      <div className="iron-panel rounded-sm p-4 space-y-3">
        <SectionHeader icon={BoxSelect} title="添加圆形凹槽" />
        <div className="grid grid-cols-3 gap-2">
          {BASE_PRESETS.map((preset, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => onAddSlot(preset.diameter)}
              className="h-8 text-[11px] border-[#2e2a24] bg-[#1c1a16] hover:bg-[#2e2a24] hover:text-primary transition-all"
            >
              <Plus className="w-3 h-3 mr-1" />
              {preset.diameter}
            </Button>
          ))}
        </div>

        <SectionHeader icon={BoxSelect} title="添加椭圆凹槽" />
        <div className="grid grid-cols-2 gap-2">
          {ELLIPSE_PRESETS.map((preset, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => onAddSlot(preset.width, preset.height)}
              className="h-8 text-[11px] border-[#2e2a24] bg-[#1c1a16] hover:bg-[#2e2a24] hover:text-primary transition-all"
            >
              <Plus className="w-3 h-3 mr-1" />
              {preset.name.replace('mm', '')}
            </Button>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground/50 text-center pt-1">
          点击上方按钮添加，在右侧画布拖拽与删除
        </p>
      </div>

      {/* 结构参数 (独立) */}
      <div className="iron-panel rounded-sm p-4 space-y-4">
        <SectionHeader icon={Wrench} title="结构参数" />

        <ParamSlider
          label={CUSTOM_LIMITS.spacing.label}
          value={params.spacing}
          config={CUSTOM_LIMITS.spacing}
          onChange={(v) => updateParam("spacing", v)}
          unit={CUSTOM_LIMITS.spacing.unit}
        />
        <ParamSlider
          label={PARAM_CONFIG.baseThickness.label}
          value={params.baseThickness}
          config={CUSTOM_LIMITS.baseThickness}
          onChange={(v) => updateParam("baseThickness", v)}
          unit={PARAM_CONFIG.baseThickness.unit}
        />
        <ParamSlider
          label={PARAM_CONFIG.holeDepth.label}
          value={params.holeDepth}
          config={CUSTOM_LIMITS.holeDepth}
          onChange={(v) => updateParam("holeDepth", v)}
          unit={PARAM_CONFIG.holeDepth.unit}
        />
        <ParamSlider
          label={PARAM_CONFIG.cornerRadius.label}
          value={params.cornerRadius}
          config={CUSTOM_LIMITS.cornerRadius}
          onChange={(v) => updateParam("cornerRadius", v)}
          unit={PARAM_CONFIG.cornerRadius.unit}
        />
      </div>

      {/* 底板孔位 */}
      <BaseHoleConfig
        enableBaseHole={params.enableBaseHole}
        baseHoleSize={params.baseHoleSize}
        baseThickness={params.baseThickness}
        updateParam={updateParam}
      />

      {/* 模型尺寸 */}
      <div className={`iron-panel rounded-sm p-4 space-y-3 transition-all duration-300 ${isOversized ? 'border-[#8b1a1a] animate-forge-pulse' : ''}`}>
        <SectionHeader icon={Ruler} title="统计信息" />
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
            <span className="text-[10px] text-muted-foreground block">凹槽数量</span>
            <span className="text-lg font-mono font-bold text-primary">{params.slots.length}</span>
          </div>
          <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
            <span className="text-[10px] text-muted-foreground block">预计耗材</span>
            <span className="text-xs font-mono text-muted-foreground/80">计算中...</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "宽度", value: dimensions.width, warn: dimensions.width > MAX_BUILD_SIZE },
            { label: "深度", value: dimensions.depth, warn: dimensions.depth > MAX_BUILD_SIZE },
            { label: "高度", value: dimensions.height, warn: false },
          ].map(({ label, value, warn }) => (
            <div
              key={label}
              className={`relative text-center p-2.5 transition-colors duration-200 ${warn
                ? 'bg-[#8b1a1a15] border border-[#8b1a1a50]'
                : 'bg-[#1c1a16] border border-[#2e2a24]'
                }`}
            >
              <p className="text-[11px] text-muted-foreground/60 mb-0.5">{label}</p>
              <p className={`text-sm font-mono font-semibold tabular-nums ${warn ? 'text-[#c04040]' : 'text-foreground'}`}>
                {value.toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground/40 font-mono">mm</p>
            </div>
          ))}
        </div>
        {isOversized && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-[#c04040] animate-fade-in">
            <span>超过锻造极限</span>
          </div>
        )}
      </div>

      <div className="wh-divider" />

      {/* 操作按钮 */}
      <div className="flex flex-col gap-2.5 pb-4">
        <Button
          onClick={onGenerate}
          disabled={isGenerating || isOversized}
          className="w-full h-11 blood-red text-sm text-[#f0d8b8] font-bold tracking-wider cursor-pointer border border-[#a02020] shadow-lg shadow-[#8b1a1a30] hover:shadow-xl hover:shadow-[#8b1a1a50] hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          {isGenerating ? "锻造中..." : isOversized ? "尺寸超限" : "开始锻造"}
        </Button>
        {isAdmin ? (
          <Button
            onClick={onExportSTL}
            className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-sm text-[#8cb880] font-semibold tracking-wider cursor-pointer border border-[#4a6741] shadow-lg shadow-[#2a352830]"
          >
            <Download className="w-4 h-4 mr-2" />
            导出 STL
          </Button>
        ) : (
          <Button
            onClick={() => exportParams("custom", params as any)}
            className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-sm text-[#8cb880] font-semibold tracking-wider cursor-pointer border border-[#4a6741] shadow-lg shadow-[#2a352830]"
          >
            <Share2 className="w-4 h-4 mr-2" />
            导出参数
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleReset}
          className="w-full h-9 text-sm border-[#2e2a24] text-muted-foreground tracking-wider cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e]"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          重置参数
        </Button>
        <ParamIOButtons
          mode="custom"
          params={params as unknown as Record<string, unknown>}
          onImport={(p) => setParams(p as CustomLayoutParams)}
        />
      </div>
    </div>
  );
}
