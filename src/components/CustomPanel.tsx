"use client";

import type { CustomBaseplateFootprintStyle, CustomLayoutParams } from "@/types/custom-tray";
import {
  SHARED_LAYOUT_LIMITS,
} from "@/lib/config";
import {
  CUSTOM_BASE_PRESETS,
  CUSTOM_LIMITS,
  ELLIPSE_PRESETS,
  type EllipsePreset,
} from "@/lib/custom-config";
import type {
  CircleSlotConfig,
  EllipseSlotConfig,
} from "@/lib/custom-layout-actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DraftNumberInput } from "@/components/ui/DraftNumberInput";
import { useMemo, useState, type ReactNode } from "react";
import {
  Plus,
  Wrench,
  Ruler,
  BoxSelect,
} from "lucide-react";
import { BaseHoleConfig } from "@/components/BaseHoleConfig";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { PanelShell } from "@/components/PanelShell";
import { TrayResultSummary } from "@/components/TrayResultSummary";
import { StackableBoxConfig } from "@/components/StackableBoxConfig";
import { projectCustomTrayResult } from "@/lib/tray-result-projection";
import {
  validateCustomBox,
} from "@/lib/custom-layout-math";
import {
  calculateBoxHeightProjection,
  calculateBoxUsableOpening,
  resolveStackableBoxParams,
} from "@/lib/stackable-box";
import {
  type BaseHoleFitViolation,
} from "@/lib/base-hole-construction-plan";
import { createCustomBaseHoleConstructionPlan } from "@/lib/base-hole-planning";
import type { BaseHoleConstructionPlan } from "@/lib/base-hole-construction-plan";
import type {
  ConstructedContouredFootprint,
} from "@/lib/contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import { useToast } from "@/hooks/useToast";

// ── Props ──────────────────────────────

