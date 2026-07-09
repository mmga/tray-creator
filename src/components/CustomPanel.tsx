"use client";

import type { CustomLayoutParams } from "@/types/custom-tray";
import {
  MAX_BUILD_SIZE,
  SHARED_LAYOUT_LIMITS,
  resolveBaseHolePresetKey,
} from "@/lib/config";
import {
  CUSTOM_BASE_PRESETS,
  CUSTOM_LAYOUT_DEFAULTS,
  CUSTOM_LIMITS,
  ELLIPSE_PRESETS,
  type EllipsePreset,
} from "@/lib/custom-config";
import { calculateCustomTrayDimensions } from "@/lib/custom-tray-model";
import type { EllipseSlotConfig } from "@/lib/custom-layout-actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Plus,
  Wrench,
  Ruler,
  BoxSelect,
} from "lucide-react";
import { BaseHoleConfig } from "@/components/BaseHoleConfig";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { calculateWeight, calculateCustomPrice } from "@/lib/pricing";
import { useAutoPreview } from "@/hooks/useAutoPreview";
import {
  PanelActionSection,
  type PanelDraftActions,
} from "@/components/PanelActionSection";

// ── Props ──────────────────────────────

interface CustomPanelProps {
  params: CustomLayoutParams;
  effectiveDimensions: { width: number; depth: number };
  updateParam: <K extends keyof CustomLayoutParams>(key: K, value: CustomLayoutParams[K]) => void;
  setParams: React.Dispatch<React.SetStateAction<CustomLayoutParams>>;
  onResetParams?: () => void;
  onImportParams?: (params: CustomLayoutParams) => void;
  onAddSlot: (width: number, height?: number, ellipseConfig?: EllipseSlotConfig) => void;
  onGenerate: (options?: { shouldSwitchView?: boolean }) => void;
  onExportSTL: () => void;
  isGenerating: boolean;
  volume: number;
  draftActions?: PanelDraftActions;
}

function getEllipseSlotConfig(preset: EllipsePreset): EllipseSlotConfig {
  return {
    slotDefinitionId: preset.id,
    outerOffset: preset.outerOffset,
    profileExponent: preset.profileExponent,
  };
}

