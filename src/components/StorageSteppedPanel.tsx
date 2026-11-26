"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Copy,
  FileUp,
  Layers,
  Plus,
  Redo2,
  Ruler,
  Trash2,
  Undo2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PanelShell } from "@/components/PanelShell";
import { useToast } from "@/hooks/useToast";
import type { UseStorageSteppedReturn } from "@/hooks/useStorageStepped";
import {
  STORAGE_STEPPED_HEIGHT_SPECS,
  STORAGE_STEPPED_LIMITS,
} from "@/lib/storage-stepped-config";
import {
  STORAGE_STEPPED_TRAY_PRESETS,
  STORAGE_STEPPED_CUSTOM_PRESET_ID,
  findStorageSteppedTrayPreset,
} from "@/lib/storage-stepped-presets";
import {
  CIRCLE_SLOT_DEFINITIONS,
  ELLIPSE_SLOT_DEFINITIONS,
  getFreeSlotProfileGeometry,
} from "@/lib/slot-definitions";
import type {
  StorageSteppedHeightSpecId,
  StorageSteppedInterfaceParams,
} from "@/types/storage-stepped";
import type { BaseHoleStructure } from "@/types/tray";
import type { StorageSteppedLayoutImportReport } from "@/lib/storage-stepped-layout-import";

interface StorageSteppedPanelProps {
  model: UseStorageSteppedReturn;
  selectedSlotIds: string[];
  actions: ReactNode;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#2e2a24] bg-[#1c1a16] p-2 text-center">
      <div className="text-[9px] text-muted-foreground/60">{label}</div>
      <div className="mt-0.5 font-mono text-xs font-semibold text-foreground/90">
        {value}
      </div>
    </div>
  );
}

