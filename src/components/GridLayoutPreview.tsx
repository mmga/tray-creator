"use client";

import type { TrayParams } from "@/types/tray";
import {
  calculateTrayDimensions,
  getGridBoundarySpacingAxes,
  getGridSpacingAxes,
} from "@/lib/tray-model";
import { getLegacyCircleSlotDiameter } from "@/lib/slot-definitions";
import { getCanvasDashAttributes } from "@/lib/canvas-dash-styles";

interface GridLayoutPreviewProps {
  params: TrayParams;
}

export function GridLayoutPreview({ params }: GridLayoutPreviewProps) {
  const boundaryDash = getCanvasDashAttributes("boundary", 1);
  const dimensions = calculateTrayDimensions(params);
  const actualHoleDiameter =
    typeof params.slotDiameter === "number" && Number.isFinite(params.slotDiameter)
      ? params.slotDiameter
      : getLegacyCircleSlotDiameter(params.holeDiameter);
  const radius = actualHoleDiameter / 2;
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  const { boundarySpacingX, boundarySpacingY } =
    getGridBoundarySpacingAxes(params);
  const padding = 24;
  const safeBevelWidth = Math.max(
    0,
    Math.min(
      params.sideBevelWidth,
      dimensions.width / 2 - 0.1,
      dimensions.depth / 2 - 0.1,
    ),
  );
  const showSideBevel = safeBevelWidth > 0;
  const viewBox = `${-padding} ${-padding} ${dimensions.width + padding * 2} ${
    dimensions.depth + padding * 2
  }`;
  const slots = Array.from({ length: params.rows * params.columns }, (_, index) => {
    const row = Math.floor(index / params.columns);
    const col = index % params.columns;
    return {
      id: `${row}-${col}`,
      x:
        safeBevelWidth +
        boundarySpacingX +
        radius +
        col * (actualHoleDiameter + spacingX),
      y: dimensions.depth - (
        safeBevelWidth +
        boundarySpacingY +
        radius +
        row * (actualHoleDiameter + spacingY)
      ),
    };
  });

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-[#120f0c]">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#1c1a16]">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            backgroundPosition: "center",
          }}
        />
        <svg
          viewBox={viewBox}
          className="relative z-10 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          aria-label="网格模式 2D 图"
        >
          <rect
            x={0}
            y={0}
            width={dimensions.width}
            height={dimensions.depth}
            rx={Math.max(
              0,
              Math.min(
                params.cornerRadius,
                dimensions.width / 2,
                dimensions.depth / 2,
              ),
            )}
            fill="rgba(139, 115, 85, 0.1)"
            stroke="#8b7355"
            strokeWidth={0.8}
          />
          {showSideBevel && (
            <g pointerEvents="none">
              <rect
                x={safeBevelWidth}
                y={safeBevelWidth}
                width={dimensions.width - safeBevelWidth * 2}
                height={dimensions.depth - safeBevelWidth * 2}
                rx={Math.max(
                  0,
                  Math.min(
                    params.cornerRadius - safeBevelWidth,
                    (dimensions.width - safeBevelWidth * 2) / 2,
                    (dimensions.depth - safeBevelWidth * 2) / 2,
                  ),
                )}
                fill="none"
                stroke="#d6a84f"
                {...boundaryDash}
                data-bevel-edge="upper"
              />
            </g>
          )}
          {!params.basePlateOnly &&
            slots.map((slot) => (
              <circle
                key={slot.id}
                cx={slot.x}
                cy={slot.y}
                r={radius}
                fill="#eab308"
                fillOpacity={0.65}
                stroke="#fff"
                strokeWidth={0.3}
              />
            ))}
        </svg>
        <div className="absolute bottom-3 left-3 z-20 rounded-sm border border-[#2e2a24] bg-[#100d0a]/90 px-3 py-1.5 font-mono text-xs text-[#d8d1c5]">
          {dimensions.width.toFixed(1)} × {dimensions.depth.toFixed(1)} mm
        </div>
      </div>
    </div>
  );
}
