"use client";

import { memo } from "react";
import { getEllipsePolygon } from "@/lib/collision";
import { getSlotLabelRotation } from "@/lib/canvas-slot-geometry";
import type { CanvasCollisionState } from "@/lib/canvas-collision-model";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import type { FreeSlot, SlotGroup, SteppedSlot } from "@/types/custom-tray";

interface CanvasSlotLayerProps {
  slots: Array<FreeSlot | SteppedSlot>;
  trayDepth: number;
  spacing: number;
  zoom: number;
  selectedIds: ReadonlySet<string>;
  hoveredId: string | null;
  draggingId: string | null;
  focusedGroupId?: string | null;
  steppedGroupMetaById: ReadonlyMap<string, SlotGroup> | null;
  collisionState: CanvasCollisionState<FreeSlot | SteppedSlot>;
  isSpacePressed: boolean;
  /** 对称检查未配对的槽位 id（父层用 5s 定时器清空，这里只负责渲染闪烁边框） */
  symmetryHighlightIds?: ReadonlySet<string>;
  ellipseProfileExponent?: number;
  onSlotPointerDown: (event: React.PointerEvent, slotId: string) => void;
  onSlotPointerEnter: (slotId: string) => void;
  onSlotPointerLeave: (slotId: string) => void;
  onSlotRotatePointerDown: (
    event: React.PointerEvent,
    slot: FreeSlot | SteppedSlot,
  ) => void;
}

