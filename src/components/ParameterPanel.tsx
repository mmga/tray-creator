"use client";
import type { TrayParams } from "@/types/tray";
import {
  BASE_PRESETS,
  MAX_BUILD_SIZE,
  getBaseHoleMinBaseThickness,
  isOversized as isOversizedFn,
  resolveBaseHolePresetKey,
} from "@/lib/config";
import { PARAM_CONFIG } from "@/lib/grid-config";
import {
  calculateTrayDimensions,
  getGridBoundarySpacingAxes,
  getGridSpacingAxes,
} from "@/lib/tray-model";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layout, Wrench, SlidersHorizontal } from "lucide-react";
import { BaseHoleConfig } from "@/components/BaseHoleConfig";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { StatsCard } from "@/components/StatsCard";
import { IndependentSpacingToggle } from "@/components/IndependentSpacingToggle";
import { calculateGridPrice, calculateWeight } from "@/lib/pricing";
import { useAutoPreview } from "@/hooks/useAutoPreview";
import {
  PanelActionSection,
  type PanelDraftActions,
} from "@/components/PanelActionSection";

interface ParameterPanelProps {
  params: TrayParams;
  updateParam: <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => void;
  replaceParams: (next: TrayParams) => void;
  resetParams: () => void;
  onGenerate: (options?: { shouldSwitchView?: boolean }) => void;
  onExportSTL: () => void;
  isGenerating: boolean;
  volume: number;
  draftActions?: PanelDraftActions;
}

