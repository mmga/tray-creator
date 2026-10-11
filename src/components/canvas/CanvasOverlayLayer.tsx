"use client";

import { memo } from "react";

import { getCanvasDashAttributes } from "@/lib/canvas-dash-styles";
import type { CanvasCollisionState } from "@/lib/canvas-collision-model";
import type { CanvasEffectiveBaseplate } from "@/lib/canvas-slot-geometry";
import type { FixedCustomTrayUsableArea } from "@/lib/custom-layout-math";
import type { CanvasGuideLine } from "@/lib/canvas-types";
import type {
  FreeSlot,
  GroupOutlinePreview,
  SteppedSlot,
} from "@/types/custom-tray";

interface CanvasOverlayLayerProps {
  trayWidth: number;
  trayDepth: number;
  zoom: number;
  minX: number;
  minY: number;
  viewW: number;
  viewH: number;
  showEffectiveBaseplate: boolean;
  effectiveBaseplate: CanvasEffectiveBaseplate;
  fixedUsableArea?: FixedCustomTrayUsableArea;
  cornerRadius?: number;
  sideBevelWidth?: number;
  symmetryAxes: { vertical: number; horizontal: number } | null;
  collisionState: CanvasCollisionState<FreeSlot | SteppedSlot>;
  focusedGroupId?: string | null;
  guideLines: readonly CanvasGuideLine[];
  outlinePreview?: GroupOutlinePreview[] | null;
}

