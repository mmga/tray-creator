"use client";
import type { TrayParams } from "@/types/tray";
import { BASE_HOLE_CONFIG, BASE_PRESETS, MAX_BUILD_SIZE } from "@/lib/config";
import {
  DEFAULT_PRESET_INDEX,
  DEFAULT_TRAY_PARAMS,
  PARAM_CONFIG,
} from "@/lib/grid-config";
import { calculateTrayDimensions } from "@/lib/tray-model";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, RotateCcw, Play, Loader2, Layout, Wrench, Ruler, Share2 } from "lucide-react";
import { BaseHoleConfig } from "@/components/BaseHoleConfig";
import { ParamIOButtons } from "@/components/ParamIOButtons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { exportParams } from "@/lib/param-io";
import { calculateGridPrice, calculateWeight } from "@/lib/pricing";

interface ParameterPanelProps {
  params: TrayParams;
  updateParam: <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => void;
  setParams: React.Dispatch<React.SetStateAction<TrayParams>>;
  onGenerate: (options?: { shouldSwitchView?: boolean }) => void;
  onExportSTL: () => void;
  isGenerating: boolean;
  volume: number;
}

export default function ParameterPanel({
  params,
  updateParam,
  setParams,
  onGenerate,
  onExportSTL,
  isGenerating,
  volume,
}: ParameterPanelProps) {
  const dimensions = calculateTrayDimensions(params);
  const isOversized = dimensions.width > MAX_BUILD_SIZE || dimensions.depth > MAX_BUILD_SIZE;
  const [autoPreview, setAutoPreview] = useState(false);

  // Auto-preview debouncing logic
  useEffect(() => {
    if (!autoPreview || isGenerating || isOversized) return;

    const handler = setTimeout(() => {
      onGenerate({ shouldSwitchView: false });
    }, 500); // 500ms debounce

    return () => clearTimeout(handler);
  }, [params, autoPreview, isGenerating, isOversized, onGenerate]);

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
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 布局参数 — 移动端默认展开 */}
      <div className="iron-panel rounded-sm p-4">
        <SectionHeader icon={Layout} title="布局" collapsible defaultOpen={true}
          summary={`${params.columns}×${params.rows} / ⌀${params.holeDiameter}mm / 槽距${params.spacing}mm / 边距${params.boundarySpacingIndependent ? params.boundarySpacing : params.spacing}mm`}>
          <div className="space-y-4">
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
              label={PARAM_CONFIG.columns.label}
              value={params.columns}
              config={PARAM_CONFIG.columns}
              onChange={(v) => updateParam("columns", v)}
              unit={PARAM_CONFIG.columns.unit}
            />
            <ParamSlider
              label={PARAM_CONFIG.rows.label}
              value={params.rows}
              config={PARAM_CONFIG.rows}
              onChange={(v) => updateParam("rows", v)}
              unit={PARAM_CONFIG.rows.unit}
            />
            <ParamSlider
              label={PARAM_CONFIG.spacing.label}
              value={params.spacing}
              config={PARAM_CONFIG.spacing}
              onChange={(v) => updateParam("spacing", v)}
              unit={PARAM_CONFIG.spacing.unit}
            />
            <div className="flex items-center justify-between p-3 rounded bg-[#1c1a16] border border-[#2e2a24]">
              <Label htmlFor="grid-boundary-spacing-independent" className="text-sm cursor-pointer text-[#f0d8b8]">
                边界间距独立调整
              </Label>
              <Switch
                id="grid-boundary-spacing-independent"
                checked={params.boundarySpacingIndependent}
                onCheckedChange={(checked) => updateParam("boundarySpacingIndependent", checked)}
                className="data-[state=checked]:bg-[#8cb880]"
              />
            </div>
            {params.boundarySpacingIndependent && (
              <ParamSlider
                label={PARAM_CONFIG.boundarySpacing.label}
                value={params.boundarySpacing}
                config={PARAM_CONFIG.boundarySpacing}
                onChange={(v) => updateParam("boundarySpacing", v)}
                unit={PARAM_CONFIG.boundarySpacing.unit}
              />
            )}
          </div>
        </SectionHeader>
      </div>

      {/* 结构参数 — 移动端默认折叠 */}
      <div className="iron-panel rounded-sm p-4">
        <SectionHeader icon={Wrench} title="结构参数" collapsible defaultOpen={false}
          summary={`底厚${params.baseThickness}mm / 孔深${params.holeDepth}mm / 圆角${params.cornerRadius}mm`}>
          <div className="space-y-4">

            <ParamSlider
              label={PARAM_CONFIG.baseThickness.label}
              value={params.baseThickness}
              config={params.enableBaseHole
                ? { ...PARAM_CONFIG.baseThickness, min: BASE_HOLE_CONFIG.minBaseThickness }
                : PARAM_CONFIG.baseThickness}
              onChange={(v) => updateParam("baseThickness", v)}
              unit={PARAM_CONFIG.baseThickness.unit}
            />
            <ParamSlider
              label={PARAM_CONFIG.holeDepth.label}
              value={params.holeDepth}
              config={PARAM_CONFIG.holeDepth}
              onChange={(v) => updateParam("holeDepth", v)}
              unit={PARAM_CONFIG.holeDepth.unit}
            />
            <ParamSlider
              label={PARAM_CONFIG.cornerRadius.label}
              value={params.cornerRadius}
              config={PARAM_CONFIG.cornerRadius}
              onChange={(v) => updateParam("cornerRadius", v)}
              unit={PARAM_CONFIG.cornerRadius.unit}
            />
          </div>
        </SectionHeader>
      </div>

      {/* 底板孔位 — 移动端默认折叠 */}
      <BaseHoleConfig
        enableBaseHole={params.enableBaseHole}
        baseHoleSize={params.baseHoleSize}
        baseThickness={params.baseThickness}
        updateParam={updateParam}
        collapsible
        defaultOpen={false}
      />

      {/* 模型尺寸 — 移动端默认折叠 */}
      <div className={`iron-panel rounded-sm p-4 transition-all duration-300 ${isOversized ? 'border-[#8b1a1a] animate-forge-pulse' : ''}`}>
        <SectionHeader icon={Ruler} title="模型尺寸" collapsible defaultOpen={false}
          summary={`${params.rows * params.columns}个 / ${dimensions.width.toFixed(0)}×${dimensions.depth.toFixed(0)}mm`}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
                <span className="text-[10px] text-muted-foreground block">凹槽数量</span>
                <span className="text-lg font-mono font-bold text-primary">{params.rows * params.columns}</span>
              </div>
              <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
                <span className="text-[10px] text-muted-foreground block">预估报价 & 耗材参考</span>
                <div className="flex flex-col items-center mt-0.5">
                  <span className="text-sm font-mono font-bold text-[#eab308]">
                    ¥{calculateGridPrice(params).toFixed(2)}
                  </span>
                  {volume > 0 ? (
                    <span className="text-[9px] text-muted-foreground">
                      PLA估重: {calculateWeight(volume).toFixed(1)}g
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground">
                      {isGenerating ? "图纸生成中..." : "待锻造"}
                    </span>
                  )}
                </div>
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
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zM8 12a1 1 0 100-2 1 1 0 000 2z" />
                </svg>
                <span>超过锻造极限 ({MAX_BUILD_SIZE}×{MAX_BUILD_SIZE}mm)</span>
              </div>
            )}
          </div>
        </SectionHeader>
      </div>

      {/* Gold trim divider */}
      <div className="wh-divider" />

      {/* 自动预览与操作按钮 */}
      <div className="flex flex-col gap-2.5 pb-4">
        <div className="flex items-center justify-between p-3 rounded bg-[#1c1a16] border border-[#2e2a24]">
          <Label htmlFor="auto-preview" className="text-sm cursor-pointer text-[#f0d8b8]">
            启用自动预览
          </Label>
          <Switch
            id="auto-preview"
            checked={autoPreview}
            onCheckedChange={setAutoPreview}
            className="data-[state=checked]:bg-[#8cb880]"
          />
        </div>

        <Button
          onClick={() => onGenerate({ shouldSwitchView: true })}
          disabled={isGenerating || isOversized}
          className="w-full h-11 blood-red text-sm text-[#f0d8b8] font-bold tracking-wider cursor-pointer transition-all duration-200 border border-[#a02020] shadow-lg shadow-[#8b1a1a30] hover:shadow-xl hover:shadow-[#8b1a1a50] hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          {isGenerating ? "锻造中..." : isOversized ? "尺寸超限" : "开始锻造"}
        </Button>
        <Button
          onClick={onExportSTL}
          className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-sm text-[#8cb880] font-semibold tracking-wider cursor-pointer transition-all duration-200 border border-[#4a6741] shadow-lg shadow-[#2a352830]"
        >
          <Download className="w-4 h-4 mr-2" />
          导出 STL
        </Button>
        <Button
          onClick={() => exportParams("grid", params)}
          className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-sm text-[#8cb880] font-semibold tracking-wider cursor-pointer transition-all duration-200 border border-[#4a6741] shadow-lg shadow-[#2a352830]"
        >
          <Share2 className="w-4 h-4 mr-2" />
          导出参数
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          className="w-full h-11 lg:h-9 text-sm border-[#2e2a24] text-muted-foreground tracking-wider cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e] transition-all duration-200"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          重置参数
        </Button>
        <ParamIOButtons
          mode="grid"
          params={params}
          onImport={(p) => setParams(p as TrayParams)}
        />
      </div>

    </div>
  );
}
