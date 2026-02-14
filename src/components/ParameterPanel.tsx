"use client";
import type { TrayParams } from "@/types/tray";
import { BASE_PRESETS, PARAM_LIMITS, DEFAULT_PRESET_INDEX, BASE_HOLE_CONFIG } from "@/lib/config";
import { calculateTrayDimensions } from "@/lib/tray-model";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, RotateCcw, Play, Loader2, Circle, type LucideIcon } from "lucide-react";
import { DEFAULT_TRAY_PARAMS } from "@/lib/config";

interface ParameterPanelProps {
  params: TrayParams;
  updateParam: <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => void;
  setParams: React.Dispatch<React.SetStateAction<TrayParams>>;
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
      {/* Gold underline */}
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

export default function ParameterPanel({
  params,
  updateParam,
  setParams,
  onGenerate,
  onExportSTL,
  isGenerating,
}: ParameterPanelProps) {
  const dimensions = calculateTrayDimensions(params);
  const isOversized = dimensions.width > 260 || dimensions.depth > 260;

  const handlePresetChange = (value: string) => {
    const index = parseInt(value);
    const preset = BASE_PRESETS[index];
    if (preset) {
      updateParam("holeDiameter", preset.diameter);
    }
  };

  const handleReset = () => {
    setParams(DEFAULT_TRAY_PARAMS);
  };

  // Import icons inline to avoid issues
  const LayoutIcon = require("lucide-react").Layout as LucideIcon;
  const WrenchIcon = require("lucide-react").Wrench as LucideIcon;
  const RulerIcon = require("lucide-react").Ruler as LucideIcon;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto animate-fade-in">
      {/* 布局参数 */}
      <div className="iron-panel rounded-sm p-4 space-y-4">
        <SectionHeader icon={LayoutIcon} title="布局" />

        {/* 底座预设 */}
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">底座尺寸</Label>
          <Select
            defaultValue={String(DEFAULT_PRESET_INDEX)}
            onValueChange={handlePresetChange}
          >
            <SelectTrigger className="bg-[#1c1a16] border-[#2e2a24] text-foreground hover:border-primary/40 cursor-pointer transition-all duration-200">
              <SelectValue placeholder="选择底座尺寸" />
            </SelectTrigger>
            <SelectContent className="bg-[#16140f] border-[#2e2a24]">
              {BASE_PRESETS.map((preset, i) => (
                <SelectItem
                  key={i}
                  value={String(i)}
                  className="text-foreground/90 cursor-pointer focus:bg-primary/10 focus:text-primary"
                >
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ParamSlider
          label="列数"
          value={params.columns}
          config={PARAM_LIMITS.columns}
          onChange={(v) => updateParam("columns", v)}
          unit="个"
        />
        <ParamSlider
          label="行数"
          value={params.rows}
          config={PARAM_LIMITS.rows}
          onChange={(v) => updateParam("rows", v)}
          unit="个"
        />
        <ParamSlider
          label="间距"
          value={params.spacing}
          config={PARAM_LIMITS.spacing}
          onChange={(v) => updateParam("spacing", v)}
        />
      </div>

      {/* 结构参数 */}
      <div className="iron-panel rounded-sm p-4 space-y-4">
        <SectionHeader icon={WrenchIcon} title="结构" />

        <ParamSlider
          label="底板厚度"
          value={params.baseThickness}
          config={params.enableBaseHole
            ? { ...PARAM_LIMITS.baseThickness, min: 3 }
            : PARAM_LIMITS.baseThickness}
          onChange={(v) => updateParam("baseThickness", v)}
        />
        <ParamSlider
          label="凹槽深度"
          value={params.holeDepth}
          config={PARAM_LIMITS.holeDepth}
          onChange={(v) => updateParam("holeDepth", v)}
        />
        <ParamSlider
          label="圆角半径"
          value={params.cornerRadius}
          config={PARAM_LIMITS.cornerRadius}
          onChange={(v) => updateParam("cornerRadius", v)}
        />
      </div>

      {/* 底板孔位 */}
      <div className="iron-panel rounded-sm p-4 space-y-4">
        <SectionHeader icon={Circle} title="底板孔位" />

        {/* 切换按钮组 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => updateParam("enableBaseHole", false)}
            className={`px-3 py-2 text-xs font-bold tracking-wider uppercase border transition-all duration-200 cursor-pointer ${!params.enableBaseHole
              ? 'bg-primary/15 text-primary border-primary/50 shadow-inner'
              : 'bg-[#1c1a16] text-muted-foreground border-[#2e2a24] hover:border-[#3d372e]'
              }`}
          >
            普通托盘
          </button>
          <button
            type="button"
            onClick={() => {
              updateParam("enableBaseHole", true);
              // 磁吸孔模式下底板厚度最小 3mm
              if (params.baseThickness < 3) {
                updateParam("baseThickness", 3);
              }
            }}
            className={`px-3 py-2 text-xs font-bold tracking-wider uppercase border transition-all duration-200 cursor-pointer ${params.enableBaseHole
              ? 'bg-primary/15 text-primary border-primary/50 shadow-inner'
              : 'bg-[#1c1a16] text-muted-foreground border-[#2e2a24] hover:border-[#3d372e]'
              }`}
          >
            磁吸孔
          </button>
        </div>

        {/* 磁吸孔信息 */}
        {params.enableBaseHole && (
          <div className="space-y-1.5 text-[11px] font-mono text-muted-foreground/70 bg-[#1c1a16] border border-[#2e2a24] p-2.5">
            <div className="flex justify-between">
              <span>磁铁孔</span>
              <span className="text-foreground/80">⌀{BASE_HOLE_CONFIG.diameter}mm × {BASE_HOLE_CONFIG.depth}mm</span>
            </div>
            <div className="flex justify-between">
              <span>顶壁</span>
              <span className="text-foreground/80">{BASE_HOLE_CONFIG.topWall}mm</span>
            </div>
            <div className="flex justify-between">
              <span>底壁</span>
              <span className="text-foreground/80">{(params.baseThickness - BASE_HOLE_CONFIG.topWall - BASE_HOLE_CONFIG.depth).toFixed(1)}mm</span>
            </div>
          </div>
        )}
      </div>

      {/* 模型尺寸 */}
      <div className={`iron-panel rounded-sm p-4 space-y-3 transition-all duration-300 ${isOversized ? 'border-[#8b1a1a] animate-forge-pulse' : ''}`}>
        <SectionHeader icon={RulerIcon} title="模型尺寸" />

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "宽度", value: dimensions.width, warn: dimensions.width > 260 },
            { label: "深度", value: dimensions.depth, warn: dimensions.depth > 260 },
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
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zM8 12a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
            <span>超过锻造极限 (260×260mm)</span>
          </div>
        )}
      </div>

      {/* Gold trim divider */}
      <div className="wh-divider" />

      {/* 操作按钮 */}
      <div className="flex flex-col gap-2.5 pb-4">
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full h-11 blood-red text-[#f0d8b8] font-bold tracking-wider cursor-pointer transition-all duration-200 border border-[#a02020] shadow-lg shadow-[#8b1a1a30] hover:shadow-xl hover:shadow-[#8b1a1a50] hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-[#8cb880] font-semibold tracking-wider cursor-pointer transition-all duration-200 border border-[#4a6741] shadow-lg shadow-[#2a352830]"
        >
          <Download className="w-4 h-4 mr-2" />
          导出 STL
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          className="w-full h-9 border-[#2e2a24] text-muted-foreground cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e] transition-all duration-200"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-2" />
          <span className="text-sm tracking-wider">重置参数</span>
        </Button>
      </div>
    </div>
  );
}
