"use client";

import type { CustomLayoutParams } from "@/types/custom-tray";
import { BASE_PRESETS, ELLIPSE_PRESETS, CUSTOM_LIMITS, PARAM_CONFIG, MAX_BUILD_SIZE } from "@/lib/config";
import { calculateCustomTrayDimensions } from "@/lib/custom-tray-model";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Download,
  RotateCcw,
  Play,
  Loader2,
  Plus,
  Trash2,
  Minimize,
  type LucideIcon,
} from "lucide-react";
import { BaseHoleConfig } from "@/components/BaseHoleConfig";
import { ParamIOButtons } from "@/components/ParamIOButtons";

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

/** Imperial section header with gold trim */
function SectionHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="relative pb-3 mb-1">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-6 h-6 border border-primary/40 bg-[#1c1a16]">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-xs font-bold text-primary/90 tracking-[0.2em] uppercase parchment-glow">
          {title}
        </h3>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px gold-trim opacity-40" />
    </div>
  );
}

function ParamSlider({
  label,
  value,
  config,
  onChange,
  unit = "mm",
}: {
  label: string;
  value: number;
  config: { min: number; max: number; step: number };
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="space-y-2 group">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors duration-200">
          {label}
        </Label>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            value={value}
            min={config.min}
            max={config.max}
            step={config.step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= config.min && v <= config.max) {
                onChange(v);
              }
            }}
            className="w-18 h-7 text-right text-sm font-mono bg-[#1c1a16] border-[#2e2a24] text-foreground focus:border-primary/50 focus:ring-primary/20 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[11px] text-muted-foreground/60 w-6 font-mono">{unit}</span>
        </div>
      </div>
      <Slider
        value={[value]}
        min={config.min}
        max={config.max}
        step={config.step}
        onValueChange={([v]) => onChange(v)}
        className="py-1"
      />
    </div>
  );
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

  // Icons
  const LayoutIcon = require("lucide-react").Layout as LucideIcon;
  const WrenchIcon = require("lucide-react").Wrench as LucideIcon;
  const RulerIcon = require("lucide-react").Ruler as LucideIcon;
  const BoxSelectIcon = require("lucide-react").BoxSelect as LucideIcon;

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
        <SectionHeader icon={LayoutIcon} title="托盘尺寸" />
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
      </div>

      {/* 添加凹槽 */}
      <div className="iron-panel rounded-sm p-4 space-y-3">
        <SectionHeader icon={BoxSelectIcon} title="添加圆形凹槽" />
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

        <SectionHeader icon={BoxSelectIcon} title="添加椭圆凹槽" />
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
        <SectionHeader icon={WrenchIcon} title="结构参数" />

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
        <SectionHeader icon={RulerIcon} title="统计信息" />
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
          disabled={isGenerating}
          className="w-full h-11 blood-red text-[#f0d8b8] font-bold tracking-wider cursor-pointer border border-[#a02020] shadow-lg shadow-[#8b1a1a30] hover:shadow-xl hover:shadow-[#8b1a1a50] hover:brightness-125 disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          {isGenerating ? "锻造中..." : "开始锻造"}
        </Button>
        <Button
          onClick={onExportSTL}
          className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-[#8cb880] font-semibold tracking-wider cursor-pointer border border-[#4a6741] shadow-lg shadow-[#2a352830]"
        >
          <Download className="w-4 h-4 mr-2" />
          导出 STL
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          className="w-full h-9 border-[#2e2a24] text-muted-foreground cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e]"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-2" />
          <span className="text-sm tracking-wider">重置参数</span>
        </Button>
        <Button
          variant="outline"
          onClick={onTrimBaseplate}
          disabled={params.slots.length === 0}
          className="w-full h-9 border-[#2e2a24] text-[#8cb880] cursor-pointer hover:bg-[#2a3528]/30 hover:border-[#4a6741] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Minimize className="w-3.5 h-3.5 mr-2" />
          <span className="text-sm tracking-wider">裁剪底板</span>
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
