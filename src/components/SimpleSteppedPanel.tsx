"use client";

import { useMemo, type ReactNode } from "react";
import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";
import type { SimpleSteppedDerivedLayout } from "@/lib/simple-stepped-layout";
import { BASE_PRESETS } from "@/lib/config";
import { SIMPLE_STEPPED_LIMITS } from "@/lib/simple-stepped-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { Switch } from "@/components/ui/switch";
import { PanelShell } from "@/components/PanelShell";
import { TrayResultSummary } from "@/components/TrayResultSummary";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Rows3,
  Ruler,
  Trash2,
} from "lucide-react";
import { projectSimpleSteppedTrayResult } from "@/lib/tray-result-projection";

interface SimpleSteppedPanelProps {
  params: SimpleSteppedLayoutParams;
  derivedLayout: SimpleSteppedDerivedLayout;
  activeRowId: string | null;
  effectiveDimensions: {
    width: number;
    depth: number;
    height: number;
  };
  actions: ReactNode;
  updateParam: <K extends keyof SimpleSteppedLayoutParams>(
    key: K,
    value: SimpleSteppedLayoutParams[K],
  ) => void;
  onSetActiveRow: (rowId: string | null) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onRenameRow: (rowId: string, name: string) => void;
  onClearRow: (rowId: string) => void;
  onReorderRows: (fromIndex: number, toIndex: number) => void;
  onAddSlotToRow: (rowId: string, diameter: number) => void;
  onTrimTray: () => void;
  isGenerating: boolean;
  isPreviewStale: boolean;
  volume: number;
}

