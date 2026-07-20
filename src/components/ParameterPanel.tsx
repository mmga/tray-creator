"use client";
import type { TrayParams } from "@/types/tray";
import { BASE_PRESETS } from "@/lib/config";
import {
  OLD_WORLD_RECTANGULAR_PRESETS,
  getGridSlotGeometry,
  isRectangularGridSlot,
  resolveGridBaseHolePresetKey,
} from "@/lib/grid-config";
import { selectGridSlotDefinition } from "@/lib/grid-model-state";
import { PARAM_CONFIG } from "@/lib/grid-config";
import {
  getGridBoundarySpacingAxes,
  getGridSpacingAxes,
} from "@/lib/tray-model";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layout, SlidersHorizontal, Wrench } from "lucide-react";
import { BaseHoleConfig } from "@/components/BaseHoleConfig";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { PanelShell } from "@/components/PanelShell";
import { TrayResultSummary } from "@/components/TrayResultSummary";
import { projectGridTrayResult } from "@/lib/tray-result-projection";
import type { BaseHoleFitViolation } from "@/lib/base-hole-rules";

interface ParameterPanelProps {
  params: TrayParams;
  updateParam: <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => void;
  replaceParams: (next: TrayParams) => void;
  actions: ReactNode;
  isGenerating: boolean;
  isPreviewStale: boolean;
  volume: number;
  baseHoleFitViolations?: BaseHoleFitViolation[];
}

