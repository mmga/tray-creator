"use client";

import { ResultSummary } from "@/components/ResultSummary";
import type {
  TrayResultProjection,
  TrayResultWeight,
} from "@/lib/tray-result-projection";

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

function weightText(weight: TrayResultWeight, fallback: string): string {
  return weight.status === "available"
    ? `${weight.grams.toFixed(1)} g`
    : fallback;
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
    case "base-converter":
      if (result.generationKind === "plain") {
        return (
          <>
            <ResultMetric label="类型" value="普通底盘" />
            <ResultMetric label="规格" value={result.targetLabel} />
          </>
        );
      }
      if (result.generationKind === "push-fit" && result.hole) {
        return (
          <>
            <ResultMetric label="类型" value="简版底盘" />
            <ResultMetric label="规格" value={result.targetLabel} />
            <ResultMetric label="六边孔对边" value={`${result.hole.acrossFlats.toFixed(2)} mm`} />
            <ResultMetric label="孔中心 X/Y" value={`${result.hole.offsetX.toFixed(1)} / ${result.hole.offsetY.toFixed(1)} mm`} />
          </>
        );
      }
      return (
        <>
          <ResultMetric label="原底盘" value={result.sourceLabel} />
          <ResultMetric label="目标底盘" value={result.targetLabel} />
          <ResultMetric
            label="最终凹槽"
            value={`${result.recess.width.toFixed(1)} × ${result.recess.depth.toFixed(1)} mm`}
          />
        </>
      );
    case "stepped":
      return (
        <div className="col-span-2 space-y-1.5 border border-[#2e2a24] bg-[#1c1a16] p-2">
          <div className="text-center text-[9px] text-muted-foreground/60">
            {result.groupCount} 个分组
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
      );
  }
}

export function TrayResultSummary({ result }: TrayResultSummaryProps) {
  const { dimensions } = result;
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
        <ResultMetric
          label={result.mode === "base-converter" ? "底盘数" : "槽位数"}
          value={`${result.slotCount}`}
        />
        <ResultMetric label="耗材参考" value={weight} />
        {modeSpecificMetrics(result)}
      </div>
      {result.box ? (
        <div className="space-y-1.5 border border-[#2e2a24] bg-[#1c1a16] p-2">
          <div className="grid grid-cols-2 gap-1.5">
            <ResultMetric
              label="闭合外高"
              value={`${result.box.closedOuterHeight.toFixed(1)} mm`}
            />
            <ResultMetric
              label="带盖净高"
              value={`${result.box.lidClearHeight.toFixed(1)} mm`}
            />
            <ResultMetric
              label="堆叠净高"
              value={`${result.box.stackClearHeight.toFixed(1)} mm`}
            />
            <ResultMetric
              label="盒体耗材"
              value={weightText(result.box.bodyWeight, weight)}
            />
            <ResultMetric
              label="盖子耗材"
              value={weightText(result.box.lidWeight, "待锻造")}
            />
            <ResultMetric
              label="定位间隙"
              value={`${result.box.xyFitClearance.toFixed(2)} mm / 侧`}
            />
          </div>
        </div>
      ) : null}
      {result.buildLimit.oversized ? (
        <div className="text-[10px] text-[#d75b5b]">
          超过常规打印尺寸 {result.buildLimit.maxSize} × {result.buildLimit.maxSize} mm，仍可继续建模。
        </div>
      ) : null}
      {result.footprintWarnings?.map((warning, index) => (
        <div
          key={`${warning}-${index}`}
          className="rounded border border-[#7c5a1c] bg-[#2a2115]/70 px-2 py-1.5 text-[10px] text-[#f0d8b8]"
        >
          贴合轮廓警告：{warning}
        </div>
      ))}
    </div>
  );

  return (
    <ResultSummary
      itemLabel={result.itemLabel}
      dimensions={[dimensions.width, dimensions.depth, dimensions.height]}
      oversized={result.buildLimit.oversized}
      generating={result.generating}
      stale={result.stale}
      details={details}
    />
  );
}
