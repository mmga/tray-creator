"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type {
  FreeSlot,
  SteppedSlot,
} from "@/types/custom-tray";
import { MAX_BUILD_SIZE } from "@/lib/config";
import { buildCanvasCollisionState } from "@/lib/canvas-collision-model";
import { calculateEffectiveBaseplate } from "@/lib/canvas-slot-geometry";
import {
  collectCanvasSelection,
  getCanvasSelectionBoxRect,
  sanitizeCanvasSelectedIds,
  shouldApplyCanvasSelectionBox,
} from "@/lib/canvas-selection-model";
import { calculateCanvasDragSnap } from "@/lib/canvas-snap-engine";
import type {
  CanvasGuideLine,
  CanvasSelectionBox,
  CanvasSlotUpdate,
} from "@/lib/canvas-types";
import { measurePerf } from "@/lib/perf";
import AlignmentToolbar from "./AlignmentToolbar";
import {
  resolveMirrorAxis,
  type SymmetrySlot,
} from "@/lib/layout-symmetry";
import type {
  LayoutEditorViewportCommands,
  LayoutEditorViewportModel,
} from "@/viewports/layout-editor/types";
import { useCanvasZoom } from "../hooks/useCanvasZoom";
import { useCanvasKeyboard } from "../hooks/useCanvasKeyboard";
import { useActionPanelResize } from "../hooks/useActionPanelResize";
import { useLiveSlotUpdates } from "../hooks/useLiveSlotUpdates";
import { CanvasOverlayLayer } from "./canvas/CanvasOverlayLayer";
import { CanvasSlotLayer } from "./canvas/CanvasSlotLayer";
import { CanvasStatusBar } from "./canvas/CanvasStatusBar";
import { CanvasZoomControls } from "./canvas/CanvasZoomControls";
import { KeyboardHintsOverlay } from "./canvas/KeyboardHintsOverlay";
import { EDIT_SIDEBAR_RAIL_WIDTH } from "./canvas/EditSidebar";

const ACTION_PANEL_RESIZER_WIDTH = 3;
const ACTION_PANEL_MIN_WIDTH =
  248 - EDIT_SIDEBAR_RAIL_WIDTH - ACTION_PANEL_RESIZER_WIDTH;
const ACTION_PANEL_MAX_WIDTH =
  420 - EDIT_SIDEBAR_RAIL_WIDTH - ACTION_PANEL_RESIZER_WIDTH;
const ACTION_PANEL_DEFAULT_WIDTH =
  304 - EDIT_SIDEBAR_RAIL_WIDTH - ACTION_PANEL_RESIZER_WIDTH;
const ACTION_PANEL_TAB_RAIL_WIDTH = EDIT_SIDEBAR_RAIL_WIDTH;

interface LayoutCanvasProps {
  isActive?: boolean;
  model: LayoutEditorViewportModel;
  commands: LayoutEditorViewportCommands;
}

