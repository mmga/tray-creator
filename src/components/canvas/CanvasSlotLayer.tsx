"use client";

import { memo } from "react";
import { getSlotTolerance } from "@/lib/config";
import { getSlotLabelRotation } from "@/lib/canvas-slot-geometry";
import type { CanvasCollisionState } from "@/lib/canvas-collision-model";
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
  onSlotPointerDown,
  onSlotPointerEnter,
  onSlotPointerLeave,
  onSlotRotatePointerDown,
}: CanvasSlotLayerProps) {
  return (
    <>
      {slots.map((slot) => {
        const width = slot.width + getSlotTolerance(slot.width);
        const height = slot.height + getSlotTolerance(slot.height);
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
            className={`transition-opacity duration-200 ${
              isSpacePressed ? "" : "cursor-move"
            }`}
            style={{
              opacity: (isDragging ? 0.9 : 1) * (isDimmedByGroupFocus ? 0.18 : 1),
            }}
          >
            <g transform={`rotate(${-slot.rotation})`}>
              <ellipse
                rx={width / 2 + spacing}
                ry={height / 2 + spacing}
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
                <ellipse
                  rx={Math.max(0, width / 2 - 0.5 / zoom)}
                  ry={Math.max(0, height / 2 - 0.5 / zoom)}
                  fill="none"
                  stroke={
                    isColliding || isInvolvedViaOther ? "#ef4444" : "#fbbf24"
                  }
                  strokeWidth={0.8 / zoom}
                  strokeOpacity={0.8}
                  pointerEvents="none"
                />
              )}

              <ellipse
                rx={width / 2}
                ry={height / 2}
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
