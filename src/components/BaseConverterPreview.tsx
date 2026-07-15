"use client";

import { useId } from "react";
import type { BaseConverterParams } from "@/types/custom-tray";
import { resolveBaseConverterGeometry } from "@/lib/base-converter-config";

export function BaseConverterPreview({ params }: { params: BaseConverterParams }) {
  const clipId = useId().replace(/:/g, "");
  const { source, target, recess } = resolveBaseConverterGeometry(params);
  const margin = Math.max(target.width, target.depth) * 0.12 + 4;
  const viewBox = `${-target.width / 2 - margin} ${-target.depth / 2 - margin} ${target.width + margin * 2} ${target.depth + margin * 2}`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0d0b09]">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          backgroundPosition: "center",
        }}
      />
      <svg
        viewBox={viewBox}
        className="relative z-10 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-label="转换底盘 2D 图"
      >
        <defs>
          <clipPath id={clipId}>
            <ellipse rx={target.width / 2} ry={target.depth / 2} />
          </clipPath>
        </defs>
        <ellipse
          rx={target.width / 2}
          ry={target.depth / 2}
          fill="rgba(214, 168, 79, 0.28)"
          stroke="#d6a84f"
          strokeWidth={0.8}
        />
        <rect
          x={-recess.width / 2}
          y={-recess.depth / 2}
          width={recess.width}
          height={recess.depth}
          clipPath={`url(#${clipId})`}
          fill="rgba(14, 13, 11, 0.86)"
          stroke="#f0d8b8"
          strokeWidth={0.5}
        />
        <line x1={-target.width / 2} y1={0} x2={target.width / 2} y2={0} stroke="#8b7355" strokeWidth={0.2} strokeDasharray="1 1" />
        <line x1={0} y1={-target.depth / 2} x2={0} y2={target.depth / 2} stroke="#8b7355" strokeWidth={0.2} strokeDasharray="1 1" />
      </svg>
      <div className="absolute bottom-3 left-3 z-20 rounded-sm border border-[#2e2a24] bg-[#100d0a]/90 px-3 py-1.5 font-mono text-xs text-[#d8d1c5]">
        {source.name} → {target.name} · 凹槽 {recess.width.toFixed(1)} × {recess.depth.toFixed(1)} mm
      </div>
    </div>
  );
}
