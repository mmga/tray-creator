"use client";

import { Box, ChevronsUpDown, Expand } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DraftNumberInput } from "@/components/ui/DraftNumberInput";
import {
  STACKABLE_BOX_LIMITS,
  STACKABLE_BOX_SPECS,
  type BoxValidationResult,
} from "@/lib/stackable-box";
import type { StackableBoxParams } from "@/types/tray";

interface StackableBoxConfigProps {
  box: StackableBoxParams;
  onChange: (box: StackableBoxParams) => void;
  validation: BoxValidationResult;
  /** 盒内可用宽深 (mm)。 */
  usableWidth: number;
  usableDepth: number;
  /** 带盖净高 (mm)。 */
  lidClearHeight: number;
  /** 堆叠安全净高 (mm)。 */
  stackClearHeight: number;
  onExpandToFit?: () => void;
}

function NumberField({
  label,
  value,
  config,
  onChange,
}: {
  label: string;
  value: number;
  config: { label: string; min: number; max: number; unit: string };
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <DraftNumberInput
        value={value}
        onValueChange={onChange}
        min={config.min}
        max={config.max}
        step={config.min === 0.15 ? 0.01 : 0.1}
        className="bg-[#1c1a16] border-[#2e2a24] text-foreground"
      />
    </div>
  );
}

export function StackableBoxConfig({
  box,
  onChange,
  validation,
  usableWidth,
  usableDepth,
  lidClearHeight,
  stackClearHeight,
  onExpandToFit,
}: StackableBoxConfigProps) {
  const limits = STACKABLE_BOX_LIMITS;
  const setField = <K extends keyof StackableBoxParams>(
    key: K,
    value: StackableBoxParams[K],
  ) => onChange({ ...box, [key]: value });

  const overflow = validation.overflow;

  return (
    <div className="iron-panel rounded-sm p-4">
      <SectionHeader
        icon={Box}
        title="堆叠盒体"
        collapsible
        defaultOpen={false}
        summary={box.enabled
          ? `${box.outerWidth}×${box.outerDepth}×${box.outerHeight}mm`
          : "普通托盘"}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded border border-[#2e2a24] bg-[#1c1a16] p-3">
            <Label htmlFor="stackable-box-enabled" className="text-sm cursor-pointer text-[#f0d8b8]">
              启用堆叠盒体结构
            </Label>
            <Switch
              id="stackable-box-enabled"
              checked={box.enabled}
              onCheckedChange={(checked) => setField("enabled", checked)}
              className="data-[state=checked]:bg-[#8cb880]"
            />
          </div>

          {box.enabled ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <NumberField
                  label="外部长度"
                  value={box.outerWidth}
                  config={limits.outerWidth}
                  onChange={(v) => setField("outerWidth", v)}
                />
                <NumberField
                  label="外部深度"
                  value={box.outerDepth}
                  config={limits.outerDepth}
                  onChange={(v) => setField("outerDepth", v)}
                />
                <NumberField
                  label="外部高度"
                  value={box.outerHeight}
                  config={limits.outerHeight}
                  onChange={(v) => setField("outerHeight", v)}
                />
              </div>

              <NumberField
                label="最小内壁间距"
                value={box.minimumWallClearance}
                config={limits.minimumWallClearance}
                onChange={(v) => setField("minimumWallClearance", v)}
              />

              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="XY 配合间隙"
                  value={box.xyFitClearance}
                  config={limits.xyFitClearance}
                  onChange={(v) => setField("xyFitClearance", v)}
                />
                <NumberField
                  label="盖板厚度"
                  value={box.lidThickness}
                  config={limits.lidThickness}
                  onChange={(v) => setField("lidThickness", v)}
                />
              </div>

              <div className="space-y-1 rounded border border-[#2e2a24] bg-[#1c1a16] p-2 text-[10px] text-muted-foreground">
                <div>可用宽深：{usableWidth.toFixed(1)} × {usableDepth.toFixed(1)} mm</div>
                <div>带盖净高：{lidClearHeight.toFixed(1)} mm · 堆叠净高：{stackClearHeight.toFixed(1)} mm</div>
                <div>
                  固定规格：墙厚 {STACKABLE_BOX_SPECS.bodyWallThickness}mm · 圆角 {STACKABLE_BOX_SPECS.outerCornerRadius}mm ·
                  盒口支撑斜面 {(STACKABLE_BOX_SPECS.topTransitionHeight + box.xyFitClearance).toFixed(2)}mm × {STACKABLE_BOX_SPECS.topTransitionAngle}° ·
                  互补导向斜面 {STACKABLE_BOX_SPECS.guideChamferHeight}mm × {STACKABLE_BOX_SPECS.guideChamferAngle}° ·
                  有效水平承重 {STACKABLE_BOX_SPECS.minLoadBearingWidth}mm · 无悬空水平面
                </div>
              </div>

              {overflow ? (
                <div className="space-y-2 rounded border border-[#7c5a1c] bg-[#2a2115]/70 p-2 text-[10px] text-[#f0d8b8]">
                  <div>
                    槽位越界：需 {overflow.requiredWidth.toFixed(1)} × {overflow.requiredDepth.toFixed(1)} mm，
                    当前 {overflow.currentWidth.toFixed(1)} × {overflow.currentDepth.toFixed(1)} mm
                  </div>
                  <div className="text-[#d75b5b]">
                    差值 X {overflow.deltaX.toFixed(1)} mm / Y {overflow.deltaY.toFixed(1)} mm
                  </div>
                  {onExpandToFit ? (
                    <button
                      type="button"
                      onClick={onExpandToFit}
                      className="flex items-center gap-1 rounded border border-[#8cb880] px-2 py-1 text-[#8cb880] hover:bg-[#8cb880]/10"
                    >
                      <Expand className="h-3 w-3" />
                      扩展盒体至刚好容纳
                    </button>
                  ) : null}
                </div>
              ) : null}

              {validation.blockingReasons.map((reason) => (
                <div key={reason.code} className="text-[10px] text-[#d75b5b]">
                  {reason.message}
                </div>
              ))}
              {validation.warnings.map((warning) => (
                <div key={warning.code} className="text-[10px] text-[#d6a84f]">
                  {warning.message}
                </div>
              ))}
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <ChevronsUpDown className="h-3 w-3" />
              关闭盒体后，托盘尺寸模式、边界间距、圆角与侧面斜面配置将恢复。
            </div>
          )}
        </div>
      </SectionHeader>
    </div>
  );
}
