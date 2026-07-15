"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileJson2,
  ListChecks,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  APP_MODE_LABELS,
  type ImportCandidate,
  type ImportModeSelectionRequired,
} from "@/lib/param-io";
import type {
  ImportAdjustment,
  ImportAdjustmentCategory,
} from "@/lib/param-import-report";
import type { AppMode } from "@/types/custom-tray";

const CATEGORY_META: Record<
  ImportAdjustmentCategory,
  { label: string; className: string }
> = {
  default: {
    label: "使用默认值",
    className: "border-[#31506a] bg-[#111d28] text-[#88b9dc]",
  },
  migration: {
    label: "旧字段迁移",
    className: "border-[#5b4b25] bg-[#211b0e] text-[#d8bd69]",
  },
  "value-adjustment": {
    label: "数值调整",
    className: "border-[#70452b] bg-[#25150d] text-[#e6a56d]",
  },
  behavior: {
    label: "行为变化",
    className: "border-[#6b2c2c] bg-[#251010] text-[#e18181]",
  },
};

export interface ParamImportTargetRisk {
  currentDraftId: string | null;
  hasUnsavedChanges: boolean;
}

interface ParamImportDialogProps {
  currentMode: AppMode;
  modeSelection: ImportModeSelectionRequired | null;
  candidate: ImportCandidate | null;
  targetRisk: ParamImportTargetRisk | null;
  isPreparing?: boolean;
  onSelectMode: (mode: AppMode) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

function formatValue(value: unknown) {
  if (value === undefined) return "未提供";
  if (value === null) return "空";
  if (typeof value === "boolean") return value ? "开启" : "关闭";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function AdjustmentRow({ adjustment }: { adjustment: ImportAdjustment }) {
  return (
    <div className="grid gap-1 border-b border-[#2e2a24] px-3 py-2.5 last:border-b-0 sm:grid-cols-[minmax(9rem,0.8fr)_minmax(0,1.4fr)] sm:gap-4">
      <div>
        <div className="text-xs font-semibold text-[#e8dcc5]">
          {adjustment.label}
        </div>
        <code className="text-[10px] text-[#776f62]">{adjustment.path}</code>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[11px]">
          <span className="truncate text-[#8e8577]">
            {formatValue(adjustment.previousValue)}
          </span>
          <ArrowRight className="size-3 shrink-0 text-[#8d7432]" />
          <span className="truncate text-[#e2c66f]">
            {formatValue(adjustment.normalizedValue)}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[#9e9587]">
          {adjustment.reason}
        </p>
      </div>
    </div>
  );
}

export function ParamImportDialog({
  currentMode,
  modeSelection,
  candidate,
  targetRisk,
  isPreparing = false,
  onSelectMode,
  onCancel,
  onConfirm,
}: ParamImportDialogProps) {
  const open = Boolean(modeSelection || candidate);
  const primaryAdjustments = candidate?.report.adjustments.filter(
    (item) => !item.technical,
  ) ?? [];
  const technicalAdjustments = candidate?.report.adjustments.filter(
    (item) => item.technical,
  ) ?? [];
  const hasOverwriteRisk = Boolean(
    targetRisk?.hasUnsavedChanges || targetRisk?.currentDraftId,
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onCancel();
    }}>
      <DialogContent className="max-w-3xl overflow-hidden border-[#4a4030] bg-[#0e0d0b] p-0 shadow-[0_24px_90px_rgba(0,0,0,0.78)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d0aa43] to-transparent" />
        <DialogHeader className="relative bg-[linear-gradient(135deg,rgba(58,45,20,0.5),rgba(14,13,11,0.2)_55%)] pr-14">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-bold tracking-[0.22em] text-[#b99b4f]">
            <ShieldCheck className="size-3.5" />
            只读安全检查
          </div>
          <DialogTitle className="flex items-center gap-2 text-lg text-[#ead9ae]">
            <FileJson2 className="size-5 text-[#c8a74f]" />
            {modeSelection ? "识别参数文件 Mode" : "确认导入参数"}
          </DialogTitle>
          <DialogDescription>
            {modeSelection
              ? modeSelection.message
              : "以下内容由同一次规范化生成；确认前不会修改任何工作区。"}
          </DialogDescription>
        </DialogHeader>

        {modeSelection ? (
          <div className="space-y-4 px-6 py-6">
            <div className="rounded-sm border border-[#3a342b] bg-[#15130f] px-4 py-3">
              <div className="text-xs font-semibold text-[#d7c9ad]">
                {modeSelection.fileName}
              </div>
              <p className="mt-1 text-[11px] leading-5 text-[#8f887d]">
                选择文件原本所属的 Mode。此操作只补充缺失身份，不转换参数语义。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {modeSelection.choices.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={isPreparing}
                  onClick={() => onSelectMode(mode)}
                  className="group relative overflow-hidden rounded-sm border border-[#3d372e] bg-[#171510] px-4 py-4 text-left transition hover:border-[#a58436] hover:bg-[#201b10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c5a24a] disabled:opacity-50"
                >
                  <div className="absolute inset-y-0 left-0 w-0.5 bg-[#6d581f] transition-all group-hover:w-1" />
                  <div className="text-sm font-semibold text-[#e0d4bd]">
                    {APP_MODE_LABELS[mode]}
                  </div>
                  <div className="mt-1 text-[10px] font-mono tracking-wide text-[#81796c]">
                    {mode}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : candidate ? (
          <div className="max-h-[64vh] space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-sm border border-[#302c25] bg-[#15130f] px-3 py-2.5">
                <div className="text-[10px] tracking-wider text-[#777065]">当前 Mode</div>
                <div className="mt-1 text-sm font-semibold text-[#c9bda8]">
                  {APP_MODE_LABELS[currentMode]}
                </div>
              </div>
              <ArrowRight className="mx-auto hidden size-4 text-[#9c7e33] sm:block" />
              <div className="rounded-sm border border-[#6a5728] bg-[#211b0e] px-3 py-2.5">
                <div className="text-[10px] tracking-wider text-[#9e874d]">导入目标</div>
                <div className="mt-1 text-sm font-semibold text-[#e4c76e]">
                  {APP_MODE_LABELS[candidate.targetMode]}
                </div>
              </div>
            </div>

            {candidate.targetMode !== currentMode ? (
              <div className="flex gap-3 rounded-sm border border-[#695327] bg-[#211a0d] px-3 py-3 text-[#d8bb68]">
                <Wrench className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  确认后将自动切换到「{APP_MODE_LABELS[candidate.targetMode]}」工作区。
                </p>
              </div>
            ) : null}

            {hasOverwriteRisk ? (
              <div className="flex gap-3 rounded-sm border border-[#713737] bg-[#261010] px-3 py-3 text-[#e28b82]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="text-xs leading-5">
                  <div className="font-semibold">目标工作区将被替换</div>
                  <div className="text-[#b97770]">
                    {targetRisk?.hasUnsavedChanges ? "存在未保存修改。" : ""}
                    {targetRisk?.currentDraftId ? "当前 Draft Binding 将被清除。" : ""}
                  </div>
                </div>
              </div>
            ) : null}

            {candidate.report.adjustments.length === 0 &&
            candidate.report.retiredFields.length === 0 ? (
              <div className="flex items-center gap-3 rounded-sm border border-[#31523a] bg-[#102016] px-4 py-4 text-[#84c592]">
                <CheckCircle2 className="size-5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">未应用兼容调整</div>
                  <div className="mt-0.5 text-[11px] text-[#6fa37a]">
                    该文件可直接导入，参数语义保持不变。
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {(["behavior", "migration", "default", "value-adjustment"] as const).map((category) => {
                  const items = primaryAdjustments.filter(
                    (item) => item.category === category,
                  );
                  if (items.length === 0) return null;
                  const meta = CATEGORY_META[category];
                  return (
                    <section key={category} className="overflow-hidden rounded-sm border border-[#302c25] bg-[#12110e]">
                      <div className={`flex items-center justify-between border-b px-3 py-2 text-xs font-semibold ${meta.className}`}>
                        <span>{meta.label}</span>
                        <span className="font-mono text-[10px] opacity-75">{items.length}</span>
                      </div>
                      {items.map((item, index) => (
                        <AdjustmentRow key={`${item.path}-${index}`} adjustment={item} />
                      ))}
                    </section>
                  );
                })}
              </div>
            )}

            {candidate.report.retiredFields.length > 0 ? (
              <section className="overflow-hidden rounded-sm border border-[#633537] bg-[#160f0f]">
                <div className="flex items-center justify-between border-b border-[#633537] bg-[#251112] px-3 py-2 text-xs font-semibold text-[#dc8585]">
                  <span>已过时并忽略</span>
                  <span className="font-mono text-[10px] opacity-75">
                    {candidate.report.retiredFields.length}
                  </span>
                </div>
                {candidate.report.retiredFields.map((field) => (
                  <div key={field.path} className="border-b border-[#332020] px-3 py-2.5 last:border-b-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-[#d6b0aa]">{field.label}</span>
                      <code className="text-[10px] text-[#806663]">{field.path}</code>
                    </div>
                    <p className="mt-1 text-[11px] text-[#9d7773]">{field.reason}</p>
                  </div>
                ))}
              </section>
            ) : null}

            <details className="group rounded-sm border border-[#2d2922] bg-[#100f0d]">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs text-[#928a7d] hover:text-[#c7bda9]">
                <ListChecks className="size-4" />
                技术详情
                <span className="ml-auto font-mono text-[10px]">
                  {candidate.report.adjustments.length + candidate.report.retiredFields.length} 项
                </span>
              </summary>
              <div className="border-t border-[#2d2922]">
                <div className="px-3 py-2 text-[11px] leading-5 text-[#8e8679]">
                  {candidate.report.modeResolution.message}
                </div>
                {technicalAdjustments.map((item, index) => (
                  <AdjustmentRow key={`${item.path}-technical-${index}`} adjustment={item} />
                ))}
              </div>
            </details>
          </div>
        ) : null}

        <DialogFooter className="bg-[#11100d]">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPreparing}>
            取消
          </Button>
          {candidate ? (
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isPreparing}
              className="border border-[#a48639] bg-[#6d571e] text-[#f0dfad] hover:bg-[#816924]"
            >
              <ShieldCheck className="size-4" />
              {candidate.targetMode === currentMode
                ? "确认导入"
                : `确认并切换到${APP_MODE_LABELS[candidate.targetMode]}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