function formatMm(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

const INTERFACE_SLIDERS: Array<{
  key: keyof StorageSteppedInterfaceParams;
  label: string;
  limitKey: keyof typeof STORAGE_STEPPED_LIMITS;
}> = [
  { key: "bodyWidth", label: "主体宽度", limitKey: "bodyWidth" },
  { key: "moduleDepth", label: "单阶深度", limitKey: "moduleDepth" },
  { key: "lowerWallThickness", label: "下部壁厚", limitKey: "lowerWallThickness" },
  { key: "rimThickness", label: "上沿厚度", limitKey: "rimThickness" },
  { key: "fingerPullDiameter", label: "指扣直径", limitKey: "fingerPullDiameter" },
  { key: "baseThickness", label: "主体底板厚度", limitKey: "baseThickness" },
  { key: "assemblyClearance", label: "单边装配间隙", limitKey: "assemblyClearance" },
  { key: "trayBottomChamfer", label: "托盘底部倒角退让", limitKey: "trayBottomChamfer" },
  { key: "trayChamferAngle", label: "托盘底部倒角角度", limitKey: "trayChamferAngle" },
];

export function StorageSteppedPanel({
  model,
  selectedSlotIds,
  actions,
}: StorageSteppedPanelProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slotChoice, setSlotChoice] = useState("circle-32");
  const [importReport, setImportReport] =
    useState<StorageSteppedLayoutImportReport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const plan = model.plan;
  const currentTray = model.currentTray;
  const errors = model.validation.errors;
  const warnings = model.validation.warnings;
  const preset = findStorageSteppedTrayPreset(currentTray.presetId);
  const presetValue = preset ? preset.id : STORAGE_STEPPED_CUSTOM_PRESET_ID;
  const baseHoleStructure = currentTray.baseHoleStructure;

  const clearSteps = plan.steps.map((step) => step.clearHeight.toFixed(1)).join(" / ");
  const capacityLiters = plan.theoreticalCapacity / 1_000_000;

  const summary = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary/70">
            阶梯收纳展示台
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              接口 v{model.params.interfaceVersion}
            </span>
            <span className="rounded-sm border border-[#2e2a24] bg-[#1c1a16] px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {STORAGE_STEPPED_HEIGHT_SPECS[model.params.heightSpecId].label}
            </span>
          </div>
        </div>
        {model.validation.isValid ? (
          <span className="rounded-sm border border-[#4a6741] bg-[#22301f] px-2 py-0.5 text-[10px] text-[#a6d49a]">
            校验通过
          </span>
        ) : (
          <span className="rounded-sm border border-[#713737] bg-[#2a1616] px-2 py-0.5 text-[10px] text-[#e28b82]">
            {errors.length} 项错误
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Metric
          label="主体"
          value={`${formatMm(plan.bodyWidth)}×${formatMm(plan.bodyDepth)}×${formatMm(plan.totalHeight)}`}
        />
        <Metric
          label="托盘"
          value={`${plan.trayWidth.toFixed(1)}×${plan.trayDepth.toFixed(1)}×${plan.trayThickness}`}
        />
        <Metric label="实体体积" value={`${(model.volume / 1000).toFixed(1)} cm³`} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Metric label="仓净高" value={clearSteps} />
        <Metric label="理论容积" value={`${capacityLiters.toFixed(3)} L`} />
      </div>
      <p className="text-[9px] leading-3 text-muted-foreground/70">
        体积为实心 CAD 材料体积，不等同于切片填充后的耗材用量。
      </p>
      {model.isPreviewStale ? (
        <div className="rounded-sm border border-[#5a4a2a] bg-[#2a2518]/95 px-2 py-1 text-[10px] text-[#d7b95d]">
          预览待更新：修改参数后请重新锻造。
        </div>
      ) : null}
    </div>
  );

  const heightOptions: StorageSteppedHeightSpecId[] = ["standard", "storage"];

  const handleAddSlot = () => {
    const circle = CIRCLE_SLOT_DEFINITIONS.find((entry) => entry.id === slotChoice);
    if (circle) {
      model.addSlot(circle.baseDiameter);
      return;
    }
    const ellipse = ELLIPSE_SLOT_DEFINITIONS.find((entry) => entry.id === slotChoice);
    if (ellipse) {
      model.addSlot(ellipse.width, ellipse.height, {
        outerOffset: ellipse.outerOffset,
        profileExponent: ellipse.profileExponent,
        slotDefinitionId: ellipse.id,
      });
    }
  };

  const handleImportFile = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const data: unknown = JSON.parse(text);
      setImportReport(model.prepareLayoutImport(data));
    } catch (error) {
      setImportReport(null);
      setImportError(
        `无法读取参数文件：${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  };

  const importDialog = importReport ? (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setImportReport(null);
      }}
    >
      <DialogContent className="max-w-lg border-[#3d372e] bg-[#0e0d0b]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#e4c76e]">
            <FileUp className="size-4" />
            导入托盘布局
          </DialogTitle>
          <DialogDescription>
            仅接收自定义模式导出的托盘槽位；保留槽形与实际尺寸，只做整体平移。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric
              label="源布局"
              value={
                importReport.slotCount > 0
                  ? `${importReport.sourceWidth.toFixed(1)}×${importReport.sourceDepth.toFixed(1)}`
                  : "—"
              }
            />
            <Metric
              label="目标托盘"
              value={`${importReport.targetWidth.toFixed(1)}×${importReport.targetDepth.toFixed(1)}`}
            />
            <Metric label="槽位" value={`${importReport.slotCount}`} />
            <Metric
              label="整体平移"
              value={`X ${importReport.translation.x.toFixed(2)} / Y ${importReport.translation.y.toFixed(2)}`}
            />
          </div>
          <div className="rounded-sm border border-[#2e2a24] bg-[#141310] p-1.5">
            <svg
              viewBox={`0 0 ${importReport.targetWidth} ${importReport.targetDepth}`}
              role="img"
              aria-label="导入布局预览"
              className="h-28 w-full"
              preserveAspectRatio="xMidYMid meet"
            >
              <rect
                x={0}
                y={0}
                width={importReport.targetWidth}
                height={importReport.targetDepth}
                fill="#1c1a16"
                stroke="#5c5446"
                strokeWidth={0.6}
              />
              {importReport.slots.map((slot) => {
                const profile = getFreeSlotProfileGeometry(slot);
                const cy = importReport.targetDepth - slot.y;
                return (
                  <ellipse
                    key={slot.id}
                    cx={slot.x}
                    cy={cy}
                    rx={profile.width / 2}
                    ry={profile.height / 2}
                    transform={`rotate(${-slot.rotation} ${slot.x} ${cy})`}
                    fill={importReport.status === "ready" ? "#6c8348" : "#8b3a3a"}
                    fillOpacity={0.55}
                    stroke={importReport.status === "ready" ? "#a8d39a" : "#e28b82"}
                    strokeWidth={0.5}
                  />
                );
              })}
            </svg>
            <div className="mt-1 text-center text-[9px] text-muted-foreground">
              平移后槽位预览（不缩放、不裁剪）
            </div>
          </div>
          {importReport.notes.map((note) => (
            <p key={note} className="text-[11px] leading-5 text-muted-foreground">
              {note}
            </p>
          ))}
          {importReport.conflicts.length > 0 ? (
            <div className="rounded-sm border border-[#713737] bg-[#261010] px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#e28b82]">
                <AlertTriangle className="size-3.5" />
                发现 {importReport.conflicts.length} 项冲突，不能提交
              </div>
              <ul className="space-y-1 text-[11px] leading-5 text-[#d9a1a1]">
                {importReport.conflicts.slice(0, 6).map((conflict) => (
                  <li key={`${conflict.path}-${conflict.message}`}>
                    <span className="font-mono text-[10px] text-[#b77]">{conflict.path}</span>
                    ：{conflict.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-sm border border-[#4a6741] bg-[#1c2a19] px-3 py-2 text-[11px] text-[#a6d49a]">
              布局可导入；提交后会把当前阶预设标记为自定义。
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setImportReport(null)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={importReport.status !== "ready"}
            onClick={() => {
              try {
                model.applyLayoutImport(importReport);
                toast("success", "已导入托盘布局");
                setImportReport(null);
              } catch (error) {
                toast(
                  "error",
                  `导入失败：${error instanceof Error ? error.message : "未知错误"}`,
                );
              }
            }}
          >
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  const sections = (
    <div className="space-y-3">
      <SectionHeader icon={Ruler} title="主体规格">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            {heightOptions.map((option) => {
              const spec = STORAGE_STEPPED_HEIGHT_SPECS[option];
              const active = model.params.heightSpecId === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => model.setHeightSpec(option)}
                  className={`rounded-sm border px-2 py-2 text-left transition-colors ${
                    active
                      ? "border-[#c8a84e] bg-[#2a2518] text-[#e8d7a8]"
                      : "border-[#2e2a24] bg-[#1c1a16] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="text-[11px] font-semibold">{spec.label}</div>
                  <div className="mt-0.5 text-[9px]">
                    台面 {spec.firstStepHeight}/{spec.firstStepHeight + spec.stepRise}/
                    {spec.firstStepHeight + spec.stepRise * 2} mm
                  </div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Metric
              label="仓净高"
              value={plan.steps.map((step) => step.clearHeight.toFixed(1)).join(" / ")}
            />
            <Metric label="隔墙" value={`${formatMm(2 * model.params.interface.lowerWallThickness)} mm`} />
            <Metric
              label="承托台阶"
              value={`${formatMm(plan.supportLedgeWidth)} / 平底 ${plan.supportContactCentered.toFixed(1)} mm`}
            />
            <Metric label="指扣" value={`Ø${formatMm(model.params.interface.fingerPullDiameter)}`} />
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">
            主体宽度、深度与阶数固定为 240 × 240 mm、3 阶；高度规格只改变台面高度，
            不改变托盘外形与槽位。
          </p>
        </div>
      </SectionHeader>

      <SectionHeader icon={Layers} title="当前托盘">
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={!model.canUndo} onClick={model.undo}>
              <Undo2 aria-hidden="true" /> 撤销
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!model.canRedo} onClick={model.redo}>
              <Redo2 aria-hidden="true" /> 重做
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {plan.steps.map((step) => {
              const tray = model.params.trays.find(
                (candidate) => candidate.stepIndex === step.index,
              );
              const active = model.currentStepIndex === step.index;
              return (
                <button
                  key={step.index}
                  type="button"
                  aria-pressed={active}
                  onClick={() => model.setCurrentStepIndex(step.index)}
                  className={`rounded-sm border px-2 py-1.5 text-center transition-colors ${
                    active
                      ? "border-[#8cb880] bg-[#22301f] text-[#d8e6cf]"
                      : "border-[#2e2a24] bg-[#1c1a16] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="text-[11px] font-semibold">第 {step.index + 1} 阶</div>
                  <div className="font-mono text-[9px]">
                    {tray?.slots.length ?? 0} 槽 · 高 {step.deckHeight}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="storage-preset" className="w-14 shrink-0 text-[11px]">
              预设
            </Label>
            <Select value={presetValue} onValueChange={(value) => {
              if (value === STORAGE_STEPPED_CUSTOM_PRESET_ID) return;
              model.applyPreset(value);
            }}>
              <SelectTrigger id="storage-preset" className="h-8 flex-1 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presetValue === STORAGE_STEPPED_CUSTOM_PRESET_ID ? (
                  <SelectItem value={STORAGE_STEPPED_CUSTOM_PRESET_ID}>
                    自定义布局
                  </SelectItem>
                ) : null}
                {STORAGE_STEPPED_TRAY_PRESETS.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">
            {preset?.description ?? "手工编辑的槽位布局；预设名称不参与几何重建。"}
            {preset?.source === "derived" ? "（推导布局）" : ""}
          </p>

          <div className="flex items-center gap-1.5">
            <Select value={slotChoice} onValueChange={setSlotChoice}>
              <SelectTrigger className="h-8 flex-1 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CIRCLE_SLOT_DEFINITIONS.map((definition) => (
                  <SelectItem key={definition.id} value={definition.id}>
                    {definition.name}
                  </SelectItem>
                ))}
                {ELLIPSE_SLOT_DEFINITIONS.map((definition) => (
                  <SelectItem key={definition.id} value={definition.id}>
                    椭圆 {definition.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={handleAddSlot}
              className="h-8 gap-1 bg-[#2a3528] px-2 text-[11px] text-[#a8d39a] border border-[#4a6741] hover:bg-[#354530]"
            >
              <Plus className="size-3.5" />
              添加
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={selectedSlotIds.length === 0}
              onClick={() => model.removeSlots(selectedSlotIds)}
              className="h-8 gap-1 border-[#3d372e] px-2 text-[11px]"
            >
              <Trash2 className="size-3.5" />
              删除选中
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {plan.steps
              .filter((step) => step.index !== model.currentStepIndex)
              .map((step) => (
                <Button
                  key={`copy-to-${step.index}`}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => model.copyTrayToStep(step.index)}
                  className="h-7 gap-1 border-[#3d372e] px-2 text-[10px]"
                >
                  <Copy className="size-3" />
                  复制到第 {step.index + 1} 阶
                </Button>
              ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {plan.steps
              .filter((step) => step.index !== model.currentStepIndex)
              .map((step) => (
                <Button
                  key={`copy-from-${step.index}`}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => model.copyTrayFromStep(step.index)}
                  className="h-7 gap-1 border-[#3d372e] px-2 text-[10px]"
                >
                  <Copy className="size-3" />
                  从第 {step.index + 1} 阶复制
                </Button>
              ))}
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 w-full gap-1 border-[#3d372e] text-[11px]"
          >
            <FileUp className="size-3.5" />
            导入托盘布局
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImportFile(file);
              event.target.value = "";
            }}
          />
          {importError ? (
            <p className="text-[10px] text-[#e28b82]">{importError}</p>
          ) : null}

          <ParamSlider
            label="槽深"
            value={currentTray.holeDepth}
            config={STORAGE_STEPPED_LIMITS.holeDepth}
            onChange={model.setHoleDepth}
            unit="mm"
          />
          <p className="text-[10px] leading-4 text-muted-foreground">
            托盘总厚固定 6 mm，槽底厚 = 6 − 槽深 ={" "}
            {(plan.trayThickness - currentTray.holeDepth).toFixed(1)} mm。
          </p>

          <div className="flex items-center gap-2">
            <Label htmlFor="storage-base-hole" className="w-14 shrink-0 text-[11px]">
              底孔
            </Label>
            <Select
              value={baseHoleStructure}
              onValueChange={(value) =>
                model.updateBaseHole({
                  baseHoleStructure: value as BaseHoleStructure,
                })
              }
            >
              <SelectTrigger id="storage-base-hole" className="h-8 flex-1 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">关闭</SelectItem>
                <SelectItem value="magnet-post-hole">磁铁桩孔</SelectItem>
                <SelectItem value="magnetic-base-hole">磁吸底孔</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {baseHoleStructure === "magnet-post-hole" ? (
            <>
              <ParamSlider
                label={STORAGE_STEPPED_LIMITS.magnetPostHoleDiameter.label}
                value={currentTray.magnetPostHoleDiameter}
                config={STORAGE_STEPPED_LIMITS.magnetPostHoleDiameter}
                onChange={(value) =>
                  model.updateBaseHole({ magnetPostHoleDiameter: value })
                }
                unit="mm"
              />
              <ParamSlider
                label={STORAGE_STEPPED_LIMITS.magnetPostHoleDepth.label}
                value={currentTray.magnetPostHoleDepth}
                config={STORAGE_STEPPED_LIMITS.magnetPostHoleDepth}
                onChange={(value) =>
                  model.updateBaseHole({ magnetPostHoleDepth: value })
                }
                unit="mm"
              />
            </>
          ) : null}
        </div>
      </SectionHeader>

      <SectionHeader icon={Wrench} title="槽位规则">
        <div className="space-y-2">
          <ParamSlider
            label="槽位间距"
            value={model.params.slotSpacing}
            config={STORAGE_STEPPED_LIMITS.slotSpacing}
            onChange={model.updateSlotSpacing}
            unit="mm"
          />
          <ParamSlider
            label="槽位边距"
            value={model.params.slotBoundarySpacing}
            config={STORAGE_STEPPED_LIMITS.slotBoundarySpacing}
            onChange={model.updateSlotBoundarySpacing}
            unit="mm"
          />
          <p className="text-[10px] leading-4 text-muted-foreground">
            托盘边界固定，修改槽位尺寸不会放大托盘；超出边距或间距不足会在校验中报告。
          </p>
        </div>
      </SectionHeader>

      <SectionHeader
        icon={Wrench}
        title="接口打样参数"
        collapsible
        defaultOpen={false}
        summary="改动后需重新验证装配"
      >
        <div className="space-y-2">
          <div className="rounded-sm border border-[#5a4a2a] bg-[#2a2518]/80 px-2 py-1.5 text-[10px] leading-4 text-[#d7b95d]">
            接口参数会同时重建主体与托盘；偏离打样默认值时不能与默认接口视为可互换。
          </div>
          {INTERFACE_SLIDERS.map((entry) => (
            <ParamSlider
              key={entry.key}
              label={entry.label}
              value={model.params.interface[entry.key]}
              config={STORAGE_STEPPED_LIMITS[entry.limitKey]}
              onChange={(value) => model.updateInterface(entry.key, value)}
              unit={STORAGE_STEPPED_LIMITS[entry.limitKey].unit}
            />
          ))}
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="实际托盘宽" value={`${plan.trayWidth.toFixed(1)} mm`} />
            <Metric label="实际托盘深" value={`${plan.trayDepth.toFixed(1)} mm`} />
          </div>
        </div>
      </SectionHeader>

      <SectionHeader icon={AlertTriangle} title="校验">
        {errors.length === 0 && warnings.length === 0 ? (
          <p className="text-[10px] leading-4 text-muted-foreground">
            当前参数与三个托盘配置均通过校验。
          </p>
        ) : (
          <div className="space-y-1.5">
            {errors.map((entry) => (
              <div
                key={`${entry.path}-${entry.message}`}
                className="rounded-sm border border-[#633737] bg-[#281717]/90 px-2 py-1.5 text-[10px] leading-4 text-[#e0a0a0]"
              >
                <span className="font-mono text-[9px] text-[#b77]">{entry.path}</span>
                ：{entry.message}
              </div>
            ))}
            {warnings.map((entry) => (
              <div
                key={`${entry.path}-${entry.message}`}
                className="rounded-sm border border-[#7c5a1c] bg-[#2a2115]/80 px-2 py-1.5 text-[10px] leading-4 text-[#f0d8b8]"
              >
                {entry.message}
              </div>
            ))}
          </div>
        )}
        {Object.entries(model.workerErrors).map(([partId, message]) => (
          <div
            key={`worker-${partId}`}
            className="mt-1.5 rounded-sm border border-[#633737] bg-[#281717]/90 px-2 py-1.5 text-[10px] leading-4 text-[#e0a0a0]"
          >
            生成失败：{message}
          </div>
        ))}
      </SectionHeader>
    </div>
  );

  return (
    <>
      {importDialog}
      <PanelShell summary={summary} actions={actions}>
        {sections}
      </PanelShell>
    </>
  );
}