export default function ParameterPanel({
  params,
  updateParam,
  replaceParams,
  actions,
  isGenerating,
  isPreviewStale,
  volume,
  baseHoleFitViolations = [],
}: ParameterPanelProps) {
  const slotGeometry = getGridSlotGeometry(params);
  const isRectangularSlot = isRectangularGridSlot(params);
  const result = projectGridTrayResult(params, {
    volume,
    isGenerating,
    isPreviewStale,
  });
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  const { boundarySpacingX, boundarySpacingY } =
    getGridBoundarySpacingAxes(params);
  const spacingSummary = params.spacingIndependent
    ? `${isRectangularSlot ? "底盘距" : "槽距"} X${spacingX}mm / Y${spacingY}mm`
    : `${isRectangularSlot ? "底盘距" : "槽距"}${params.spacing}mm`;
  const spacingLabel = isRectangularSlot ? "底盘间距" : PARAM_CONFIG.spacing.label;
  const spacingXLabel = isRectangularSlot
    ? "X 轴底盘间距"
    : PARAM_CONFIG.spacingX.label;
  const spacingYLabel = isRectangularSlot
    ? "Y 轴底盘间距"
    : PARAM_CONFIG.spacingY.label;
  const boundarySummary = params.boundarySpacingIndependent
    ? `边距${params.boundarySpacing}mm`
    : params.spacingIndependent
      ? `边距 X${boundarySpacingX}mm / Y${boundarySpacingY}mm`
      : `边距${boundarySpacingX}mm`;
  const canUseHalfCircleSlots =
    !isRectangularSlot && (params.rows === 1 || params.columns === 1);
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
        : isRectangularSlot
          ? "完整矩形槽"
          : "完整圆槽";
  const selectedPresetValue = isRectangularSlot
    ? params.slotDefinitionId
    : BASE_PRESETS.some((preset) => preset.diameter === params.holeDiameter)
      ? `circle-${params.holeDiameter}`
      : undefined;
  const resolvedBaseHoleSize = resolveGridBaseHolePresetKey(params);

  const handlePresetChange = (value: string) => {
    replaceParams(selectGridSlotDefinition(params, value));
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
    <PanelShell
      summary={<TrayResultSummary result={result} />}
      actions={actions}
    >
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 布局参数 — 移动端默认展开 */}
      <div className="iron-panel rounded-sm p-4">
        <SectionHeader icon={Layout} title="布局" collapsible defaultOpen={true}
          summary={`${params.columns}×${params.rows} / ${structureModeLabel} / ${isRectangularSlot ? `${slotGeometry.baseWidth}×${slotGeometry.baseHeight}mm` : `⌀${params.holeDiameter}mm`} / ${spacingSummary} / ${boundarySummary}`}>
          <div className="space-y-4">
            {/* 底座预设 */}
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">底座规格</Label>
              <Select
                value={selectedPresetValue}
                onValueChange={handlePresetChange}
              >
                <SelectTrigger className="bg-[#1c1a16] border-[#2e2a24] text-foreground hover:border-primary/40 cursor-pointer transition-all duration-200">
                  <SelectValue placeholder="选择底座规格" />
                </SelectTrigger>
                <SelectContent className="bg-[#16140f] border-[#2e2a24]">
                  <SelectGroup>
                    <SelectLabel className="font-semibold tracking-wide text-[#b9ad9d]">
                      圆形底盘
                    </SelectLabel>
                    {BASE_PRESETS.map((preset) => (
                      <SelectItem
                        key={preset.diameter}
                        value={`circle-${preset.diameter}`}
                        className="text-foreground/90 cursor-pointer focus:bg-primary/10 focus:text-primary"
                      >
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator className="bg-[#3a342b]" />
                  <SelectGroup>
                    <SelectLabel className="font-semibold tracking-wide text-[#d6a84f]">
                      旧世界方形/矩形底盘
                    </SelectLabel>
                    {OLD_WORLD_RECTANGULAR_PRESETS.map((preset) => (
                      <SelectItem
                        key={preset.id}
                        value={preset.id}
                        className="text-foreground/90 cursor-pointer focus:bg-primary/10 focus:text-primary"
                      >
                        {preset.width}×{preset.height}mm
                      </SelectItem>
                    ))}
                  </SelectGroup>
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
                  label={spacingXLabel}
                  value={params.spacingX}
                  config={PARAM_CONFIG.spacingX}
                  onChange={(v) => updateParam("spacingX", v)}
                  unit={PARAM_CONFIG.spacingX.unit}
                />
                <ParamSlider
                  label={spacingYLabel}
                  value={params.spacingY}
                  config={PARAM_CONFIG.spacingY}
                  onChange={(v) => updateParam("spacingY", v)}
                  unit={PARAM_CONFIG.spacingY.unit}
                />
              </>
            ) : (
              <ParamSlider
                label={spacingLabel}
                value={params.spacing}
                config={PARAM_CONFIG.spacing}
                onChange={(v) => updateParam("spacing", v)}
                unit={PARAM_CONFIG.spacing.unit}
              />
            )}
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

      {/* 高级设置 — 结构模式互斥选择 */}
      <div className="iron-panel rounded-sm p-4">
        <SectionHeader icon={SlidersHorizontal} title="高级设置" collapsible defaultOpen={false}
          summary={`结构模式：${structureModeLabel}`}>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">结构模式</Label>
            <div className={`grid ${isRectangularSlot ? "grid-cols-2" : "grid-cols-3"} gap-1 rounded-sm border border-[#2e2a24] bg-[#1c1a16] p-1`}>
              {[
                { mode: "full" as const, label: isRectangularSlot ? "完整矩形槽" : "完整圆槽", disabled: false },
                ...(!isRectangularSlot
                  ? [{ mode: "half-circle" as const, label: "半圆槽", disabled: !canUseHalfCircleSlots }]
                  : []),
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
        <SectionHeader icon={Wrench} title="制造结构" collapsible defaultOpen={false}
          summary={`底厚${params.baseThickness}mm / 孔深${params.holeDepth}mm / 圆角${params.cornerRadius}mm / 斜面${params.sideBevelWidth}mm`}>
          <div className="space-y-4">

            <ParamSlider
              label={PARAM_CONFIG.baseThickness.label}
              value={params.baseThickness}
              config={PARAM_CONFIG.baseThickness}
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
            <ParamSlider
              label={PARAM_CONFIG.sideBevelWidth.label}
              value={params.sideBevelWidth}
              config={PARAM_CONFIG.sideBevelWidth}
              onChange={(v) => updateParam("sideBevelWidth", v)}
              unit={PARAM_CONFIG.sideBevelWidth.unit}
            />
          </div>
        </SectionHeader>
      </div>

      {/* 底板孔位 — 移动端默认折叠 */}
      <BaseHoleConfig<TrayParams>
        baseHoleStructure={params.baseHoleStructure}
        magnetPostHoleDiameter={params.magnetPostHoleDiameter}
        magnetPostHoleDepth={params.magnetPostHoleDepth}
        supportingThickness={params.baseThickness}
        resolvedBaseHoleSizes={[resolvedBaseHoleSize]}
        fitViolations={baseHoleFitViolations}
        updateParam={updateParam}
        collapsible
        defaultOpen={false}
      />

    </div>
    </PanelShell>
  );
}