export const CanvasOverlayLayer = memo(function CanvasOverlayLayer({
  trayWidth,
  trayDepth,
  zoom,
  minX,
  minY,
  viewW,
  viewH,
  showEffectiveBaseplate,
  effectiveBaseplate,
  fixedUsableArea,
  cornerRadius = 0,
  sideBevelWidth = 0,
  symmetryAxes,
  collisionState,
  focusedGroupId,
  guideLines,
  outlinePreview,
}: CanvasOverlayLayerProps) {
  const boundaryDash = getCanvasDashAttributes("boundary", zoom);
  const guideDash = getCanvasDashAttributes("guide", zoom);
  const alertDash = getCanvasDashAttributes("alert", zoom);
  const hasFixedBoundaryViolation = Array.from(
    collisionState.collisionMap.values(),
  ).some((info) => info.boundaryReasons.length > 0);
  const fixedUsableAreaMatchesTray =
    fixedUsableArea !== undefined &&
    Math.abs(fixedUsableArea.x) < 1e-6 &&
    Math.abs(fixedUsableArea.y) < 1e-6 &&
    Math.abs(fixedUsableArea.width - trayWidth) < 1e-6 &&
    Math.abs(fixedUsableArea.depth - trayDepth) < 1e-6;
  const trayOutlineStroke = fixedUsableAreaMatchesTray
    ? hasFixedBoundaryViolation
      ? "#ef4444"
      : "#d6a84f"
    : "#4b5563";
  const axisGuideStroke = "#38bdf8";
  const bevelFrame =
    showEffectiveBaseplate && effectiveBaseplate.hasSlots
      ? {
          x: effectiveBaseplate.x,
          y: effectiveBaseplate.y,
          width: effectiveBaseplate.width,
          height: effectiveBaseplate.height,
        }
      : {
          x: 0,
          y: 0,
          width: trayWidth,
          height: trayDepth,
        };
  const safeBevelWidth = Math.max(
    0,
    Math.min(
      sideBevelWidth,
      bevelFrame.width / 2 - 0.1,
      bevelFrame.height / 2 - 0.1,
    ),
  );
  const showSideBevel = safeBevelWidth > 0;
  const upperBevelFrame = {
    x: bevelFrame.x + safeBevelWidth,
    y: bevelFrame.y + safeBevelWidth,
    width: bevelFrame.width - safeBevelWidth * 2,
    height: bevelFrame.height - safeBevelWidth * 2,
  };

  return (
    <>
      <rect
        x={0}
        y={0}
        width={trayWidth}
        height={trayDepth}
        fill="none"
        stroke={trayOutlineStroke}
        {...boundaryDash}
      />

      {showEffectiveBaseplate && effectiveBaseplate.hasSlots && (
        <rect
          x={effectiveBaseplate.x}
          y={effectiveBaseplate.y}
          width={effectiveBaseplate.width}
          height={effectiveBaseplate.height}
          fill="none"
          stroke="#8b7355"
          strokeWidth={0.7 / zoom}
          rx={Math.max(
            0,
            Math.min(
              cornerRadius,
              effectiveBaseplate.width / 2,
              effectiveBaseplate.height / 2,
            ),
          )}
          strokeOpacity={0.95}
        />
      )}

      {fixedUsableArea && !fixedUsableAreaMatchesTray && (
        <rect
          data-fixed-usable-area="true"
          x={fixedUsableArea.x}
          y={trayDepth - fixedUsableArea.y - fixedUsableArea.depth}
          width={fixedUsableArea.width}
          height={fixedUsableArea.depth}
          rx={fixedUsableArea.cornerRadius}
          fill="none"
          stroke={hasFixedBoundaryViolation ? "#ef4444" : "#d6a84f"}
          {...boundaryDash}
          pointerEvents="none"
        />
      )}

      {showSideBevel && (
        <g pointerEvents="none">
          <rect
            data-bevel-edge="upper"
            x={upperBevelFrame.x}
            y={upperBevelFrame.y}
            width={upperBevelFrame.width}
            height={upperBevelFrame.height}
            rx={Math.max(
              0,
              Math.min(
                cornerRadius - safeBevelWidth,
                upperBevelFrame.width / 2,
                upperBevelFrame.height / 2,
              ),
            )}
            fill="none"
            stroke="#d6a84f"
            {...boundaryDash}
          />
        </g>
      )}

      {symmetryAxes && (
        <>
          <line
            data-symmetry-axis="mirror-x"
            x1={symmetryAxes.vertical}
            y1={0}
            x2={symmetryAxes.vertical}
            y2={trayDepth}
            stroke={axisGuideStroke}
            {...guideDash}
          />
          <line
            data-symmetry-axis="mirror-y"
            x1={0}
            y1={trayDepth - symmetryAxes.horizontal}
            x2={trayWidth}
            y2={trayDepth - symmetryAxes.horizontal}
            stroke={axisGuideStroke}
            {...guideDash}
          />
        </>
      )}

      {collisionState.connectorPairs.map((pair) => {
        const slot = collisionState.slotById.get(pair.firstId);
        const other = collisionState.slotById.get(pair.secondId);
        if (!slot || !other) {
          return null;
        }

        const lineOpacity = !focusedGroupId
          ? alertDash.strokeOpacity
          : ("groupId" in slot && slot.groupId === focusedGroupId) ||
            ("groupId" in other && other.groupId === focusedGroupId)
            ? 0.5
            : 0.12;

        return (
          <line
            key={`col-${pair.key}`}
            x1={slot.x}
            y1={trayDepth - slot.y}
            x2={other.x}
            y2={trayDepth - other.y}
            stroke="#ef4444"
            strokeWidth={alertDash.strokeWidth}
            strokeDasharray={alertDash.strokeDasharray}
            opacity={lineOpacity}
            pointerEvents="none"
          />
        );
      })}

      {guideLines.map((guideLine, index) =>
        guideLine.axis === "x" ? (
          <line
            key={`guide-${index}`}
            x1={guideLine.value}
            y1={minY}
            x2={guideLine.value}
            y2={minY + viewH}
            stroke={axisGuideStroke}
            strokeWidth={guideDash.strokeWidth}
            strokeDasharray={guideDash.strokeDasharray}
            pointerEvents="none"
            opacity={guideDash.strokeOpacity}
          />
        ) : (
          <line
            key={`guide-${index}`}
            x1={minX}
            y1={guideLine.value}
            x2={minX + viewW}
            y2={guideLine.value}
            stroke={axisGuideStroke}
            strokeWidth={guideDash.strokeWidth}
            strokeDasharray={guideDash.strokeDasharray}
            pointerEvents="none"
            opacity={guideDash.strokeOpacity}
          />
        ),
      )}

      {outlinePreview?.map((groupOutline) => {
        if (groupOutline.points.length < 3) {
          return null;
        }

        const isDimmed = Boolean(
          focusedGroupId && groupOutline.groupId !== focusedGroupId,
        );
        const pathData =
          groupOutline.points
            .map(
              (point, index) =>
                `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${(
                  trayDepth - point.y
                ).toFixed(2)}`,
            )
            .join(" ") + " Z";

        return (
          <g key={groupOutline.key} pointerEvents="none">
            <path
              d={pathData}
              fill="none"
              stroke={groupOutline.color}
              strokeWidth={0.9 / zoom}
              strokeOpacity={isDimmed ? 0.16 : 0.85}
            />
            {groupOutline.cornerMarkers?.map((point, index) => (
              <circle
                key={index}
                data-polygon-corner={index + 1}
                cx={point.x}
                cy={trayDepth - point.y}
                r={3 / zoom}
                fill="#f0c674"
                stroke="#171512"
                strokeWidth={1 / zoom}
                opacity={isDimmed ? 0.16 : 1}
              >
                <title>折角 {index + 1}（忽略圆角）</title>
              </circle>
            ))}
          </g>
        );
      })}
    </>
  );
});
