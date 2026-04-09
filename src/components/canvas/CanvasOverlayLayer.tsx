"use client";

import type { CanvasCollisionState } from "@/lib/canvas-collision-model";
import type { CanvasEffectiveBaseplate } from "@/lib/canvas-slot-geometry";
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
  cornerRadius?: number;
  symmetryAxes: { vertical: number; horizontal: number } | null;
  collisionState: CanvasCollisionState<FreeSlot | SteppedSlot>;
  focusedGroupId?: string | null;
  guideLines: readonly CanvasGuideLine[];
  outlinePreview?: GroupOutlinePreview[] | null;
}

export function CanvasOverlayLayer({
  trayWidth,
  trayDepth,
  zoom,
  minX,
  minY,
  viewW,
  viewH,
  showEffectiveBaseplate,
  effectiveBaseplate,
  cornerRadius = 0,
  symmetryAxes,
  collisionState,
  focusedGroupId,
  guideLines,
  outlinePreview,
}: CanvasOverlayLayerProps) {
  const trayOutlineStroke = "#4b5563";
  const trayOutlineStrokeWidth = 0.5 / zoom;
  const trayOutlineStrokeDash = `${3 / zoom} ${3 / zoom}`;
  const trayOutlineStrokeOpacity = 0.9;
  const axisGuideStroke = "#38bdf8";
  const axisGuideStrokeWidth = 0.3 / zoom;
  const axisGuideStrokeDash = `${2 / zoom} ${2 / zoom}`;
  const axisGuideStrokeOpacity = 0.8;

  return (
    <>
      <rect
        x={0}
        y={0}
        width={trayWidth}
        height={trayDepth}
        fill="none"
        stroke={trayOutlineStroke}
        strokeWidth={trayOutlineStrokeWidth}
        strokeDasharray={trayOutlineStrokeDash}
        strokeOpacity={trayOutlineStrokeOpacity}
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

      {symmetryAxes && (
        <>
          <line
            data-symmetry-axis="mirror-x"
            x1={symmetryAxes.vertical}
            y1={0}
            x2={symmetryAxes.vertical}
            y2={trayDepth}
            stroke={axisGuideStroke}
            strokeWidth={axisGuideStrokeWidth}
            strokeDasharray={axisGuideStrokeDash}
            strokeOpacity={axisGuideStrokeOpacity}
          />
          <line
            data-symmetry-axis="mirror-y"
            x1={0}
            y1={trayDepth - symmetryAxes.horizontal}
            x2={trayWidth}
            y2={trayDepth - symmetryAxes.horizontal}
            stroke={axisGuideStroke}
            strokeWidth={axisGuideStrokeWidth}
            strokeDasharray={axisGuideStrokeDash}
            strokeOpacity={axisGuideStrokeOpacity}
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
          ? 0.6
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
            strokeWidth={0.5 / zoom}
            strokeDasharray="3 2"
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
            strokeWidth={axisGuideStrokeWidth}
            strokeDasharray={axisGuideStrokeDash}
            pointerEvents="none"
            opacity={axisGuideStrokeOpacity}
          />
        ) : (
          <line
            key={`guide-${index}`}
            x1={minX}
            y1={guideLine.value}
            x2={minX + viewW}
            y2={guideLine.value}
            stroke={axisGuideStroke}
            strokeWidth={axisGuideStrokeWidth}
            strokeDasharray={axisGuideStrokeDash}
            pointerEvents="none"
            opacity={axisGuideStrokeOpacity}
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
          <path
            key={groupOutline.key}
            d={pathData}
            fill="none"
            stroke={groupOutline.color}
            strokeWidth={0.9 / zoom}
            strokeOpacity={isDimmed ? 0.16 : 0.85}
            pointerEvents="none"
          />
        );
      })}
    </>
  );
}
