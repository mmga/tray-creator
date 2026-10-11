"use client";

import type { TrayParams } from "@/types/tray";
import {
  calculateTrayDimensions,
  getGridSlotPitchAxes,
  shouldRemoveGridIslands,
} from "@/lib/tray-model";
import { getCanvasDashAttributes } from "@/lib/canvas-dash-styles";
import {
  calculateBoxUsableArea,
  resolveStackableBoxParams,
  STACKABLE_BOX_SPECS,
} from "@/lib/stackable-box";
import {
  getGridBoundarySpacingAxes,
  getGridBoxContentSize,
  getGridCutGeometry,
  isGridSlotWithinBox,
} from "@/lib/grid-layout-math";

interface GridLayoutPreviewProps {
  params: TrayParams;
}

export function GridLayoutPreview({ params }: GridLayoutPreviewProps) {
  const boundaryDash = getCanvasDashAttributes("boundary", 1);
  const box = resolveStackableBoxParams(params.stackableBox);
  const dimensions = box.enabled
    ? { width: box.outerWidth, depth: box.outerDepth }
    : calculateTrayDimensions(params);
  const slotGeometry = getGridCutGeometry(params);
  const { pitchX, pitchY } = getGridSlotPitchAxes(params);
  const { boundarySpacingX, boundarySpacingY } =
    getGridBoundarySpacingAxes(params);
  const padding = 24;
  const safeBevelWidth = box.enabled ? 0 : Math.max(
    0,
    Math.min(
      params.sideBevelWidth,
      dimensions.width / 2 - 0.1,
      dimensions.depth / 2 - 0.1,
    ),
  );
  const showSideBevel = safeBevelWidth > 0;
  const removeGridIslands = shouldRemoveGridIslands(params);
  const boxContent = box.enabled ? getGridBoxContentSize(params) : undefined;
  const usableArea = box.enabled ? calculateBoxUsableArea(box) : undefined;
  const viewBox = `${-padding} ${-padding} ${dimensions.width + padding * 2} ${
    dimensions.depth + padding * 2
  }`;
  const slots = Array.from({ length: params.rows * params.columns }, (_, index) => {
    const row = Math.floor(index / params.columns);
    const col = index % params.columns;
    const contentOffsetX = box.enabled
      ? (dimensions.width - boxContent!.contentWidth) / 2
      : safeBevelWidth + boundarySpacingX;
    const contentOffsetY = box.enabled
      ? (dimensions.depth - boxContent!.contentDepth) / 2
      : safeBevelWidth + boundarySpacingY;
    return {
      id: `${row}-${col}`,
      x:
        contentOffsetX + slotGeometry.slotWidth / 2 + col * pitchX,
      y: dimensions.depth - (contentOffsetY + slotGeometry.slotHeight / 2 + row * pitchY),
      outsideBox: box.enabled && !isGridSlotWithinBox(params, row, col),
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
            data-box-frame={box.enabled ? "true" : undefined}
            x={0}
            y={0}
            width={dimensions.width}
            height={dimensions.depth}
            rx={box.enabled ? STACKABLE_BOX_SPECS.outerCornerRadius : Math.max(
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
          {usableArea ? (
            <rect
              data-box-usable-area="true"
              x={usableArea.x}
              y={dimensions.depth - usableArea.y - usableArea.depth}
              width={usableArea.width}
              height={usableArea.depth}
              rx={usableArea.cornerRadius}
              fill="none"
              stroke="#d6a84f"
              {...boundaryDash}
            />
          ) : null}
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
          {!params.basePlateOnly && (
            <g opacity={removeGridIslands ? 0.65 : undefined}>
              {slots.map((slot) => (
                slotGeometry.shape === "circle" ? (
                  <circle
                    key={slot.id}
                    cx={slot.x}
                    cy={slot.y}
                    r={slotGeometry.slotWidth / 2}
                    fill={slot.outsideBox ? "#ef4444" : "#eab308"}
                    fillOpacity={removeGridIslands ? 1 : 0.65}
                    stroke="#fff"
                    strokeWidth={0.3}
                  />
                ) : (
                  <rect
                    key={slot.id}
                    x={slot.x - slotGeometry.slotWidth / 2}
                    y={slot.y - slotGeometry.slotHeight / 2}
                    width={slotGeometry.slotWidth}
                    height={slotGeometry.slotHeight}
                    fill={slot.outsideBox ? "#ef4444" : "#eab308"}
                    fillOpacity={removeGridIslands ? 1 : 0.65}
                    stroke="#fff"
                    strokeWidth={0.3}
                  />
                )
              ))}
              {removeGridIslands && (
                <rect
                  data-grid-island-cut
                  x={safeBevelWidth + boundarySpacingX + slotGeometry.slotWidth / 2}
                  y={safeBevelWidth + boundarySpacingY + slotGeometry.slotHeight / 2}
                  width={(params.columns - 1) * pitchX}
                  height={(params.rows - 1) * pitchY}
                  fill="#eab308"
                />
              )}
            </g>
          )}
        </svg>
        <div className="absolute bottom-3 left-3 z-20 rounded-sm border border-[#2e2a24] bg-[#100d0a]/90 px-3 py-1.5 font-mono text-xs text-[#d8d1c5]">
          {dimensions.width.toFixed(1)} × {dimensions.depth.toFixed(1)} mm
        </div>
      </div>
    </div>
  );
}
