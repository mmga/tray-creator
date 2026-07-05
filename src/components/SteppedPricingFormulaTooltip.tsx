"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import type { SteppedPricingBreakdown } from "@/lib/pricing";

export function SteppedPricingFormulaTooltip({
  breakdown,
  hasGeneratedVolume,
}: {
  breakdown: SteppedPricingBreakdown;
  hasGeneratedVolume: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocusCapture={() => setIsOpen(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label="查看阶梯底座报价公式"
        title="查看阶梯底座报价公式"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#5a4a2a] text-[#c8a84e] transition-colors hover:border-[#7a6a3a] hover:text-[#e0c870] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8a84e]"
      >
        <CircleHelp className="h-3 w-3" />
      </button>
      {isOpen ? (
        <div
          role="tooltip"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-72 rounded border border-[#5a4a2a] bg-[#15110d] p-3 text-left shadow-xl shadow-black/40"
        >
          <div className="text-[11px] font-semibold tracking-wide text-[#f3dfb6]">
            阶梯底座报价公式
          </div>
          <div className="mt-1 font-mono text-[10px] leading-relaxed text-[#ddd3c2]">
            价格 = round(1 + 0.10 × 估重 + 6.5 × 机时 + 占地 / 7000 + 复杂度)
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            估重 = 真实体积(cm³) × 有效打印密度(g/cm³)
          </div>
          {hasGeneratedVolume ? (
            <>
              <div className="mt-2 text-[10px] text-muted-foreground">当前代入</div>
              <div className="mt-1 font-mono text-[10px] leading-relaxed text-[#e6dccb]">
                = round(
                1 + 0.10 × {breakdown.estimatedWeight.toFixed(1)}
                + 6.5 × {breakdown.estimatedPrintHours.toFixed(2)}
                + {breakdown.footprintAreaMm2.toFixed(0)} / 7000
                + {breakdown.complexityFee.toFixed(1)})
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span>估重</span>
                <span className="text-right font-mono text-foreground">
                  {breakdown.estimatedWeight.toFixed(1)}g
                </span>
                <span>机时</span>
                <span className="text-right font-mono text-foreground">
                  {breakdown.estimatedPrintHours.toFixed(2)}h
                </span>
                <span>占地</span>
                <span className="text-right font-mono text-foreground">
                  {breakdown.effectiveWidth.toFixed(1)}×{breakdown.effectiveDepth.toFixed(1)}mm
                </span>
                <span>复杂度费</span>
                <span className="text-right font-mono text-foreground">
                  {breakdown.complexityFee.toFixed(1)}
                </span>
                <span>打印密度</span>
                <span className="text-right font-mono text-foreground">
                  {breakdown.materialDensityGPerCm3.toFixed(3)} g/cm³
                </span>
                <span>最终报价</span>
                <span className="text-right font-mono font-semibold text-[#eab308]">
                  ¥{breakdown.price.toFixed(0)}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              生成模型后会按当前体积估重，并同步计算机时、占地与复杂度。
            </div>
          )}
          <div className="mt-2 border-t border-[#3d372e] pt-2 text-[10px] leading-relaxed text-muted-foreground">
            复杂度 = 2 × 超出 3 档高度 + 2 × 超出 1 种直径 + 0.5 × 40-59mm 槽数
            + 5.65 × 60mm+ 槽数 + 3 × 大平滑 + 1.5 × 断连
          </div>
        </div>
      ) : null}
    </div>
  );
}