export default function CustomPanel({
  params,
  effectiveDimensions,
  updateParam,
  setParams,
  onResetParams,
  onImportParams,
  onAddSlot,
  onGenerate,
  onExportSTL,
  isGenerating,
  volume,
  draftActions,
}: CustomPanelProps) {
  const dimensions = calculateCustomTrayDimensions(params);
  const displayLength =
    effectiveDimensions.width > 0 ? effectiveDimensions.width : params.trayWidth;
  const displayWidth =
    effectiveDimensions.depth > 0 ? effectiveDimensions.depth : params.trayDepth;
  const isOversized =
    displayLength > MAX_BUILD_SIZE || displayWidth > MAX_BUILD_SIZE;
  const [autoPreview, setAutoPreview] = useState(false);
  const [customCircleDiameter, setCustomCircleDiameter] = useState(10);
  const largestSlotSize = params.slots.reduce(
    (maxSize, slot) => Math.max(maxSize, slot.width, slot.height),
    0,
  );
  const resolvedBaseHoleSize = resolveBaseHolePresetKey(largestSlotSize);

  useAutoPreview(params, {
    enabled: autoPreview,
    isGenerating,
    isBlocked: false,
    onGenerate: () => onGenerate({ shouldSwitchView: false }),
  });

  const handleReset = () => {
    if (onResetParams) {
      onResetParams();
      return;
    }
    setParams(CUSTOM_LAYOUT_DEFAULTS);
  };
  const handleAddCustomCircleSlot = () => {
    if (!Number.isFinite(customCircleDiameter) || customCircleDiameter <= 0) {
      return;
    }
    onAddSlot(customCircleDiameter);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 添加凹槽 — 移动端默认展开 */}
      <div className="iron-panel rounded-sm p-3">
        <SectionHeader icon={BoxSelect} title="添加凹槽" collapsible defaultOpen={true}
          summary={`已有 ${params.slots.length} 个凹槽`}>
          <div className="space-y-2">
            <div className="text-[10px] text-muted-foreground/70 font-bold tracking-wider uppercase mb-0.5">圆形</div>
            <div className="flex items-end gap-2 rounded-sm border border-[#2e2a24] bg-[#1c1a16] p-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="custom-circle-diameter" className="text-xs text-muted-foreground">
                  自定义直径
                </Label>
                <Input
                  id="custom-circle-diameter"
                  type="number"
                  min={1}
                  max={200}
                  step={0.1}
                  value={customCircleDiameter}
                  onChange={(event) =>
                    setCustomCircleDiameter(Number(event.target.value))
                  }
                  className="h-9 border-[#2e2a24] bg-[#120f0c] font-mono text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomCircleSlot}
                className="h-9 shrink-0 border-[#2e2a24] bg-[#120f0c] px-3 text-xs hover:bg-[#2e2a24] hover:text-primary"
              >
                <Plus className="w-3 h-3 mr-1" />
                添加
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {CUSTOM_BASE_PRESETS.map((preset) => (
                <Button
                  key={preset.diameter}
                  variant="outline"
                  size="sm"
                  onClick={() => onAddSlot(preset.diameter)}
                  className="h-10 lg:h-7 text-xs lg:text-[11px] border-[#2e2a24] bg-[#1c1a16] hover:bg-[#2e2a24] hover:text-primary transition-all"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {preset.diameter}
                </Button>
              ))}
            </div>

            <div className="text-[10px] text-muted-foreground/70 font-bold tracking-wider uppercase mb-0.5 mt-1.5">椭圆</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ELLIPSE_PRESETS.map((preset, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onAddSlot(
                      preset.width,
                      preset.height,
                      getEllipseSlotConfig(preset),
                    )
                  }
                  className="h-10 lg:h-7 text-xs lg:text-[11px] border-[#2e2a24] bg-[#1c1a16] hover:bg-[#2e2a24] hover:text-primary transition-all"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {preset.name.replace('mm', '')}
                </Button>
              ))}
            </div>
          </div>
        </SectionHeader>
      </div>

      {/* 结构参数 — 移动端默认折叠 */}
      <div className="iron-panel rounded-sm p-4">
        <SectionHeader icon={Wrench} title="结构参数" collapsible defaultOpen={false}
          summary={`槽距${params.spacing}mm / 边距${(params.boundarySpacingIndependent ? params.boundarySpacing : params.spacing)}mm / 斜面${params.sideBevelWidth}mm`}>
          <div className="space-y-4">
            <ParamSlider
              label={CUSTOM_LIMITS.spacing.label}
              value={params.spacing}
              config={CUSTOM_LIMITS.spacing}
              onChange={(v) => updateParam("spacing", v)}
              unit={CUSTOM_LIMITS.spacing.unit}
            />
            <div className="flex items-center justify-between p-3 rounded bg-[#1c1a16] border border-[#2e2a24]">
              <Label htmlFor="custom-boundary-spacing-independent" className="text-sm cursor-pointer text-[#f0d8b8]">
                边界间距独立调整
              </Label>
              <Switch
                id="custom-boundary-spacing-independent"
                checked={params.boundarySpacingIndependent}
                onCheckedChange={(checked) => updateParam("boundarySpacingIndependent", checked)}
                className="data-[state=checked]:bg-[#8cb880]"
              />
            </div>
            {params.boundarySpacingIndependent && (
              <ParamSlider
                label={CUSTOM_LIMITS.boundarySpacing.label}
                value={params.boundarySpacing}
                config={CUSTOM_LIMITS.boundarySpacing}
                onChange={(v) => updateParam("boundarySpacing", v)}
                unit={CUSTOM_LIMITS.boundarySpacing.unit}
              />
            )}
            <ParamSlider
              label={SHARED_LAYOUT_LIMITS.baseThickness.label}
              value={params.baseThickness}
              config={CUSTOM_LIMITS.baseThickness}
              onChange={(v) => updateParam("baseThickness", v)}
              unit={SHARED_LAYOUT_LIMITS.baseThickness.unit}
            />
            <ParamSlider
              label={SHARED_LAYOUT_LIMITS.holeDepth.label}
              value={params.holeDepth}
              config={CUSTOM_LIMITS.holeDepth}
              onChange={(v) => updateParam("holeDepth", v)}
              unit={SHARED_LAYOUT_LIMITS.holeDepth.unit}
            />
            <ParamSlider
              label={SHARED_LAYOUT_LIMITS.cornerRadius.label}
              value={params.cornerRadius}
              config={CUSTOM_LIMITS.cornerRadius}
              onChange={(v) => updateParam("cornerRadius", v)}
              unit={SHARED_LAYOUT_LIMITS.cornerRadius.unit}
            />
            <ParamSlider
              label={SHARED_LAYOUT_LIMITS.sideBevelWidth.label}
              value={params.sideBevelWidth}
              config={CUSTOM_LIMITS.sideBevelWidth}
              onChange={(v) => updateParam("sideBevelWidth", v)}
              unit={SHARED_LAYOUT_LIMITS.sideBevelWidth.unit}
            />
          </div>
        </SectionHeader>
      </div>

      {/* 底板孔位 — 移动端默认折叠 */}
      <BaseHoleConfig<CustomLayoutParams>
        enableBaseHole={params.enableBaseHole}
        baseThickness={params.baseThickness}
        resolvedBaseHoleSize={resolvedBaseHoleSize}
        updateParam={updateParam}
        collapsible
        defaultOpen={false}
      />

      {/* 统计信息 — 移动端默认折叠 */}
      <div className={`iron-panel rounded-sm p-4 transition-all duration-300 ${isOversized ? 'border-[#8b1a1a] animate-forge-pulse' : ''}`}>
        <SectionHeader icon={Ruler} title="统计信息" collapsible defaultOpen={false}
          summary={`${params.slots.length}个凹槽 / ${displayLength.toFixed(1)}×${displayWidth.toFixed(1)}mm`}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
                <span className="text-[10px] text-muted-foreground block">凹槽数量</span>
                <span className="text-lg font-mono font-bold text-primary">{params.slots.length}</span>
              </div>
              <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
                <span className="text-[10px] text-muted-foreground block">预估报价 & 耗材参考</span>
                <div className="flex flex-col items-center mt-0.5">
                  <span className="text-sm font-mono font-bold text-[#eab308]">
                    ¥{calculateCustomPrice(params, volume).toFixed(1)}
                  </span>
                  {volume > 0 ? (
                    <span className="text-[9px] text-muted-foreground">
                      估重: {calculateWeight(volume).toFixed(1)}g
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground">
                      {isGenerating ? "图纸生成中..." : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "长度", value: displayLength, warn: displayLength > MAX_BUILD_SIZE },
                { label: "宽度", value: displayWidth, warn: displayWidth > MAX_BUILD_SIZE },
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
                <span>超过常规打印尺寸，仍可继续建模</span>
              </div>
            )}
            <div className="text-[11px] text-muted-foreground/80 text-center pt-1">
              上沿尺寸: {displayLength.toFixed(1)} × {displayWidth.toFixed(1)} mm
            </div>
          </div>
        </SectionHeader>
      </div>

      <div className="wh-divider" />

      <PanelActionSection
        autoPreviewId="custom-auto-preview"
        autoPreview={autoPreview}
        onAutoPreviewChange={setAutoPreview}
        onGenerate={() => onGenerate({ shouldSwitchView: true })}
        onExportSTL={onExportSTL}
        onReset={handleReset}
        isGenerating={isGenerating}
        isOversized={isOversized}
        mode="custom"
        params={params}
        onImport={(p) => {
          const nextParams = p as CustomLayoutParams;
          if (onImportParams) {
            onImportParams(nextParams);
            return;
          }
          setParams(nextParams);
        }}
        draftActions={draftActions}
      />
    </div>
  );
}