interface CustomPanelProps {
  params: CustomLayoutParams;
  effectiveDimensions: { width: number; depth: number };
  updateParam: <K extends keyof CustomLayoutParams>(key: K, value: CustomLayoutParams[K]) => void;
  actions: ReactNode;
  onAddSlot: (
    width: number,
    height?: number,
    ellipseConfig?: EllipseSlotConfig,
    circleConfig?: CircleSlotConfig,
  ) => void;
  isGenerating: boolean;
  isPreviewStale: boolean;
  volume: number;
  bodyVolume?: number;
  lidVolume?: number;
  contouredFootprintState?: ContouredFootprintState<ConstructedContouredFootprint>;
  baseHoleFitViolations?: readonly BaseHoleFitViolation[];
  baseHolePlan?: BaseHoleConstructionPlan;
  selectedSlotIds?: string[];
  onExpandBoxToFit?: () => void;
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
  actions,
  onAddSlot,
  isGenerating,
  isPreviewStale,
  volume,
  bodyVolume,
  lidVolume,
  contouredFootprintState = { status: "inactive" },
  baseHoleFitViolations = [],
  baseHolePlan: authoritativeBaseHolePlan,
  selectedSlotIds = [],
  onExpandBoxToFit,
}: CustomPanelProps) {
  const { toast } = useToast();
  const result = projectCustomTrayResult(params, effectiveDimensions, {
    volume,
    bodyVolume,
    lidVolume,
    isGenerating,
    isPreviewStale,
  }, contouredFootprintState);
  const box = resolveStackableBoxParams(params.stackableBox);
  const boxValidation = validateCustomBox(params);
  const boxOpening = calculateBoxUsableOpening(box);
  const boxHeight = calculateBoxHeightProjection(
    box,
    params.baseThickness,
    params.holeDepth,
    false,
  );
  const isContouredFootprint = result.footprintStyle === "contoured";
  const isPolygonalFootprint = result.footprintStyle === "polygonal";
  const isRectangularFootprint = result.footprintStyle === "rectangular";
  const footprintLabel = isPolygonalFootprint ? "直边包络" : "贴合轮廓";
  const isFixedTraySize = isRectangularFootprint && params.traySizingMode === "fixed";
  const [customCircleDiameter, setCustomCircleDiameter] = useState(10);
  const baseHolePlan = useMemo(
    () => authoritativeBaseHolePlan ?? createCustomBaseHoleConstructionPlan(params, {
      contouredState: contouredFootprintState,
    }),
    [authoritativeBaseHolePlan, contouredFootprintState, params],
  );
  const resolvedBaseHoleSizes = baseHolePlan.resolvedMagneticPresets;
  const selectedSlot = params.slots.find((slot) => slot.id === selectedSlotIds[0]);
  const selectedInstruction = selectedSlot
    ? baseHolePlan.instructions.find((instruction) =>
        instruction.slotId === selectedSlot.id &&
        instruction.kind === "magnetic-base-hole"
      )
    : undefined;
  const selectedSlotMatch = selectedSlot &&
      selectedInstruction?.kind === "magnetic-base-hole"
    ? {
        label: `槽位 ${params.slots.indexOf(selectedSlot) + 1}`,
        presetKey: selectedInstruction.preset,
      }
    : null;

  const handleAddCustomCircleSlot = () => {
    if (!Number.isFinite(customCircleDiameter) || customCircleDiameter <= 0) {
      return;
    }
    onAddSlot(
      customCircleDiameter,
      undefined,
      undefined,
      { applyTolerance: false },
    );
  };
  return (
    <PanelShell summary={<TrayResultSummary result={result} />} actions={actions}>
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 堆叠盒体结构（仅矩形外轮廓） */}
      {isRectangularFootprint ? (
        <StackableBoxConfig
          box={box}
          onChange={(nextBox) => updateParam("stackableBox", nextBox)}
          validation={boxValidation}
          usableWidth={boxOpening.usableWidth}
          usableDepth={boxOpening.usableDepth}
          lidClearHeight={boxHeight.lidClearHeight}
          stackClearHeight={boxHeight.stackClearHeight}
          onExpandToFit={onExpandBoxToFit}
        />
      ) : null}

      {/* 布局编辑 */}
      <div className="iron-panel rounded-sm p-3">
        <SectionHeader icon={BoxSelect} title="布局编辑" collapsible defaultOpen={true}
          summary={`已有 ${params.slots.length} 个凹槽`}>
          <div className="space-y-2">
            <div className="text-[10px] text-muted-foreground/70 font-bold tracking-wider uppercase mb-0.5">圆形</div>
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
            <div className="flex items-center gap-2 rounded-sm border border-[#2e2a24] bg-[#1c1a16] p-2">
              <Label
                htmlFor="custom-circle-diameter"
                className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
              >
                自定义直径
              </Label>
              <DraftNumberInput
                id="custom-circle-diameter"
                min={1}
                max={200}
                step={0.1}
                value={customCircleDiameter}
                onValueChange={setCustomCircleDiameter}
                className="h-9 min-w-0 flex-1 border-[#2e2a24] bg-[#120f0c] font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomCircleSlot}
                className="h-9 shrink-0 border-[#2e2a24] bg-[#120f0c] px-3 text-xs hover:bg-[#2e2a24] hover:text-primary"
              >
                <Plus className="mr-1 h-3 w-3" />
                添加
              </Button>
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

      {/* 托盘边界 */}
      <div className="iron-panel rounded-sm p-4">
        <SectionHeader
          icon={Ruler}
          title="托盘尺寸"
          collapsible
          defaultOpen={true}
          summary={
            !isRectangularFootprint
              ? `${footprintLabel}，随凹槽外缘自动变化`
              : isFixedTraySize
                ? "固定外尺寸"
                : "自动适配凹槽布局"
          }
        >
          <div className="space-y-4">
            {isRectangularFootprint && (
              <div className="flex items-center justify-between p-3 rounded bg-[#1c1a16] border border-[#2e2a24]">
                <div className="space-y-0.5">
                  <Label htmlFor="custom-fixed-tray-size" className="text-sm cursor-pointer text-[#f0d8b8]">
                    固定托盘大小
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {isFixedTraySize
                      ? "外尺寸固定，凹槽可在内部自由排版"
                      : "托盘外形随凹槽位置与边界间距自动变化"}
                  </p>
                </div>
                <Switch
                  id="custom-fixed-tray-size"
                  aria-label="custom-fixed-tray-size"
                  checked={isFixedTraySize}
                  onCheckedChange={(checked) =>
                    updateParam("traySizingMode", checked ? "fixed" : "auto")
                  }
                  className="data-[state=checked]:bg-[#8cb880]"
                />
              </div>
            )}
            {!isRectangularFootprint && (
              <div className="p-3 rounded bg-[#1c1a16] border border-[#2e2a24] text-[11px] text-muted-foreground">
                {footprintLabel}模式下，托盘外缘由凹槽位置与边界间距自动派生；
                {isPolygonalFootprint
                  ? "固定尺寸与侧面斜角设置已保留，切回矩形包络后恢复。"
                  : "固定尺寸、圆角、侧面斜角设置已保留，切回矩形包络后恢复。"}
              </div>
            )}
            {isFixedTraySize && (
              <div className="space-y-4">
                <ParamSlider
                  label={CUSTOM_LIMITS.trayWidth.label}
                  value={params.trayWidth}
                  config={CUSTOM_LIMITS.trayWidth}
                  onChange={(value) => updateParam("trayWidth", value)}
                  unit={CUSTOM_LIMITS.trayWidth.unit}
                />
                <ParamSlider
                  label={CUSTOM_LIMITS.trayDepth.label}
                  value={params.trayDepth}
                  config={CUSTOM_LIMITS.trayDepth}
                  onChange={(value) => updateParam("trayDepth", value)}
                  unit={CUSTOM_LIMITS.trayDepth.unit}
                />
              </div>
            )}
          </div>
        </SectionHeader>
      </div>

      {/* 结构参数 — 移动端默认折叠 */}
      <div className="iron-panel rounded-sm p-4">
        <SectionHeader icon={Wrench} title="制造结构" collapsible defaultOpen={false}
          summary={`槽距${params.spacing}mm / 边距${(params.boundarySpacingIndependent ? params.boundarySpacing : params.spacing)}mm / ${isRectangularFootprint ? `斜面${params.sideBevelWidth}mm` : footprintLabel}`}>
          <div className="space-y-4">
            <div className="space-y-2 p-3 rounded bg-[#1c1a16] border border-[#2e2a24]">
              <div className="space-y-0.5">
                <Label htmlFor="custom-footprint-style" className="text-sm cursor-pointer text-[#f0d8b8]">
                  底座轮廓样式
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {isPolygonalFootprint
                    ? "自动直边外包，凹口填平，生成一整块；顶点可设圆弧过渡"
                    : isContouredFootprint
                      ? "贴合凹槽外缘；远距凹槽可形成多个独立实体"
                      : "矩形包络底座；可配置圆角与侧面斜角"}
                </p>
              </div>
              <Select
                value={result.footprintStyle}
                onValueChange={(value) => {
                  if (value !== "rectangular" && box.enabled) {
                    toast("info", `${value === "polygonal" ? "直边包络" : "贴合轮廓"}不支持堆叠盒体，已自动关闭盒体结构`);
                  }
                  updateParam("footprintStyle", value as CustomBaseplateFootprintStyle);
                }}
              >
                <SelectTrigger id="custom-footprint-style" aria-label="底座轮廓样式" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rectangular">矩形包络</SelectItem>
                  <SelectItem value="contoured">弧形贴合</SelectItem>
                  <SelectItem value="polygonal">直边包络</SelectItem>
                </SelectContent>
              </Select>
              {isPolygonalFootprint && (
                <p className="text-xs text-[#f0d8b8]" aria-live="polite">
                  当前外形：{result.polygonSideCount === undefined
                    ? "边数待计算"
                    : result.polygonSideCount === 0 ? "暂无轮廓" : `${result.polygonSideCount} 边形`}（忽略圆角）
                </p>
              )}
            </div>
            {/* contoured 多实体提示（CONTEXT:628）：不阻止生成，但必须在 UI 可见 */}
            {isContouredFootprint && result.contourBodyCount > 1 && (
              <div className="p-3 rounded bg-[#2a2418] border border-[#5a4824] text-[11px] text-[#d8b878]">
                当前贴合轮廓将生成 {result.contourBodyCount} 个独立可打印实体
              </div>
            )}
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
            {!isContouredFootprint && (
              <ParamSlider
                label={SHARED_LAYOUT_LIMITS.cornerRadius.label}
                value={params.cornerRadius}
                config={CUSTOM_LIMITS.cornerRadius}
                onChange={(v) => updateParam("cornerRadius", v)}
                unit={SHARED_LAYOUT_LIMITS.cornerRadius.unit}
              />
            )}
            {isPolygonalFootprint && (
              <p className="text-[11px] text-muted-foreground">
                圆角半径为 0 时保留尖角；实际半径不超过边界间距，以保证凹槽边距。
              </p>
            )}
            {isRectangularFootprint && (
              <ParamSlider
                label={SHARED_LAYOUT_LIMITS.sideBevelWidth.label}
                value={params.sideBevelWidth}
                config={CUSTOM_LIMITS.sideBevelWidth}
                onChange={(v) => updateParam("sideBevelWidth", v)}
                unit={SHARED_LAYOUT_LIMITS.sideBevelWidth.unit}
              />
            )}
            {isContouredFootprint && (
              <ParamSlider
                label={CUSTOM_LIMITS.smoothingRadius.label}
                value={params.smoothingRadius ?? 60}
                config={CUSTOM_LIMITS.smoothingRadius}
                onChange={(v) => updateParam("smoothingRadius", v)}
                unit={CUSTOM_LIMITS.smoothingRadius.unit}
              />
            )}
            {isContouredFootprint && (
              <ParamSlider
                label={CUSTOM_LIMITS.disconnectDistance.label}
                value={params.disconnectDistance ?? 0}
                config={CUSTOM_LIMITS.disconnectDistance}
                onChange={(v) => updateParam("disconnectDistance", v)}
                unit={CUSTOM_LIMITS.disconnectDistance.unit}
              />
            )}
          </div>
        </SectionHeader>
      </div>

      {/* 底板孔位 — 移动端默认折叠 */}
      <div><BaseHoleConfig<CustomLayoutParams>
        baseHoleStructure={params.baseHoleStructure}
        magnetPostHoleDiameter={params.magnetPostHoleDiameter}
        magnetPostHoleDepth={params.magnetPostHoleDepth}
        smallBaseHoleSize={params.smallBaseHoleSize}
        supportingThickness={params.baseThickness}
        resolvedBaseHoleSizes={resolvedBaseHoleSizes}
        selectedSlotMatch={selectedSlotMatch}
        fitViolations={baseHoleFitViolations}
        updateParam={updateParam}
        collapsible
        defaultOpen={false}
      /></div>

    </div>
    </PanelShell>
  );
}
