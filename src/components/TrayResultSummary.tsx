"use client";

import { ResultSummary } from "@/components/ResultSummary";
import { SteppedPricingFormulaTooltip } from "@/components/SteppedPricingFormulaTooltip";
import type { TrayResultProjection } from "@/lib/tray-result-projection";

interface TrayResultSummaryProps {
  result: TrayResultProjection;
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#2e2a24] bg-[#1c1a16] p-2 text-center">
      <div className="text-[9px] text-muted-foreground/60">{label}</div>
      <div className="mt-0.5 font-mono text-xs font-semibold text-foreground/90">
        {value}
      </div>
    </div>
  );
}

function modeSpecificMetrics(result: TrayResultProjection) {
  switch (result.mode) {
    case "grid":
      return (
        <>
          <ResultMetric label="行列" value={`${result.columns} × ${result.rows}`} />
          <ResultMetric label="占地面积" value={`${result.footprintArea.toFixed(0)} mm²`} />
        </>
      );
    case "custom":
      return (
        <>
          <ResultMetric
            label="尺寸语义"
            value={
              result.footprintKind === "fixed-outer-footprint"
                ? "固定外轮廓"
                : "有效底板"
            }
          />
          <ResultMetric label="占地面积" value={`${result.footprintArea.toFixed(0)} mm²`} />
        </>
      );
    case "simple-stepped":
      return (
        <>
          <ResultMetric
            label="行数 / 有效行"
            value={`${result.rowCount} / ${result.activeRowCount}`}
          />
          <ResultMetric
            label="最小底板"
            value={`${result.minimumBaseplate.width.toFixed(1)} × ${result.minimumBaseplate.depth.toFixed(1)} mm`}
          />
        </>
      );
    case "stepped":
    case "stepped-cad":
      return (
        <>
          <ResultMetric label="分组" value={`${result.groupCount}`} />
          <ResultMetric
            label="预估机时"
            value={`${result.pricing.estimatedPrintHours.toFixed(1)} h`}
          />
          <div className="col-span-2 space-y-1.5 border border-[#2e2a24] bg-[#1c1a16] p-2">
            <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground/60">
              <span>报价公式</span>
              <SteppedPricingFormulaTooltip
                breakdown={result.pricing}
                hasGeneratedVolume={result.weight.status === "available"}
              />
            </div>
            {result.groups.length > 1 ? (
              <div className="space-y-1">
                {result.groups.map((group) => (
                  <div key={group.id} className="flex items-center gap-2 text-[10px]">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ background: group.color }}
                    />
                    <span className="truncate text-muted-foreground">{group.name}</span>
                    <span className="font-mono" style={{ color: group.color }}>
                      ↑{group.bottomHeight}mm
                    </span>
                    <span className="ml-auto text-muted-foreground">{group.slotCount} 个</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      );
  }
}

export function TrayResultSummary({ result }: TrayResultSummaryProps) {
  const { dimensions } = result;
  const price = `¥${result.quote.amount.toFixed(result.quote.fractionDigits)}`;
  const weight =
    result.weight.status === "available"
      ? `${result.weight.grams.toFixed(1)} g`
      : result.generating
        ? "生成中"
        : "待锻造";

  const details = (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        <ResultMetric label="长度" value={`${dimensions.width.toFixed(1)} mm`} />
        <ResultMetric label="宽度" value={`${dimensions.depth.toFixed(1)} mm`} />
        <ResultMetric label="高度" value={`${dimensions.height.toFixed(1)} mm`} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <ResultMetric label="槽位数" value={`${result.slotCount}`} />
        <ResultMetric label="耗材参考" value={weight} />
        {modeSpecificMetrics(result)}
      </div>
      {result.buildLimit.oversized ? (
        <div className="text-[10px] text-[#d75b5b]">
          超过常规打印尺寸 {result.buildLimit.maxSize} × {result.buildLimit.maxSize} mm，仍可继续建模。
        </div>
      ) : null}
    </div>
  );

  return (
    <ResultSummary
      itemLabel={result.itemLabel}
      dimensions={[dimensions.width, dimensions.depth, dimensions.height]}
      price={price}
      oversized={result.buildLimit.oversized}
      generating={result.generating}
      stale={result.stale}
      details={details}
    />
  );
}
