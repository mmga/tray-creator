"use client";

import { useMemo } from "react";
import type {
  SimpleSteppedLayoutParams,
} from "@/types/custom-tray";
import type { SimpleSteppedDerivedLayout } from "@/lib/simple-stepped-layout";
import {
  BASE_PRESETS,
  MAX_BUILD_SIZE,
  SIMPLE_STEPPED_LAYOUT_DEFAULTS,
  SIMPLE_STEPPED_LIMITS,
} from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ParamIOButtons } from "@/components/ParamIOButtons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Layers3,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Rows3,
  Ruler,
  Trash2,
} from "lucide-react";
import { calculateSimpleSteppedPrice, calculateWeight } from "@/lib/pricing";

interface SimpleSteppedPanelProps {
  params: SimpleSteppedLayoutParams;
  derivedLayout: SimpleSteppedDerivedLayout;
  activeRowId: string | null;
  effectiveDimensions: {
    width: number;
    depth: number;
    height: number;
  };
  setParams: React.Dispatch<React.SetStateAction<SimpleSteppedLayoutParams>>;
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
  onRemoveSlot: (slotId: string) => void;
  onGenerate: () => void;
  onExportSTL: () => void;
  isGenerating: boolean;
  isPreviewStale: boolean;
  volume: number;
}