export default function ParameterPanel({
  params,
  updateParam,
  replaceParams,
  resetParams,
  onGenerate,
  onExportSTL,
  isGenerating,
  volume,
  draftActions,
}: ParameterPanelProps) {
  const dimensions = calculateTrayDimensions(params);
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  const { boundarySpacingX, boundarySpacingY } =
    getGridBoundarySpacingAxes(params);
  const spacingSummary = params.spacingIndependent
    ? `槽距 X${spacingX}mm / Y${spacingY}mm`
    : `槽距${params.spacing}mm`;
  const boundarySummary = params.boundarySpacingIndependent
    ? `边距${params.boundarySpacing}mm`
    : params.spacingIndependent
      ? `边距 X${boundarySpacingX}mm / Y${boundarySpacingY}mm`
      : `边距${boundarySpacingX}mm`;
  const canUseHalfCircleSlots = params.rows === 1 || params.columns === 1;
  const structureMode = params.basePlateOnly
    ? "base-plate-only"
    : params.halfCircleSlots
      ? "half-circle"
      : "full";
  const structureModeLabel =
    structureMode === "base-plate-only"
      ? "仅内嵌孔底板"
      : structureMode === "half-circle"
        ? "半圆槽"
        : "完整圆槽";
  const oversized = isOversizedFn(dimensions.width, dimensions.depth);
  const [autoPreview, setAutoPreview] = useState(false);
  const selectedPresetIndex = BASE_PRESETS.findIndex(
    (preset) => preset.diameter === params.holeDiameter,
  );
  const selectedPresetValue =
    selectedPresetIndex >= 0 ? String(selectedPresetIndex) : undefined;
  const resolvedBaseHoleSize = resolveBaseHolePresetKey(params.holeDiameter);
  const minBaseThickness = getBaseHoleMinBaseThickness(resolvedBaseHoleSize);

  useAutoPreview(params, {
    enabled: autoPreview,
    isGenerating,
    isBlocked: oversized,
    onGenerate: () => onGenerate({ shouldSwitchView: false }),
  });

  const handlePresetChange = (value: string) => {
    const index = Number.parseInt(value, 10);
    const preset = BASE_PRESETS[index];
    if (preset) {
      updateParam("holeDiameter", preset.diameter);
    }
  };

  const handleReset = () => {
    resetParams();
  };

  const handleStructureModeChange = (
    mode: "full" | "half-circle" | "base-plate-only",
  ) => {
    if (mode === "full") {
      updateParam("halfCircleSlots", false);
      updateParam("basePlateOnly", false);
      return;
    }

    if (mode === "half-circle") {
      if (!canUseHalfCircleSlots) {
        return;
      }
      updateParam("halfCircleSlots", true);
      return;
    }

    updateParam("basePlateOnly", true);
  };



  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 布局参数 — 移动端默认展开 */}
      <div className="iron-panel rounded-sm p-4">
        <SectionHeader icon={Layout} title="布局" collapsible defaultOpen={true}
          summary={`${params.columns}×${params.rows} / ${structureModeLabel} / ⌀${params.holeDiameter}mm / ${spacingSummary} / ${boundarySummary}`}>
          <div className="space-y-4">
            {/* 底座预设 */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">底座尺寸</Label>
              <Select
                value={selectedPresetValue}
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
            <div className="flex items-center justify-between p-3 rounded bg-[#1c1a16] border border-[#2e2a24]">
              <Label htmlFor="grid-spacing-independent" className="text-sm cursor-pointer text-[#f0d8b8]">
                X / Y 间距独立调整
              </Label>
              <Switch
                id="grid-spacing-independent"
                checked={params.spacingIndependent}
                onCheckedChange={(checked) => updateParam("spacingIndependent", checked)}
                className="data-[state=checked]:bg-[#8cb880]"
              />
            </div>
            {params.spacingIndependent ? (
              <>
                <ParamSlider
                  label={PARAM_CONFIG.spacingX.label}
                  value={params.spacingX}
                  config={PARAM_CONFIG.spacingX}
                  onChange={(v) => updateParam("spacingX", v)}
                  unit={PARAM_CONFIG.spacingX.unit}
                />
                <ParamSlider
                  label={PARAM_CONFIG.spacingY.label}
                  value={params.spacingY}
                  config={PARAM_CONFIG.spacingY}
                  onChange={(v) => updateParam("spacingY", v)}
                  unit={PARAM_CONFIG.spacingY.unit}
                />
              </>
            ) : (
              <ParamSlider
                label={PARAM_CONFIG.spacing.label}
                value={params.spacing}
                config={PARAM_CONFIG.spacing}
                onChange={(v) => updateParam("spacing", v)}
                unit={PARAM_CONFIG.spacing.unit}
              />
            )}
            <IndependentSpacingToggle
              htmlId="grid-boundary-spacing-independent"
              independent={params.boundarySpacingIndependent}
              onIndependentChange={(checked) => updateParam("boundarySpacingIndependent", checked)}
              value={params.boundarySpacing}
              config={PARAM_CONFIG.boundarySpacing}
              onValueChange={(v) => updateParam("boundarySpacing", v)}
              sliderLabel={PARAM_CONFIG.boundarySpacing.label}
            />
          </div>
        </SectionHeader>
      </div>

      {/* 高级设置 — 结构模式互斥选择 */}
      <div className="iron-panel rounded-sm p-4">
        <SectionHeader icon={SlidersHorizontal} title="高级设置" collapsible defaultOpen={false}
          summary={`结构模式：${structureModeLabel}`}>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">结构模式</Label>
            <div className="grid grid-cols-3 gap-1 rounded-sm border border-[#2e2a24] bg-[#1c1a16] p-1">
              {[
                { mode: "full" as const, label: "完整圆槽", disabled: false },
                { mode: "half-circle" as const, label: "半圆槽", disabled: !canUseHalfCircleSlots },
                { mode: "base-plate-only" as const, label: "仅内嵌孔底板", disabled: false },
              ].map(({ mode, label, disabled }) => {
                const active = structureMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() => handleStructureModeChange(mode)}
                    className={`min-h-9 px-2 text-xs font-semibold transition-colors ${active
                      ? "bg-[#8cb880] text-[#11140f]"
                      : "text-[#d8d1c5] hover:bg-[#252119] disabled:cursor-not-allowed disabled:opacity-35"
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
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
                ? { ...PARAM_CONFIG.baseThickness, min: minBaseThickness }
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
      <BaseHoleConfig<TrayParams>
        enableBaseHole={params.enableBaseHole}
        baseThickness={params.baseThickness}
        resolvedBaseHoleSize={resolvedBaseHoleSize}
        updateParam={updateParam}
        collapsible
        defaultOpen={false}
      />

      {/* 模型尺寸 — 移动端默认折叠 */}
      <StatsCard
        title="模型尺寸"
        summary={`${params.rows * params.columns}个 / ${dimensions.width.toFixed(0)}×${dimensions.depth.toFixed(0)}mm`}
        slotCount={params.rows * params.columns}
        price={`¥${calculateGridPrice(params).toFixed(2)}`}
        weightLabel={`PLA估重: ${calculateWeight(volume).toFixed(1)}g`}
        weightVisible={volume > 0}
        weightGeneratingText={isGenerating ? "图纸生成中..." : "待锻造"}
        oversized={oversized}
        dimensions={[
          { label: "宽度", value: dimensions.width, warn: dimensions.width > MAX_BUILD_SIZE },
          { label: "深度", value: dimensions.depth, warn: dimensions.depth > MAX_BUILD_SIZE },
          { label: "高度", value: dimensions.height, warn: false },
        ]}
      />

      {/* Gold trim divider */}
      <div className="wh-divider" />

      <PanelActionSection
        autoPreviewId="auto-preview"
        autoPreview={autoPreview}
        onAutoPreviewChange={setAutoPreview}
        onGenerate={() => onGenerate({ shouldSwitchView: true })}
        onExportSTL={onExportSTL}
        onReset={handleReset}
        isGenerating={isGenerating}
        isOversized={oversized}
        mode="grid"
        params={params}
        onImport={(p) => replaceParams(p as TrayParams)}
        draftActions={draftActions}
      />

    </div>
  );
}
