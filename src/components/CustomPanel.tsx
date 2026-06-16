"use client";

import type { CustomLayoutParams } from "@/types/custom-tray";
import {
  BASE_PRESETS,
  MAX_BUILD_SIZE,
  SHARED_LAYOUT_LIMITS,
  getBaseHoleMinBaseThickness,
  isOversized as isOversizedFn,
  resolveBaseHolePresetKey,
} from "@/lib/config";
import {
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
import { useState } from "react";
import {
  Plus,
  Wrench,
  BoxSelect,
} from "lucide-react";
import { BaseHoleConfig } from "@/components/BaseHoleConfig";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { StatsCard } from "@/components/StatsCard";
import { IndependentSpacingToggle } from "@/components/IndependentSpacingToggle";
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
  const effectiveWidth = effectiveDimensions.width;
  const effectiveDepth = effectiveDimensions.depth;
  const oversized = isOversizedFn(effectiveWidth, effectiveDepth);
  const [autoPreview, setAutoPreview] = useState(false);
  const largestSlotSize = params.slots.reduce(
    (maxSize, slot) => Math.max(maxSize, slot.width, slot.height),
    0,
  );
  const resolvedBaseHoleSize = resolveBaseHolePresetKey(largestSlotSize);
  const minBaseThickness = getBaseHoleMinBaseThickness(resolvedBaseHoleSize);

  useAutoPreview(params, {
    enabled: autoPreview,
    isGenerating,
    isBlocked: oversized,
    onGenerate: () => onGenerate({ shouldSwitchView: false }),
  });

  const handleReset = () => {
    if (onResetParams) {
      onResetParams();
      return;
    }
    setParams(CUSTOM_LAYOUT_DEFAULTS);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 添加凹槽 — 移动端默认展开 */}
      <div className="iron-panel rounded-sm p-3">
        <SectionHeader icon={BoxSelect} title="添加凹槽" collapsible defaultOpen={true}
          summary={`已有 ${params.slots.length} 个凹槽`}>
          <div className="space-y-2">
            <div className="text-[10px] text-muted-foreground/70 font-bold tracking-wider uppercase mb-0.5">圆形</div>
            <div className="grid grid-cols-3 gap-1.5">
              {BASE_PRESETS.map((preset, i) => (
                <Button
                  key={i}
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
          summary={`槽距${params.spacing}mm / 边距${(params.boundarySpacingIndependent ? params.boundarySpacing : params.spacing)}mm`}>
          <div className="space-y-4">
            <ParamSlider
              label={CUSTOM_LIMITS.spacing.label}
              value={params.spacing}
              config={CUSTOM_LIMITS.spacing}
              onChange={(v) => updateParam("spacing", v)}
              unit={CUSTOM_LIMITS.spacing.unit}
            />
            <IndependentSpacingToggle
              htmlId="custom-boundary-spacing-independent"
              independent={params.boundarySpacingIndependent}
              onIndependentChange={(checked) => updateParam("boundarySpacingIndependent", checked)}
              value={params.boundarySpacing}
              config={CUSTOM_LIMITS.boundarySpacing}
              onValueChange={(v) => updateParam("boundarySpacing", v)}
              sliderLabel={CUSTOM_LIMITS.boundarySpacing.label}
            />
            <ParamSlider
              label={SHARED_LAYOUT_LIMITS.baseThickness.label}
              value={params.baseThickness}
              config={params.enableBaseHole
                ? { ...CUSTOM_LIMITS.baseThickness, min: minBaseThickness }
                : CUSTOM_LIMITS.baseThickness}
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
      <StatsCard
        summary={`${params.slots.length}个凹槽 / ${effectiveWidth.toFixed(0)}×${effectiveDepth.toFixed(0)}mm`}
        slotCount={params.slots.length}
        price={`¥${calculateCustomPrice(params, volume).toFixed(1)}`}
        weightLabel={`估重: ${calculateWeight(volume).toFixed(1)}g`}
        weightVisible={volume > 0}
        weightGeneratingText={isGenerating ? "图纸生成中..." : ""}
        oversized={oversized}
        dimensions={[
          { label: "宽度", value: effectiveWidth, warn: effectiveWidth > MAX_BUILD_SIZE },
          { label: "深度", value: effectiveDepth, warn: effectiveDepth > MAX_BUILD_SIZE },
          { label: "高度", value: dimensions.height, warn: false },
        ]}
      >
        <div className="text-[11px] text-muted-foreground/80 text-center pt-1">
          有效底板尺寸: {effectiveWidth.toFixed(0)} × {effectiveDepth.toFixed(0)} mm
        </div>
      </StatsCard>

      <div className="wh-divider" />

      <PanelActionSection
        autoPreviewId="custom-auto-preview"
        autoPreview={autoPreview}
        onAutoPreviewChange={setAutoPreview}
        onGenerate={() => onGenerate({ shouldSwitchView: true })}
        onExportSTL={onExportSTL}
        onReset={handleReset}
        isGenerating={isGenerating}
        isOversized={oversized}
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