export const CanvasSlotLayer = memo(function CanvasSlotLayer({
  slots,
  trayDepth,
  spacing,
  zoom,
  selectedIds,
  hoveredId,
  draggingId,
  focusedGroupId,
  steppedGroupMetaById,
  collisionState,
  isSpacePressed,
  symmetryHighlightIds,
  ellipseProfileExponent,
  onSlotPointerDown,
  onSlotPointerEnter,
  onSlotPointerLeave,
  onSlotRotatePointerDown,
}: CanvasSlotLayerProps) {
  const getLocalPath = (
    width: number,
    height: number,
    margin: number,
    profileExponent?: number,
  ) => {
    const points = getEllipsePolygon(
      0,
      0,
      width,
      height,
      0,
      margin,
      64,
      profileExponent ?? ellipseProfileExponent,
    );
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ") + " Z";
  };

  return (
    <>
      {slots.map((slot) => {
        const profile = getFreeSlotProfileGeometry(slot);
        const slotOffset = profile.outerOffset;
        const width = profile.width + slotOffset * 2;
        const height = profile.height + slotOffset * 2;
        const slotPath = getLocalPath(
          profile.width,
          profile.height,
          slotOffset,
          profile.profileExponent,
        );
        const spacingPath = getLocalPath(
          profile.width,
          profile.height,
          slotOffset + spacing,
          profile.profileExponent,
        );
        const svgY = trayDepth - slot.y;

        const collisionInfo = collisionState.collisionMap.get(slot.id) ?? {
          boundaryReasons: [],
          overlapIds: [],
        };
        const isBoundary = collisionInfo.boundaryReasons.length > 0;
        const isOverlap = collisionInfo.overlapIds.length > 0;
        const isColliding = isBoundary || isOverlap;
        const isInvolvedViaOther =
          !isColliding && collisionState.involvedIds.has(slot.id);

        const isHovered = hoveredId === slot.id;
        const isDragging = draggingId === slot.id;
        const isSelected = selectedIds.has(slot.id);
        const isSymmetryHighlight = Boolean(
          symmetryHighlightIds && symmetryHighlightIds.has(slot.id),
        );
        const baseColor = isSelected ? "#f97316" : "#eab308";
        const bottomHeightLabelColor = "#86efac";

        const isSteppedSlot = "groupId" in slot;
        const isDimmedByGroupFocus = Boolean(
          focusedGroupId &&
          isSteppedSlot &&
          slot.groupId !== focusedGroupId,
        );
        const groupMeta =
          isSteppedSlot && steppedGroupMetaById
            ? steppedGroupMetaById.get(slot.groupId)
            : null;
        const groupColor = isSteppedSlot ? groupMeta?.color ?? "#86efac" : null;
        const labelRotation = getSlotLabelRotation(slot.rotation);

        return (
          <g
            key={slot.id}
            transform={`translate(${slot.x}, ${svgY})`}
            onPointerDown={(event) => onSlotPointerDown(event, slot.id)}
            onPointerEnter={() => onSlotPointerEnter(slot.id)}
            onPointerLeave={() => onSlotPointerLeave(slot.id)}
            className={`transition-opacity duration-200 ${isSpacePressed ? "" : "cursor-move"
              }`}
            style={{
              opacity: (isDragging ? 0.9 : 1) * (isDimmedByGroupFocus ? 0.18 : 1),
            }}
          >
            <g transform={`rotate(${-slot.rotation})`}>
              <path
                d={spacingPath}
                fill="none"
                stroke={
                  isColliding
                    ? "#ef4444"
                    : isInvolvedViaOther
                      ? "#ef4444"
                      : groupColor ?? "#888"
                }
                strokeWidth={0.25 / zoom}
                strokeDasharray="2 2"
                opacity={
                  isColliding
                    ? 1
                    : isInvolvedViaOther
                      ? 0.7
                      : groupColor
                        ? 0.5
                        : 0.6
                }
                pointerEvents="none"
              />

              {(isColliding || isInvolvedViaOther || isHovered || isDragging) && (
                <path
                  d={getLocalPath(
                    profile.width,
                    profile.height,
                    Math.max(0, slotOffset - 0.5 / zoom),
                    profile.profileExponent,
                  )}
                  fill="none"
                  stroke={
                    isColliding || isInvolvedViaOther ? "#ef4444" : "#fbbf24"
                  }
                  strokeWidth={0.8 / zoom}
                  strokeOpacity={0.8}
                  pointerEvents="none"
                />
              )}

              {isSymmetryHighlight && (
                <path
                  data-symmetry-highlight="true"
                  d={getLocalPath(
                    profile.width,
                    profile.height,
                    Math.max(0, slotOffset - 0.5 / zoom),
                    profile.profileExponent,
                  )}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth={1 / zoom}
                  pointerEvents="none"
                >
                  <animate
                    attributeName="stroke-opacity"
                    values="0.25;1;0.25"
                    dur="0.8s"
                    repeatCount="indefinite"
                  />
                </path>
              )}

              <path
                d={slotPath}
                fill={
                  isSteppedSlot
                    ? isSelected
                      ? "#f97316"
                      : groupColor ?? bottomHeightLabelColor
                    : baseColor
                }
                fillOpacity={0.85}
                stroke={
                  isColliding || isInvolvedViaOther
                    ? "#ef4444"
                    : isSteppedSlot
                      ? groupColor
                        ? `${groupColor}cc`
                        : "#fff"
                      : "#fff"
                }
                strokeWidth={
                  (isColliding || isInvolvedViaOther
                    ? 0.5
                    : isSteppedSlot
                      ? 0.4
                      : 0.2) / zoom
                }
              />

              {isSelected && Math.abs(slot.width - slot.height) > 0.01 && (
                <g
                  transform={`translate(${width / 2 + spacing + 4}, 0)`}
                  onPointerDown={(event) => onSlotRotatePointerDown(event, slot)}
                  className="cursor-pointer"
                  style={{ cursor: "grab" }}
                >
                  <circle r={6 / zoom} fill="transparent" />
                  <line
                    x1={-(4 + spacing)}
                    y1={0}
                    x2={0}
                    y2={0}
                    stroke="#fff"
                    strokeWidth={0.5 / zoom}
                    pointerEvents="none"
                  />
                  <circle
                    r={1.5 / zoom}
                    fill="#fff"
                    stroke="#2a2a2e"
                    strokeWidth={0.5 / zoom}
                    pointerEvents="none"
                  />
                </g>
              )}
            </g>

            <g
              transform={
                labelRotation !== 0 ? `rotate(${labelRotation})` : undefined
              }
            >
              <text
                dy={
                  isSteppedSlot
                    ? -Math.min(width, height) * 0.12
                    : Math.min(width, height) * 0.2
                }
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(width, height, 24) / 2}
                fill="#fff"
                fontWeight="bold"
                pointerEvents="none"
                style={{ userSelect: "none" }}
              >
                {slot.width === slot.height
                  ? slot.width
                  : `${slot.width}x${slot.height}`}
              </text>
            </g>
          </g>
        );
      })}
    </>
  );
});
