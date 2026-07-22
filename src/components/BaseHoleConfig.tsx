"use client";

import {
  BASE_HOLE_CONFIG,
  getBaseHoleMinBottomWall,
  getBaseHolePreset,
} from "@/lib/config";
import {
  MAGNET_POST_HOLE_LIMITS,
} from "@/lib/base-hole-config";
import {
  getRequiredBaseHoleSupportingThickness,
  type BaseHoleFitViolation,
} from "@/lib/base-hole-rules";
import type {
  BaseHoleParams,
  BaseHolePresetKey,
  BaseHoleStructure,
} from "@/types/tray";
import { AlertTriangle, Circle } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";

interface BaseHoleConfigProps<TParams extends BaseHoleParams> {
  baseHoleStructure: BaseHoleStructure;
  magnetPostHoleDiameter: number;
  magnetPostHoleDepth: number;
  resolvedBaseHoleSizes: readonly BaseHolePresetKey[];
  selectedSlotMatch?: {
    label: string;
    presetKey: BaseHolePresetKey;
  } | null;
  supportingThickness: number;
  supportingThicknessLabel?: string;
  fitViolations?: readonly BaseHoleFitViolation[];
  updateParam: <K extends keyof TParams>(
    key: K,
    value: TParams[K],
  ) => void;
  previewParam?: <K extends keyof TParams>(key: K, value: TParams[K]) => void;
  onBeginContinuousEdit?: () => boolean | void;
  onCommitContinuousEdit?: () => void;
  onCancelContinuousEdit?: () => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const STRUCTURE_OPTIONS = [
  { value: "none", label: "无" },
  { value: "magnetic-base-hole", label: "磁吸孔" },
  { value: "magnet-post-hole", label: "磁铁桩孔" },
] as const;

export function BaseHoleConfig<TParams extends BaseHoleParams>({
  baseHoleStructure,
  magnetPostHoleDiameter,
  magnetPostHoleDepth,
  resolvedBaseHoleSizes,
  selectedSlotMatch = null,
  supportingThickness,
  supportingThicknessLabel = "当前承载厚度",
  fitViolations = [],
  updateParam,
  previewParam,
  onBeginContinuousEdit,
  onCommitContinuousEdit,
  onCancelContinuousEdit,
  collapsible = false,
  defaultOpen = true,
}: BaseHoleConfigProps<TParams>) {
  const continuousParam = <K extends keyof TParams>(key: K) => previewParam
    ? {
        onContinuousChangeStart: onBeginContinuousEdit,
        onContinuousChange: (value: number) => previewParam(key, value as TParams[K]),
        onContinuousChangeCommit: onCommitContinuousEdit,
        onContinuousChangeCancel: onCancelContinuousEdit,
      }
    : {};
  const presets = resolvedBaseHoleSizes.map(getBaseHolePreset);
  const requiredThickness = getRequiredBaseHoleSupportingThickness({
    baseHoleStructure,
    magnetPostHoleDepth,
  });
  const summary = baseHoleStructure === "magnetic-base-hole"
    ? `磁吸孔 ${presets.length > 1 ? "混合规格" : presets[0]?.label ?? "自动匹配"}`
    : baseHoleStructure === "magnet-post-hole"
      ? `磁铁桩孔 ⌀${magnetPostHoleDiameter}mm × ${magnetPostHoleDepth}mm`
      : "无底板孔位";

  return (
    <div className="iron-panel rounded-sm p-4">
      <SectionHeader
        icon={Circle}
        title="底板孔位"
        collapsible={collapsible}
        defaultOpen={defaultOpen}
        summary={summary}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {STRUCTURE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={baseHoleStructure === value}
                onClick={() => updateParam(
                  "baseHoleStructure",
                  value as TParams["baseHoleStructure"],
                )}
                className={`px-2 py-2 text-xs font-bold tracking-wider border transition-all duration-200 cursor-pointer ${
                  baseHoleStructure === value
                    ? "bg-primary/15 text-primary border-primary/50 shadow-inner"
                    : "bg-[#1c1a16] text-muted-foreground border-[#2e2a24] hover:border-[#3d372e]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {baseHoleStructure === "magnetic-base-hole" ? (
            <div className="space-y-3">
              <div className="dashed-hint rounded-sm px-3 py-2 text-[11px] text-muted-foreground/70">
                每个 Slot Instance 按自身形状和名义尺寸自动匹配规格；同一托盘可混用规格。
              </div>
              {selectedSlotMatch ? (
                <div className="border border-primary/30 bg-primary/5 px-3 py-2 font-mono text-[11px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground/70">当前选中槽位</span>
                    <span className="text-foreground/90">{selectedSlotMatch.label}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-muted-foreground/70">匹配规格</span>
                    <span className="text-primary">
                      {getBaseHolePreset(selectedSlotMatch.presetKey).label}
                    </span>
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5 border border-[#2e2a24] bg-[#1c1a16] p-2.5 font-mono text-[11px] text-muted-foreground/70">
                {resolvedBaseHoleSizes.map((presetKey) => {
                  const preset = getBaseHolePreset(presetKey);
                  return (
                    <div key={presetKey} className="flex justify-between gap-3">
                      <span>{preset.label}</span>
                      <span className="text-foreground/80">
                        ⌀{preset.diameter}mm × {preset.depth}mm / 底壁至少 {getBaseHoleMinBottomWall(
                          presetKey,
                        )}mm
                      </span>
                    </div>
                  );
                })}
                <div className="flex justify-between">
                  <span>顶壁</span>
                  <span className="text-foreground/80">{BASE_HOLE_CONFIG.topWall}mm</span>
                </div>
                <div className="flex justify-between">
                  <span>{supportingThicknessLabel}</span>
                  <span className="text-foreground/80">{supportingThickness.toFixed(1)}mm</span>
                </div>
                <div className="flex justify-between">
                  <span>最小承载厚度</span>
                  <span className="text-foreground/80">{requiredThickness.toFixed(1)}mm</span>
                </div>
              </div>
            </div>
          ) : null}

          {baseHoleStructure === "magnet-post-hole" ? (
            <div className="space-y-3">
              <div className="dashed-hint rounded-sm px-3 py-2 text-[11px] text-muted-foreground/70">
                从每个 Slot Floor 中心向下开圆柱盲孔，不追加尺寸容差，并保留 1mm 底壁。
              </div>
              <ParamSlider
                label={MAGNET_POST_HOLE_LIMITS.diameter.label}
                value={magnetPostHoleDiameter}
                config={MAGNET_POST_HOLE_LIMITS.diameter}
                onChange={(value) => updateParam(
                  "magnetPostHoleDiameter",
                  value as TParams["magnetPostHoleDiameter"],
                )}
                {...continuousParam("magnetPostHoleDiameter")}
                unit={MAGNET_POST_HOLE_LIMITS.diameter.unit}
              />
              <ParamSlider
                label={MAGNET_POST_HOLE_LIMITS.depth.label}
                value={magnetPostHoleDepth}
                config={MAGNET_POST_HOLE_LIMITS.depth}
                onChange={(value) => updateParam(
                  "magnetPostHoleDepth",
                  value as TParams["magnetPostHoleDepth"],
                )}
                {...continuousParam("magnetPostHoleDepth")}
                unit={MAGNET_POST_HOLE_LIMITS.depth.unit}
              />
              <div className="flex justify-between border border-[#2e2a24] bg-[#1c1a16] p-2.5 font-mono text-[11px] text-muted-foreground/70">
                <span>{supportingThicknessLabel}</span>
                <span className="text-foreground/80">
                  {supportingThickness.toFixed(1)}mm / 最小 {requiredThickness.toFixed(1)}mm
                </span>
              </div>
            </div>
          ) : null}

          {fitViolations.length > 0 ? (
            <div className="space-y-2 rounded border border-red-800/70 bg-red-950/30 p-3 text-[11px] text-red-200">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 shrink-0" />
                当前设置无法生成或导出模型
              </div>
              <ul className="list-disc space-y-1 pl-5">
                {fitViolations.map((violation, index) => (
                  <li key={`${violation.kind}-${violation.slotIds.join("-")}-${index}`}>
                    <span className="font-mono text-red-100">
                      {violation.slotIds.join("、")}
                    </span>
                    ：{violation.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </SectionHeader>
    </div>
  );
}
