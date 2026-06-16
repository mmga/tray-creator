"use client";

import { Ruler } from "lucide-react";
import { MAX_BUILD_SIZE } from "@/lib/config";
import { SectionHeader } from "@/components/ui/SectionHeader";

export interface StatsCardDimension {
  label: string;
  value: number;
  warn: boolean;
}

export interface StatsCardProps {
  /** SectionHeader 标题（默认"统计信息"） */
  title?: string;
  /** SectionHeader 折叠状态下的摘要文案 */
  summary: string;
  /** 凹槽数量卡的主数值（数字或字符串） */
  slotCount: number | string;
  /** 凹槽数量卡标签 */
  slotCountLabel?: string;
  /** 报价金额（已格式化） */
  price: string;
  /** 估重文案（如 "12.3g"），或生成中/空状态文案 */
  weightLabel: string;
  weightVisible: boolean;
  weightGeneratingText?: string;
  /** 宽/深/高三宫格 */
  dimensions: [StatsCardDimension, StatsCardDimension, StatsCardDimension];
  /** 是否超限（控制面板边框脉冲） */
  oversized: boolean;
  /** 额外内容插槽（如有效底板尺寸行、最小底板格等） */
  children?: React.ReactNode;
}

/**
 * 各模式 Panel 共享的统计信息块。
 *
 * 提取自 ParameterPanel / CustomPanel / SimpleSteppedPanel / SteppedPanel
 * 中逐字复制的"凹槽数量卡 + 报价卡 + 宽深高三宫格 + 超限警告"结构。
 * 各模式的差异（标题文案、数值来源、额外区块）通过 props 参数化。
 */
export function StatsCard({
  title = "统计信息",
  summary,
  slotCount,
  slotCountLabel = "凹槽数量",
  price,
  weightLabel,
  weightVisible,
  weightGeneratingText = "",
  dimensions,
  oversized,
  children,
}: StatsCardProps) {
  return (
    <div
      className={`iron-panel rounded-sm p-4 transition-all duration-300 ${oversized ? "border-[#8b1a1a] animate-forge-pulse" : ""}`}
    >
      <SectionHeader
        icon={Ruler}
        title={title}
        collapsible
        defaultOpen={false}
        summary={summary}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
              <span className="text-[10px] text-muted-foreground block">{slotCountLabel}</span>
              <span className="text-lg font-mono font-bold text-primary">{slotCount}</span>
            </div>
            <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
              <span className="text-[10px] text-muted-foreground block">预估报价 &amp; 耗材参考</span>
              <div className="flex flex-col items-center mt-0.5">
                <span className="text-sm font-mono font-bold text-[#eab308]">{price}</span>
                <span className="text-[9px] text-muted-foreground">
                  {weightVisible ? weightLabel : weightGeneratingText}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {dimensions.map(({ label, value, warn }) => (
              <div
                key={label}
                className={`relative text-center p-2.5 transition-colors duration-200 ${warn ? "bg-[#8b1a1a15] border border-[#8b1a1a50]" : "bg-[#1c1a16] border border-[#2e2a24]"}`}
              >
                <p className="text-[11px] text-muted-foreground/60 mb-0.5">{label}</p>
                <p
                  className={`text-sm font-mono font-semibold tabular-nums ${warn ? "text-[#c04040]" : "text-foreground"}`}
                >
                  {value.toFixed(1)}
                </p>
                <p className="text-[10px] text-muted-foreground/40 font-mono">mm</p>
              </div>
            ))}
          </div>

          {oversized && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-[#c04040] animate-fade-in">
              <span>超过锻造极限 ({MAX_BUILD_SIZE}×{MAX_BUILD_SIZE}mm)</span>
            </div>
          )}

          {children}
        </div>
      </SectionHeader>
    </div>
  );
}