export default function SimpleSteppedPanel({
  params,
  derivedLayout,
  activeRowId,
  effectiveDimensions,
  setParams,
  updateParam,
  onSetActiveRow,
  onAddRow,
  onRemoveRow,
  onRenameRow,
  onClearRow,
  onReorderRows,
  onAddSlotToRow,
  onRemoveSlot,
  onGenerate,
  onExportSTL,
  isGenerating,
  isPreviewStale,
  volume,
}: SimpleSteppedPanelProps) {
  const rowDerivedById = useMemo(
    () => new Map(derivedLayout.activeRows.map((row) => [row.id, row])),
    [derivedLayout.activeRows],
  );
  const activeRow = useMemo(
    () => params.rows.find((row) => row.id === activeRowId) ?? null,
    [activeRowId, params.rows],
  );
  const activeRowDerived = activeRow ? rowDerivedById.get(activeRow.id) ?? null : null;
  const activeRowSlots = useMemo(
    () =>
      activeRow
        ? params.slots
            .filter((slot) => slot.rowId === activeRow.id)
            .slice()
            .sort((a, b) => a.x - b.x)
        : [],
    [activeRow, params.slots],
  );
  const isOversized =
    effectiveDimensions.width > MAX_BUILD_SIZE ||
    effectiveDimensions.depth > MAX_BUILD_SIZE;

  const handleReset = () => {
    setParams(SIMPLE_STEPPED_LAYOUT_DEFAULTS);
    onSetActiveRow(null);
  };

  return (
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
              <div className="rounded border border-dashed border-[#3d372e] px-3 py-4 text-center text-xs text-muted-foreground/70">
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
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-sm border border-[#3d372e] bg-[#120f0c] text-[10px] font-mono text-primary/80">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-foreground/90">
                          {row.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground/70">
                          {rowSlotCount} 槽位
                          {derived
                            ? ` / ${derived.length.toFixed(1)} × ${derived.depth.toFixed(1)} mm`
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
                        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
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
                        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
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
                        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-red-400"
                        title="删除行"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onAddRow}
              className="w-full mt-1 h-8 text-xs border-dashed border-[#3d372e] text-muted-foreground hover:text-foreground hover:border-[#5a5040] transition-all"
            >
              <Plus className="w-3 h-3 mr-1" />
              新建行
            </Button>
          </div>
        </SectionHeader>
      </div>

      <div className="iron-panel rounded-sm p-3">
        <SectionHeader
          icon={Layers3}
          title="当前行"
          collapsible
          defaultOpen={true}
          summary={activeRow ? activeRow.name : "未选中行"}
        >
          {activeRow ? (
            <div className="space-y-3 mt-1">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                  行名称
                </label>
                <Input
                  value={activeRow.name}
                  onChange={(e) => onRenameRow(activeRow.id, e.target.value)}
                  className="h-8 bg-[#1c1a16] border-[#2e2a24]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1c1a16] border border-[#2e2a24] p-2 text-center">
                  <div className="text-[10px] text-muted-foreground/60">阶梯层级</div>
                  <div className="text-sm font-mono font-semibold text-primary">
                    {activeRowDerived ? activeRowDerived.index + 1 : "-"}
                  </div>
                </div>
                <div className="bg-[#1c1a16] border border-[#2e2a24] p-2 text-center">
                  <div className="text-[10px] text-muted-foreground/60">顶部高度</div>
                  <div className="text-sm font-mono font-semibold text-primary">
                    {activeRowDerived ? `${activeRowDerived.topHeight.toFixed(1)}mm` : "待定"}
                  </div>
                </div>
                <div className="bg-[#1c1a16] border border-[#2e2a24] p-2 text-center">
                  <div className="text-[10px] text-muted-foreground/60">长度</div>
                  <div className="text-sm font-mono font-semibold text-foreground">
                    {activeRowDerived ? `${activeRowDerived.length.toFixed(1)}mm` : "0mm"}
                  </div>
                </div>
                <div className="bg-[#1c1a16] border border-[#2e2a24] p-2 text-center">
                  <div className="text-[10px] text-muted-foreground/60">深度</div>
                  <div className="text-sm font-mono font-semibold text-foreground">
                    {activeRowDerived ? `${activeRowDerived.depth.toFixed(1)}mm` : "0mm"}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                  行内凹槽
                </div>
                {activeRowSlots.length === 0 ? (
                  <div className="rounded border border-dashed border-[#3d372e] px-3 py-3 text-xs text-muted-foreground/70">
                    当前行还没有凹槽。
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {activeRowSlots.map((slot, index) => (
                      <div
                        key={slot.id}
                        className="flex items-center gap-2 rounded border border-[#2e2a24] bg-[#1c1a16] px-2 py-1.5"
                      >
                        <div className="text-[10px] font-mono text-muted-foreground/60">
                          #{index + 1}
                        </div>
                        <div className="flex-1 text-xs text-foreground/90">
                          {slot.diameter} mm
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/60">
                          x={slot.x.toFixed(1)}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveSlot(slot.id)}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-red-400"
                          title="删除凹槽"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onClearRow(activeRow.id)}
                  className="flex-1 h-8 text-xs border-[#2e2a24] text-muted-foreground hover:bg-[#1c1a16] hover:text-foreground"
                >
                  清空本行
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onRemoveRow(activeRow.id)}
                  className="flex-1 h-8 text-xs border-[#4f2626] text-[#d38a8a] hover:bg-[#2a1515] hover:text-[#f0b0b0]"
                >
                  删除本行
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded border border-dashed border-[#3d372e] px-3 py-4 text-center text-xs text-muted-foreground/70 mt-1">
              先选中一行，再编辑行名称和行内凹槽。
            </div>
          )}
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
          title="结构参数"
          collapsible
          defaultOpen={false}
          summary={`步进${params.stepHeight}mm / 行距${params.rowGap}mm / 槽距${params.spacing}mm`}
        >
          <div className="space-y-4">
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
            <ParamSlider
              label={SIMPLE_STEPPED_LIMITS.outerMargin.label}
              value={params.outerMargin}
              config={SIMPLE_STEPPED_LIMITS.outerMargin}
              onChange={(v) => updateParam("outerMargin", v)}
              unit={SIMPLE_STEPPED_LIMITS.outerMargin.unit}
            />
            <ParamSlider
              label={SIMPLE_STEPPED_LIMITS.holeDepth.label}
              value={params.holeDepth}
              config={SIMPLE_STEPPED_LIMITS.holeDepth}
              onChange={(v) => updateParam("holeDepth", v)}
              unit={SIMPLE_STEPPED_LIMITS.holeDepth.unit}
            />
          </div>
        </SectionHeader>
      </div>

      <div className={`iron-panel rounded-sm p-4 transition-all duration-300 ${isOversized ? "border-[#8b1a1a] animate-forge-pulse" : ""}`}>
        <SectionHeader
          icon={Ruler}
          title="统计信息"
          collapsible
          defaultOpen={false}
          summary={`${params.rows.length}行 / ${params.slots.length}槽 / ${effectiveDimensions.width.toFixed(0)}×${effectiveDimensions.depth.toFixed(0)}mm`}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
                <span className="text-[10px] text-muted-foreground block">行数 / 有效行</span>
                <span className="text-lg font-mono font-bold text-primary">
                  {params.rows.length} / {derivedLayout.activeRows.length}
                </span>
              </div>
              <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
                <span className="text-[10px] text-muted-foreground block">报价 & 耗材参考</span>
                <div className="flex flex-col items-center mt-0.5">
                  <span className="text-sm font-mono font-bold text-[#eab308]">
                    ¥{calculateSimpleSteppedPrice(params, volume).toFixed(1)}
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
                { label: "长度", value: effectiveDimensions.width, warn: effectiveDimensions.width > MAX_BUILD_SIZE },
                { label: "深度", value: effectiveDimensions.depth, warn: effectiveDimensions.depth > MAX_BUILD_SIZE },
                { label: "高度", value: effectiveDimensions.height, warn: false },
              ].map(({ label, value, warn }) => (
                <div
                  key={label}
                  className={`relative text-center p-2.5 transition-colors duration-200 ${
                    warn
                      ? "bg-[#8b1a1a15] border border-[#8b1a1a50]"
                      : "bg-[#1c1a16] border border-[#2e2a24]"
                  }`}
                >
                  <p className="text-[11px] text-muted-foreground/60 mb-0.5">{label}</p>
                  <p className={`text-sm font-mono font-semibold tabular-nums ${warn ? "text-[#c04040]" : "text-foreground"}`}>
                    {value.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 font-mono">mm</p>
                </div>
              ))}
            </div>
            {isOversized && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-[#c04040] animate-fade-in">
                <span>超过锻造极限</span>
              </div>
            )}
          </div>
        </SectionHeader>
      </div>

      <div className="wh-divider" />

      <div className="flex flex-col gap-2.5 pb-4">
        {isPreviewStale && (
          <div className="rounded border border-[#5a4a2a] bg-[#2a2518]/90 px-3 py-2 text-xs text-[#c8a84e]">
            当前预览已过期，请点击“开始锻造”生成最新模型。
          </div>
        )}
        <Button
          onClick={onGenerate}
          disabled={isGenerating || isOversized}
          className="w-full h-11 blood-red text-sm text-[#f0d8b8] font-bold tracking-wider cursor-pointer border border-[#a02020] shadow-lg shadow-[#8b1a1a30] hover:shadow-xl hover:shadow-[#8b1a1a50] hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          {isGenerating ? "锻造中..." : isOversized ? "尺寸超限" : "开始锻造"}
        </Button>
        <Button
          onClick={onExportSTL}
          className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-sm text-[#8cb880] font-semibold tracking-wider cursor-pointer border border-[#4a6741] shadow-lg shadow-[#2a352830]"
        >
          <Download className="w-4 h-4 mr-2" />
          导出 STL
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          className="w-full h-11 lg:h-9 text-sm border-[#2e2a24] text-muted-foreground tracking-wider cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e]"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          重置参数
        </Button>
        <ParamIOButtons
          mode="simple-stepped"
          params={params}
          onImport={(p) => setParams(p as SimpleSteppedLayoutParams)}
        />
      </div>
    </div>
  );
}