export default function SimpleSteppedPanel({
  params,
  derivedLayout,
  activeRowId,
  effectiveDimensions,
  actions,
  updateParam,
  onSetActiveRow,
  onAddRow,
  onRemoveRow,
  onRenameRow,
  onClearRow,
  onReorderRows,
  onAddSlotToRow,
  onTrimTray,
  isGenerating,
  isPreviewStale,
  volume,
}: SimpleSteppedPanelProps) {
  const result = projectSimpleSteppedTrayResult(
    params,
    derivedLayout,
    effectiveDimensions,
    { volume, isGenerating, isPreviewStale },
  );
  const rowDerivedById = useMemo(
    () => new Map(derivedLayout.activeRows.map((row) => [row.id, row] as const)),
    [derivedLayout.activeRows],
  );
  const activeRow = useMemo(
    () => params.rows.find((row) => row.id === activeRowId) ?? null,
    [activeRowId, params.rows],
  );
  const canTrim =
    derivedLayout.activeRows.length > 0 &&
    (derivedLayout.trayWidth - derivedLayout.minimumTrayWidth > 0.001 ||
      derivedLayout.trayDepth - derivedLayout.minimumTrayDepth > 0.001);
  const spacingSummary = `槽距${params.spacing}mm / 边距${params.outerMarginIndependent ? params.outerMargin : params.spacing}mm`;

  return (
    <PanelShell summary={<TrayResultSummary result={result} />} actions={actions}>
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="iron-panel rounded-sm p-3">
        <SectionHeader
          icon={Rows3}
          title="行管理"
          collapsible
          defaultOpen={true}
          summary={`${params.rows.length} 行 / ${params.slots.length} 个凹槽`}
        >
          <div className="space-y-1.5 mt-1">
            {params.rows.length === 0 ? (
              <div className="dashed-hint rounded-sm px-3 py-4 text-center text-xs text-muted-foreground/70">
                还没有行，先新建一行再开始排布凹槽。
              </div>
            ) : (
              params.rows.map((row, index) => {
                const derived = rowDerivedById.get(row.id) ?? null;
                const isActive = activeRowId === row.id;
                const rowSlotCount = params.slots.filter((slot) => slot.rowId === row.id).length;

                return (
                  <div
                    key={row.id}
                    onClick={() => onSetActiveRow(row.id)}
                    className={`rounded border px-2 py-2 transition-all duration-150 cursor-pointer ${
                      isActive
                        ? "bg-[#1c1a16] border-[#6b5a38]"
                        : "border-transparent hover:bg-[#1c1a16]/50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-sm border border-[#3d372e] bg-[#120f0c] text-[10px] font-mono text-primary/80">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        {isActive ? (
                          <Input
                            value={row.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onRenameRow(row.id, e.target.value)}
                            className="h-8 bg-[#120f0c] border-[#2e2a24]"
                          />
                        ) : (
                          <div className="truncate pt-0.5 text-xs font-medium text-foreground/90">
                            {row.name}
                          </div>
                        )}
                        <div className="mt-1 text-[10px] text-muted-foreground/70">
                          {rowSlotCount} 槽位
                          {derived
                            ? ` / 高度 ${derived.topHeight.toFixed(1)}mm / ${derived.length.toFixed(1)} × ${derived.depth.toFixed(1)} mm`
                            : " / 空行"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderRows(index, index - 1);
                        }}
                        disabled={index === 0}
                        className="mt-0.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                        title="上移"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderRows(index, index + 1);
                        }}
                        disabled={index === params.rows.length - 1}
                        className="mt-0.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                        title="下移"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRow(row.id);
                        }}
                        className="mt-0.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-red-400"
                        title="删除行"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {isActive && (
                      <>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <div className="bg-[#120f0c] border border-[#2e2a24] p-2 text-center">
                            <div className="text-[10px] text-muted-foreground/60">层级</div>
                            <div className="text-sm font-mono font-semibold text-primary">
                              {derived ? derived.index + 1 : "-"}
                            </div>
                          </div>
                          <div className="bg-[#120f0c] border border-[#2e2a24] p-2 text-center">
                            <div className="text-[10px] text-muted-foreground/60">最长边</div>
                            <div className="text-sm font-mono font-semibold text-foreground">
                              {derived ? `${derived.length.toFixed(1)}mm` : "0mm"}
                            </div>
                          </div>
                          <div className="bg-[#120f0c] border border-[#2e2a24] p-2 text-center">
                            <div className="text-[10px] text-muted-foreground/60">行深度</div>
                            <div className="text-sm font-mono font-semibold text-foreground">
                              {derived ? `${derived.depth.toFixed(1)}mm` : "0mm"}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClearRow(row.id);
                            }}
                            className="flex-1 h-8 text-xs border-[#2e2a24] text-muted-foreground hover:bg-[#1c1a16] hover:text-foreground"
                          >
                            清空本行
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onAddRow}
              className="w-full mt-1 h-8 text-xs border-[#3d372e] text-muted-foreground hover:text-foreground hover:border-[#5a5040] transition-[border-color,color,background-color]"
            >
              <Plus className="w-3 h-3 mr-1" />
              新建行
            </Button>
          </div>
        </SectionHeader>
      </div>

      <div className="iron-panel rounded-sm p-3">
        <SectionHeader
          icon={Plus}
          title="添加凹槽"
          collapsible
          defaultOpen={true}
          summary={activeRow ? `添加到 ${activeRow.name}` : "未选中行"}
        >
          <div className="space-y-2 mt-1">
            <div className="dashed-hint rounded-sm px-3 py-2 text-[10px] text-muted-foreground/70">
              画布里现在支持同行上下拖动混排，也可以直接拖动虚线底板边框来放大打印边界。
            </div>
            <div className="text-[10px] text-muted-foreground/70">
              {activeRow ? `新凹槽将加入 ${activeRow.name}` : "请先选择一行"}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {BASE_PRESETS.map((preset) => (
                <Button
                  key={preset.diameter}
                  variant="outline"
                  size="sm"
                  disabled={!activeRow}
                  onClick={() => activeRow && onAddSlotToRow(activeRow.id, preset.diameter)}
                  className="h-10 lg:h-7 text-xs lg:text-[11px] border-[#2e2a24] bg-[#1c1a16] hover:bg-[#2e2a24] hover:text-primary transition-all disabled:opacity-40"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {preset.diameter}
                </Button>
              ))}
            </div>
          </div>
        </SectionHeader>
      </div>

      <div className="iron-panel rounded-sm p-4">
        <SectionHeader
          icon={Ruler}
          title="阶梯结构"
          collapsible
          defaultOpen={false}
          summary={`首排${params.firstRowHeight}mm / 步进${params.stepHeight}mm / 圆角${params.cornerRadius}mm / ${spacingSummary}`}
        >
          <div className="space-y-4">
            <ParamSlider
              label={SIMPLE_STEPPED_LIMITS.firstRowHeight.label}
              value={params.firstRowHeight}
              config={SIMPLE_STEPPED_LIMITS.firstRowHeight}
              onChange={(v) => updateParam("firstRowHeight", v)}
              unit={SIMPLE_STEPPED_LIMITS.firstRowHeight.unit}
            />
            <ParamSlider
              label={SIMPLE_STEPPED_LIMITS.stepHeight.label}
              value={params.stepHeight}
              config={SIMPLE_STEPPED_LIMITS.stepHeight}
              onChange={(v) => updateParam("stepHeight", v)}
              unit={SIMPLE_STEPPED_LIMITS.stepHeight.unit}
            />
            <ParamSlider
              label={SIMPLE_STEPPED_LIMITS.rowGap.label}
              value={params.rowGap}
              config={SIMPLE_STEPPED_LIMITS.rowGap}
              onChange={(v) => updateParam("rowGap", v)}
              unit={SIMPLE_STEPPED_LIMITS.rowGap.unit}
            />
            <ParamSlider
              label={SIMPLE_STEPPED_LIMITS.spacing.label}
              value={params.spacing}
              config={SIMPLE_STEPPED_LIMITS.spacing}
              onChange={(v) => updateParam("spacing", v)}
              unit={SIMPLE_STEPPED_LIMITS.spacing.unit}
            />
            <div className="flex items-center justify-between rounded border border-[#2e2a24] bg-[#1c1a16] p-3">
              <Label htmlFor="simple-stepped-outer-margin-independent" className="text-sm cursor-pointer text-[#f0d8b8]">
                边界间距独立调整
              </Label>
              <Switch
                id="simple-stepped-outer-margin-independent"
                checked={params.outerMarginIndependent}
                onCheckedChange={(checked) => updateParam("outerMarginIndependent", checked)}
                className="data-[state=checked]:bg-[#8cb880]"
              />
            </div>
            {params.outerMarginIndependent && (
              <ParamSlider
                label={SIMPLE_STEPPED_LIMITS.outerMargin.label}
                value={params.outerMargin}
                config={SIMPLE_STEPPED_LIMITS.outerMargin}
                onChange={(v) => updateParam("outerMargin", v)}
                unit={SIMPLE_STEPPED_LIMITS.outerMargin.unit}
              />
            )}
            <ParamSlider
              label={SIMPLE_STEPPED_LIMITS.holeDepth.label}
              value={params.holeDepth}
              config={SIMPLE_STEPPED_LIMITS.holeDepth}
              onChange={(v) => updateParam("holeDepth", v)}
              unit={SIMPLE_STEPPED_LIMITS.holeDepth.unit}
            />
            <ParamSlider
              label={SIMPLE_STEPPED_LIMITS.cornerRadius.label}
              value={params.cornerRadius}
              config={SIMPLE_STEPPED_LIMITS.cornerRadius}
              onChange={(v) => updateParam("cornerRadius", v)}
              unit={SIMPLE_STEPPED_LIMITS.cornerRadius.unit}
            />
            <Button
              variant="outline"
              disabled={!canTrim}
              onClick={onTrimTray}
              className="h-9 w-full border-[#4a6741] text-xs text-[#8cb880] hover:bg-[#1c1a16] hover:text-[#a6d39d] disabled:opacity-40"
            >
              Trim 到凹槽占用区域
            </Button>
          </div>
        </SectionHeader>
      </div>
    </div>
    </PanelShell>
  );
}
