"use client";
import type { TrayParams } from "@/types/tray";
import { BASE_PRESETS, PARAM_LIMITS, DEFAULT_PRESET_INDEX } from "@/lib/config";
import { calculateTrayDimensions } from "@/lib/tray-model";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, RotateCcw, Play, Loader2 } from "lucide-react";
import { DEFAULT_TRAY_PARAMS } from "@/lib/config";

interface ParameterPanelProps {
  params: TrayParams;
  updateParam: <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => void;
  setParams: React.Dispatch<React.SetStateAction<TrayParams>>;
  onGenerate: () => void;
  onExportSTL: () => void;
  isGenerating: boolean;
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-zinc-300">{label}</Label>
        <div className="flex items-center gap-1">
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
            className="w-20 h-7 text-right text-sm bg-zinc-800 border-zinc-700 text-zinc-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-zinc-500 w-6">{unit}</span>
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

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-1 custom-scrollbar">
      {/* 布局参数（含底座预设） */}
      <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-zinc-200 tracking-wide uppercase">
            布局
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          {/* 底座预设 */}
          <div className="space-y-1">
            <Label className="text-sm text-zinc-300">底座尺寸</Label>
            <Select
              defaultValue={String(DEFAULT_PRESET_INDEX)}
              onValueChange={handlePresetChange}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                <SelectValue placeholder="选择底座尺寸" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {BASE_PRESETS.map((preset, i) => (
                  <SelectItem
                    key={i}
                    value={String(i)}
                    className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100"
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
        </CardContent>
      </Card>

      {/* 结构参数 */}
      <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-zinc-200 tracking-wide uppercase">
            结构
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <ParamSlider
            label="底板厚度"
            value={params.baseThickness}
            config={PARAM_LIMITS.baseThickness}
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
        </CardContent>
      </Card>

      {/* 尺寸信息 */}
      <Card className={`bg-zinc-900/80 border-zinc-800 backdrop-blur-sm ${isOversized ? 'border-red-600/60' : ''}`}>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-zinc-200 tracking-wide uppercase">
            模型尺寸
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className={`rounded-lg p-2 ${dimensions.width > 260 ? 'bg-red-900/40' : 'bg-zinc-800/60'}`}>
              <p className="text-xs text-zinc-500">宽度</p>
              <p className={`text-sm font-mono ${dimensions.width > 260 ? 'text-red-400' : 'text-zinc-200'}`}>
                {dimensions.width.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-600">mm</p>
            </div>
            <div className={`rounded-lg p-2 ${dimensions.depth > 260 ? 'bg-red-900/40' : 'bg-zinc-800/60'}`}>
              <p className="text-xs text-zinc-500">深度</p>
              <p className={`text-sm font-mono ${dimensions.depth > 260 ? 'text-red-400' : 'text-zinc-200'}`}>
                {dimensions.depth.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-600">mm</p>
            </div>
            <div className="bg-zinc-800/60 rounded-lg p-2">
              <p className="text-xs text-zinc-500">高度</p>
              <p className="text-sm font-mono text-zinc-200">
                {dimensions.height.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-600">mm</p>
            </div>
          </div>
          {isOversized && (
            <p className="text-xs text-red-400 text-center">
              ⚠ 模型尺寸超过打印范围 (260×260mm)
            </p>
          )}
        </CardContent>
      </Card>

      <Separator className="bg-zinc-800" />

      {/* 操作按钮 */}
      <div className="flex flex-col gap-2 pb-4">
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all duration-200 shadow-lg shadow-blue-900/30 disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          {isGenerating ? "生成中..." : "生成模型"}
        </Button>
        <Button
          onClick={onExportSTL}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all duration-200 shadow-lg shadow-emerald-900/30"
        >
          <Download className="w-4 h-4 mr-2" />
          导出 STL
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          重置参数
        </Button>
      </div>
    </div>
  );
}