export default function LayoutCanvas({
  isActive = true,
  model,
  commands,
}: LayoutCanvasProps) {
  const {
    updateSlotPosition,
    removeSlot,
    resizeTray,
    updateSlotRotation,
    updateMultipleSlots,
    liveUpdateMultipleSlots,
    insertSlots,
    duplicateSlots,
    undo,
    saveSnapshot,
    selectionChanged,
    editInteractionChanged,
  } = commands;
  const {
    trayFrame,
    slots,
    overlays: {
      focusedGroupId,
      groupOutlines,
      rowBands,
      slotGroups,
    },
    interactions: { slotMoveScopeResolver },
  } = model;
  const {
    width: trayWidth,
    depth: trayDepth,
    spacing,
    boundarySpacing,
    cornerRadius,
    showEffectiveBaseplate,
    showMaxBuildBoundary,
  } = trayFrame;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeActionTab, setActiveActionTab] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [selectionBox, setSelectionBox] = useState<CanvasSelectionBox | null>(
    null,
  );
  const [guideLines, setGuideLines] = useState<CanvasGuideLine[]>([]);
  const [isResizingTray, setIsResizingTray] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const rotateStartRef = useRef<{
    angle: number;
    startRotation: number;
  } | null>(null);
  const primaryPointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef<{
    mouseStart: { x: number; y: number };
    slotOrigins: Map<string, { x: number; y: number }>;
  } | null>(null);
  const trayResizeRef = useRef<{
    mode: "right" | "bottom" | "corner";
    minWidth: number;
    minDepth: number;
  } | null>(null);

  const {
    actionPanelWidth,
    isResizingActionPanel,
    startActionPanelResize,
    stopActionPanelResize,
  } = useActionPanelResize({
    defaultWidth: ACTION_PANEL_DEFAULT_WIDTH,
    minWidth: ACTION_PANEL_MIN_WIDTH,
    maxWidth: ACTION_PANEL_MAX_WIDTH,
  });

  const virtualCanvasWidth = showMaxBuildBoundary
    ? Math.max(trayWidth, MAX_BUILD_SIZE)
    : trayWidth;
  const virtualCanvasDepth = showMaxBuildBoundary
    ? Math.max(trayDepth, MAX_BUILD_SIZE)
    : trayDepth;

  const {
    zoom,
    setPan,
    viewBox,
    viewW,
    viewH,
    minX,
    minY,
    isSpacePressed,
    setIsSpacePressed,
    isPanning,
    setIsPanning,
    panStartRef,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetZoom,
  } = useCanvasZoom({
    baseW: virtualCanvasWidth + 40,
    baseH: virtualCanvasDepth + 40,
    trayWidth,
    trayDepth,
  });

  const slotById = useMemo(
    () =>
      new Map<string, FreeSlot | SteppedSlot>(
        slots.map((slot) => [slot.id, slot as FreeSlot | SteppedSlot]),
      ),
    [slots],
  );
  const slotIds = useMemo(() => new Set<string>(slots.map((slot) => slot.id)), [slots]);
  const isActionPanelExpanded = activeActionTab !== null;
  const effectiveSelectedIds = useMemo(
    () => sanitizeCanvasSelectedIds(selectedIds, slots),
    [selectedIds, slots],
  );
  const effectiveDraggingId =
    draggingId && slotIds.has(draggingId) ? draggingId : null;
  const effectiveHoveredId =
    hoveredId && slotIds.has(hoveredId) ? hoveredId : null;
  const selectionBoxRect = useMemo(
    () => (selectionBox ? getCanvasSelectionBoxRect(selectionBox) : null),
    [selectionBox],
  );
  const selectedSymmetrySlots = slots.filter((slot) =>
    effectiveSelectedIds.has(slot.id),
  ) as SymmetrySlot[];
  const unselectedSymmetrySlots = useMemo(
    () =>
      slots.filter(
        (slot) => !effectiveSelectedIds.has(slot.id),
      ) as Array<FreeSlot | SteppedSlot>,
    [effectiveSelectedIds, slots],
  );
  const steppedGroupMetaById = useMemo(() => {
    if (!slotGroups) {
      return null;
    }

    return new Map(slotGroups.map((group) => [group.id, group] as const));
  }, [slotGroups]);
  const selectedIdsRef = useRef<Set<string>>(effectiveSelectedIds);
  const slotsRef = useRef(slots);

  useEffect(() => {
    selectedIdsRef.current = effectiveSelectedIds;
    slotsRef.current = slots;
  }, [effectiveSelectedIds, slots]);

  useEffect(() => {
    const shouldSyncWhileInactive = selectedIds.size !== effectiveSelectedIds.size;
    if (!isActive && !shouldSyncWhileInactive) {
      return;
    }

    selectionChanged?.(Array.from(effectiveSelectedIds));
  }, [effectiveSelectedIds, isActive, selectionChanged, selectedIds]);

  const handleUpdateSlots = useCallback(
    (updates: CanvasSlotUpdate[]) => {
      if (updateMultipleSlots) {
        updateMultipleSlots(updates);
        return;
      }

      saveSnapshot?.();
      updates.forEach((update) => {
        updateSlotPosition(update.id, update.x, update.y);
        if (update.rotation !== undefined && updateSlotRotation) {
          updateSlotRotation(update.id, update.rotation);
        }
      });
    },
    [saveSnapshot, updateMultipleSlots, updateSlotPosition, updateSlotRotation],
  );

  const applyLiveUpdates = useCallback(
    (updates: CanvasSlotUpdate[]) => {
      if (liveUpdateMultipleSlots) {
        liveUpdateMultipleSlots(updates);
        return;
      }

      updates.forEach((update) => {
        updateSlotPosition(update.id, update.x, update.y);
        if (update.rotation !== undefined && updateSlotRotation) {
          updateSlotRotation(update.id, update.rotation);
        }
      });
    },
    [liveUpdateMultipleSlots, updateSlotPosition, updateSlotRotation],
  );
  const { flushScheduledLiveUpdates, scheduleLiveUpdates } = useLiveSlotUpdates({
    applyLiveUpdates,
  });

  useCanvasKeyboard({
    enabled: isActive,
    selectedIdsRef,
    slotsRef,
    onUpdateSlot: updateSlotPosition,
    onRemoveSlot: removeSlot,
    onDuplicateSlots: duplicateSlots,
    onUndo: undo,
    setSelectedIds,
    setIsRotating,
    setIsSpacePressed,
    setIsPanning,
    setShowHints,
  });

  const clearPointerInteractionState = useCallback(() => {
    setDraggingId(null);
    setIsPanning(false);
    setSelectionBox(null);
    setIsRotating(false);
    setGuideLines([]);
    setIsResizingTray(false);
    rotateStartRef.current = null;
    dragStartRef.current = null;
    trayResizeRef.current = null;
  }, [setIsPanning]);

  const resetTransientCanvasState = useCallback(() => {
    clearPointerInteractionState();
    setHoveredId(null);
    setIsSpacePressed(false);
    stopActionPanelResize();
  }, [clearPointerInteractionState, setIsSpacePressed, stopActionPanelResize]);

  useEffect(() => {
    if (!isActive) {
      flushScheduledLiveUpdates();
      editInteractionChanged?.(false);
      const frame = window.requestAnimationFrame(() => {
        resetTransientCanvasState();
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }
  }, [
    flushScheduledLiveUpdates,
    isActive,
    editInteractionChanged,
    resetTransientCanvasState,
  ]);

  const collisionState = useMemo(
    () =>
      measurePerf("canvas.collision", () =>
        buildCanvasCollisionState(slots, spacing),
      ),
    [slots, spacing],
  );

  const effectiveBaseplate = useMemo(
    () =>
      calculateEffectiveBaseplate(slots, trayDepth, boundarySpacing),
    [boundarySpacing, slots, trayDepth],
  );

  const isSimpleSteppedCanvas = Boolean(rowBands);
  const isEffectiveOversized =
    (isSimpleSteppedCanvas ? trayWidth : effectiveBaseplate.width) >
      MAX_BUILD_SIZE ||
    (isSimpleSteppedCanvas ? trayDepth : effectiveBaseplate.height) >
      MAX_BUILD_SIZE;

  const symmetryAxes =
    selectedSymmetrySlots.length > 0
      ? {
          vertical: resolveMirrorAxis(
            selectedSymmetrySlots,
            trayWidth,
            trayDepth,
            "tray",
            "mirror-x",
          ),
          horizontal: resolveMirrorAxis(
            selectedSymmetrySlots,
            trayWidth,
            trayDepth,
            "tray",
            "mirror-y",
          ),
        }
      : null;

  const minimumTrayBounds = useMemo(() => {
    if (!rowBands || rowBands.length === 0) {
      return {
        width: effectiveBaseplate.width,
        depth: effectiveBaseplate.height,
      };
    }

    const minBandX = Math.min(...rowBands.map((band) => band.x));
    const maxBandX = Math.max(...rowBands.map((band) => band.x + band.width));
    const minBandY = Math.min(...rowBands.map((band) => band.y));
    const maxBandY = Math.max(...rowBands.map((band) => band.y + band.depth));

    return {
      width: Math.max(0, maxBandX - minBandX),
      depth: Math.max(0, maxBandY - minBandY),
    };
  }, [effectiveBaseplate.height, effectiveBaseplate.width, rowBands]);

  const trayResizeHandleSize = 10 / zoom;
  const trayResizeHitSize = 14 / zoom;

  const getSvgPointFromClient = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const screenMatrix = svg?.getScreenCTM();
    if (!svg || !screenMatrix) {
      return null;
    }

    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(screenMatrix.inverse());
  };

  const handleRotateMouseDown = (
    event: React.PointerEvent,
    slot: FreeSlot | SteppedSlot,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const svgPoint = getSvgPointFromClient(event.clientX, event.clientY);
    if (!svgPoint) {
      return;
    }

    const slotCenterX = slot.x;
    const slotCenterY = trayDepth - slot.y;
    const angle = Math.atan2(
      svgPoint.y - slotCenterY,
      svgPoint.x - slotCenterX,
    );

    saveSnapshot?.();
    editInteractionChanged?.(true);
    setIsRotating(true);
    setDraggingId(slot.id);
    rotateStartRef.current = {
      angle,
      startRotation: slot.rotation,
    };
  };

  const startTrayResize = useCallback(
    (
      event: React.PointerEvent,
      mode: "right" | "bottom" | "corner",
    ) => {
      if (!resizeTray || !rowBands) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      (event.target as Element)?.setPointerCapture?.(event.pointerId);
      saveSnapshot?.();
      editInteractionChanged?.(true);
      trayResizeRef.current = {
        mode,
        minWidth: Math.max(1, minimumTrayBounds.width),
        minDepth: Math.max(1, minimumTrayBounds.depth),
      };
      setIsResizingTray(true);
    },
    [
      minimumTrayBounds.depth,
      minimumTrayBounds.width,
      editInteractionChanged,
      resizeTray,
      saveSnapshot,
      rowBands,
    ],
  );

  const handlePointerMove = (event: React.PointerEvent) => {
    measurePerf("canvas.pointermove", () => {
      event.preventDefault();

      if (
        event.pointerType === "touch" &&
        primaryPointerIdRef.current !== null &&
        event.pointerId !== primaryPointerIdRef.current
      ) {
        return;
      }

      if (isPanning) {
        const dx = event.clientX - panStartRef.current.x;
        const dy = event.clientY - panStartRef.current.y;
        if (svgRef.current) {
          const screenCTM = svgRef.current.getScreenCTM();
          if (screenCTM) {
            const scale = screenCTM.a;
            setPan((prev) => ({
              x: prev.x + dx / scale,
              y: prev.y + dy / scale,
            }));
          }
        }
        panStartRef.current = { x: event.clientX, y: event.clientY };
        return;
      }

      if (rowBands && trayResizeRef.current && resizeTray) {
        const svgPoint = getSvgPointFromClient(event.clientX, event.clientY);
        if (!svgPoint) {
          return;
        }

        const nextWidth = Math.max(
          trayResizeRef.current.minWidth,
          Math.min(MAX_BUILD_SIZE, svgPoint.x),
        );
        const nextDepth = Math.max(
          trayResizeRef.current.minDepth,
          Math.min(MAX_BUILD_SIZE, svgPoint.y),
        );

        if (trayResizeRef.current.mode === "right") {
          resizeTray(nextWidth, trayDepth);
        } else if (trayResizeRef.current.mode === "bottom") {
          resizeTray(trayWidth, nextDepth);
        } else {
          resizeTray(nextWidth, nextDepth);
        }
        return;
      }

      if (selectionBox) {
        const rect = parentRef.current?.getBoundingClientRect();
        if (rect) {
          setSelectionBox((prev) =>
            prev
              ? {
                  ...prev,
                  current: {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                  },
                }
              : null,
          );
        }
        return;
      }

      if (isRotating && effectiveDraggingId && rotateStartRef.current) {
        const slot = slotById.get(effectiveDraggingId);
        if (!slot) {
          return;
        }

        const svgPoint = getSvgPointFromClient(event.clientX, event.clientY);
        if (!svgPoint) {
          return;
        }

        const slotCenterX = slot.x;
        const slotCenterY = trayDepth - slot.y;
        const currentAngle = Math.atan2(
          svgPoint.y - slotCenterY,
          svgPoint.x - slotCenterX,
        );
        const deltaAngle = currentAngle - rotateStartRef.current.angle;
        const deltaDeg = deltaAngle * (180 / Math.PI);

        let newRotation = rotateStartRef.current.startRotation - deltaDeg;
        if (event.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }
        newRotation = Math.round((newRotation % 360 + 360) % 360);

        scheduleLiveUpdates([
          {
            id: effectiveDraggingId,
            x: slot.x,
            y: slot.y,
            rotation: newRotation,
          },
        ]);
        return;
      }

      if (effectiveDraggingId && !isRotating && dragStartRef.current) {
        const svgPoint = getSvgPointFromClient(event.clientX, event.clientY);
        if (!svgPoint) {
          return;
        }

        const dragOrigins = dragStartRef.current.slotOrigins;
        const dragSnap = calculateCanvasDragSnap({
          draggingSlotId: effectiveDraggingId,
          slots,
          dragOrigins,
          trayWidth,
          trayDepth,
          currentMouse: svgPoint,
          startMouse: dragStartRef.current.mouseStart,
        });
        if (!dragSnap) {
          return;
        }

        setGuideLines(dragSnap.guides);

        const draggingOrigin = dragOrigins.get(effectiveDraggingId);
        if (!draggingOrigin) {
          return;
        }

        const finalDeltaX = dragSnap.finalX - draggingOrigin.x;
        const finalDeltaY = dragSnap.finalY - draggingOrigin.y;
        const liveUpdates: CanvasSlotUpdate[] = [];
        dragOrigins.forEach((origin, id) => {
          liveUpdates.push({
            id,
            x: origin.x + finalDeltaX,
            y: origin.y + finalDeltaY,
          });
        });

        scheduleLiveUpdates(liveUpdates);
      }
    });
  };

  const handlePointerDown = (event: React.PointerEvent, slotId?: string) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.pointerType === "touch") {
      if (
        primaryPointerIdRef.current !== null &&
        primaryPointerIdRef.current !== event.pointerId
      ) {
        return;
      }
      primaryPointerIdRef.current = event.pointerId;
    }

    (event.target as Element)?.setPointerCapture?.(event.pointerId);

    const isCtrl = event.ctrlKey || event.metaKey;

    if (isSpacePressed) {
      setIsPanning(true);
      panStartRef.current = { x: event.clientX, y: event.clientY };
      return;
    }

    if (slotId) {
      let nextSelection = new Set<string>(effectiveSelectedIds);

      if (isCtrl) {
        if (nextSelection.has(slotId)) {
          nextSelection.delete(slotId);
        } else {
          nextSelection.add(slotId);
        }
        setSelectedIds(nextSelection);
      } else if (!nextSelection.has(slotId)) {
        nextSelection = new Set<string>([slotId]);
        setSelectedIds(nextSelection);
      }

      const svgPoint = getSvgPointFromClient(event.clientX, event.clientY);
      if (!svgPoint) {
        return;
      }

      const dragSelection: Set<string> =
        isCtrl && effectiveSelectedIds.has(slotId)
          ? nextSelection
          : nextSelection.has(slotId)
            ? nextSelection
            : new Set<string>([slotId]);
      const scopedDragIds = slotMoveScopeResolver
        ? slotMoveScopeResolver(slotId, Array.from(dragSelection))
        : Array.from(dragSelection);

      if (scopedDragIds.length === 0) {
        setDraggingId(null);
        dragStartRef.current = null;
        editInteractionChanged?.(false);
        return;
      }

      saveSnapshot?.();
      editInteractionChanged?.(true);
      setDraggingId(slotId);

      const origins = new Map<string, { x: number; y: number }>();
      scopedDragIds.forEach((id) => {
        const slot = slotById.get(id);
        if (slot) {
          origins.set(id, { x: slot.x, y: slot.y });
        }
      });

      dragStartRef.current = {
        mouseStart: { x: svgPoint.x, y: svgPoint.y },
        slotOrigins: origins,
      };
      return;
    }

    if (!isCtrl) {
      setSelectedIds(new Set<string>());
    }
    if (event.pointerType !== "touch") {
      const rect = parentRef.current?.getBoundingClientRect();
      if (rect) {
        setSelectionBox({
          start: {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          current: {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
        });
      }
    }
  };

  const handlePointerUp = () => {
    flushScheduledLiveUpdates();
    editInteractionChanged?.(false);
    primaryPointerIdRef.current = null;

    if (
      selectionBoxRect &&
      selectionBox &&
      shouldApplyCanvasSelectionBox(selectionBoxRect) &&
      svgRef.current &&
      parentRef.current
    ) {
      const svg = svgRef.current;
      const screenMatrix = svg.getScreenCTM();
      const containerRect = parentRef.current.getBoundingClientRect();

      if (screenMatrix) {
        const nextSelection = collectCanvasSelection({
          slots,
          selectionRect: selectionBoxRect,
          initialSelection: effectiveSelectedIds,
          projectSlotToScreen: (slot) => {
            const point = svg.createSVGPoint();
            point.x = slot.x;
            point.y = trayDepth - slot.y;
            const screenPoint = point.matrixTransform(screenMatrix);

            return {
              x: screenPoint.x - containerRect.left,
              y: screenPoint.y - containerRect.top,
            };
          },
        });
        setSelectedIds(nextSelection);
      }
    }

    clearPointerInteractionState();
  };

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-[#120f0c] lg:flex-row">
      <div
        ref={parentRef}
        className={`relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#1c1a16] select-none ${isSpacePressed ? "cursor-grab" : ""} ${isPanning ? "cursor-grabbing" : ""}`}
        style={{ touchAction: "none" }}
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none transition-all duration-300"
          style={{
            backgroundImage:
              "linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            backgroundPosition: "center",
          }}
        />

        <svg
          ref={svgRef}
          viewBox={viewBox}
          className={`w-full h-full max-w-full max-h-full ${isSpacePressed ? "" : "cursor-crosshair"}`}
          style={{ touchAction: "none" }}
          onPointerDown={(event) => handlePointerDown(event)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          preserveAspectRatio="xMidYMid meet"
        >
          {isSimpleSteppedCanvas && (
            <rect
              x={0}
              y={0}
              width={MAX_BUILD_SIZE}
              height={MAX_BUILD_SIZE}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={0.3 / zoom}
              strokeDasharray={`${2 / zoom} ${2 / zoom}`}
              strokeOpacity={0.95}
              pointerEvents="none"
            />
          )}

          <CanvasOverlayLayer
            trayWidth={trayWidth}
            trayDepth={trayDepth}
            zoom={zoom}
            minX={minX}
            minY={minY}
            viewW={viewW}
            viewH={viewH}
            showEffectiveBaseplate={showEffectiveBaseplate}
            effectiveBaseplate={effectiveBaseplate}
            cornerRadius={cornerRadius}
            symmetryAxes={symmetryAxes}
            collisionState={collisionState}
            focusedGroupId={focusedGroupId}
            guideLines={guideLines}
            outlinePreview={groupOutlines}
          />

          {rowBands?.map((band) => (
            <rect
              key={band.id}
              x={band.x}
              y={trayDepth - band.y - band.depth}
              width={band.width}
              height={band.depth}
              fill={band.isActive ? "#a1620730" : "#78716c18"}
              stroke={band.isActive ? "#fbbf24" : "#78716c"}
              strokeWidth={(band.isActive ? 0.8 : 0.5) / zoom}
              strokeDasharray={band.isActive ? undefined : "3 2"}
              strokeOpacity={band.isActive ? 0.95 : 0.55}
              pointerEvents="none"
            />
          ))}

          {resizeTray && isSimpleSteppedCanvas && (
            <>
              <rect
                x={trayWidth - trayResizeHitSize / 2}
                y={0}
                width={trayResizeHitSize}
                height={trayDepth}
                fill="transparent"
                style={{ cursor: "ew-resize" }}
                onPointerDown={(event) => startTrayResize(event, "right")}
              />
              <rect
                x={0}
                y={trayDepth - trayResizeHitSize / 2}
                width={trayWidth}
                height={trayResizeHitSize}
                fill="transparent"
                style={{ cursor: "ns-resize" }}
                onPointerDown={(event) => startTrayResize(event, "bottom")}
              />
              <rect
                x={trayWidth - trayResizeHitSize}
                y={trayDepth - trayResizeHitSize}
                width={trayResizeHitSize}
                height={trayResizeHitSize}
                fill="transparent"
                style={{ cursor: "nwse-resize" }}
                onPointerDown={(event) => startTrayResize(event, "corner")}
              />
              <rect
                x={trayWidth - trayResizeHandleSize}
                y={trayDepth - trayResizeHandleSize}
                width={trayResizeHandleSize}
                height={trayResizeHandleSize}
                fill={isResizingTray ? "#fbbf24" : "#8b7355"}
                fillOpacity={0.8}
                pointerEvents="none"
              />
            </>
          )}

          <CanvasSlotLayer
            slots={slots as Array<FreeSlot | SteppedSlot>}
            trayDepth={trayDepth}
            spacing={spacing}
            zoom={zoom}
            selectedIds={effectiveSelectedIds}
            hoveredId={effectiveHoveredId}
            draggingId={effectiveDraggingId}
            focusedGroupId={focusedGroupId}
            steppedGroupMetaById={steppedGroupMetaById}
            collisionState={collisionState}
            isSpacePressed={isSpacePressed}
            onSlotPointerDown={handlePointerDown}
            onSlotPointerEnter={setHoveredId}
            onSlotPointerLeave={() => setHoveredId(null)}
            onSlotRotatePointerDown={handleRotateMouseDown}
          />
        </svg>

        {selectionBoxRect && (
          <div
            style={{
              position: "absolute",
              left: selectionBoxRect.left,
              top: selectionBoxRect.top,
              width: selectionBoxRect.width,
              height: selectionBoxRect.height,
              border: "1px solid #38bdf8",
              backgroundColor: "rgba(56, 189, 248, 0.1)",
              pointerEvents: "none",
              zIndex: 40,
            }}
          />
        )}

        <CanvasZoomControls
          onResetZoom={resetZoom}
          onShowHints={() => setShowHints(true)}
        />

        <CanvasStatusBar
          trayWidth={trayWidth}
          trayDepth={trayDepth}
          zoom={zoom}
          selectedIds={effectiveSelectedIds}
          slots={slots}
          collisionErrorCount={collisionState.collisionErrorCount}
        />

        {isEffectiveOversized && (
          <div className="absolute top-14 right-3 z-72 px-3 py-1.5 bg-[#3b1515]/90 border border-[#8b1a1a] rounded-sm text-xs text-[#f2b8b8] font-mono backdrop-blur-sm">
            {isSimpleSteppedCanvas ? "打印边框超限" : "有效底板超限"}:{" "}
            {(isSimpleSteppedCanvas ? trayWidth : effectiveBaseplate.width).toFixed(0)}{" "}
            ×{" "}
            {(isSimpleSteppedCanvas ? trayDepth : effectiveBaseplate.height).toFixed(0)}{" "}
            mm
          </div>
        )}

        <KeyboardHintsOverlay
          showHints={showHints}
          onClose={() => setShowHints(false)}
        />
      </div>

      <div
        className={`shrink-0 cursor-col-resize items-stretch justify-center bg-[#100d0a] transition-[width,opacity] duration-150 flex ${isActionPanelExpanded ? "w-0.75 opacity-100" : "pointer-events-none w-0 opacity-0"}`}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          startActionPanelResize(event.clientX);
        }}
      >
        <div className="my-4 w-px bg-[#2e2a24]" />
      </div>

      <aside
        className={`shrink-0 border-l border-[#2e2a24] bg-[#100d0a] block ${isResizingActionPanel ? "" : "transition-[width] duration-150"}`}
        style={{
          width: isActionPanelExpanded
            ? ACTION_PANEL_TAB_RAIL_WIDTH + actionPanelWidth
            : ACTION_PANEL_TAB_RAIL_WIDTH,
        }}
      >
        <AlignmentToolbar
          selectedIds={effectiveSelectedIds}
          selectedSlots={selectedSymmetrySlots}
          unselectedSlots={unselectedSymmetrySlots}
          enableCopyPreview={
            isActive && !effectiveDraggingId && !isRotating && !isResizingTray
          }
          slots={slots as Array<FreeSlot | SteppedSlot>}
          onUpdateSlots={handleUpdateSlots}
          onInsertSlots={insertSlots}
          spacing={spacing}
          trayWidth={trayWidth}
          trayDepth={trayDepth}
          activeTabId={isActive ? activeActionTab : null}
          onActiveTabChange={setActiveActionTab}
        />
      </aside>
    </div>
  );
}
