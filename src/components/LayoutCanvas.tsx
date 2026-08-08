"use client";

import { useRef, useState, useCallback, useEffect, useMemo, type CSSProperties } from "react";
import type {
  FreeSlot,
  SteppedSlot,
} from "@/types/custom-tray";
import { MAX_BUILD_SIZE } from "@/lib/config";
import { buildCanvasCollisionState } from "@/lib/canvas-collision-model";
import { calculateEffectiveBaseplate } from "@/lib/canvas-slot-geometry";
import { isCustomSlotWithinFixedTrayUsableArea } from "@/lib/custom-layout-math";
import {
  collectCanvasSelection,
  getCanvasSelectionBoxRect,
  sanitizeCanvasSelectedIds,
  shouldApplyCanvasSelectionBox,
} from "@/lib/canvas-selection-model";
import {
  buildLayoutCanvasDragUpdates,
  resolveLayoutCanvasDragStart,
} from "@/lib/layout-canvas-interaction";
import {
  calculateCanvasDragPosition,
  calculateCanvasDragSnap,
} from "@/lib/canvas-snap-engine";
import type {
  CanvasGuideLine,
  CanvasPoint,
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
const HEIGHT_GROUP_PROTECTION_MM = 1;
const SYMMETRY_HIGHLIGHT_DURATION_MS = 5000;
const EMPTY_SET: ReadonlySet<string> = new Set();
const MIDDLE_MOUSE_BUTTON = 1;

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
    removeSlots,
    updateSlotRotation,
    updateMultipleSlots,
    liveUpdateMultipleSlots,
    insertSlots,
    duplicateSlots,
    undo,
    saveSnapshot,
    beginContinuousEdit,
    commitContinuousEdit,
    cancelContinuousEdit,
    selectionChanged,
    editInteractionChanged,
  } = commands;
  const {
    trayFrame,
    slots,
    overlays: {
      focusedGroupId,
      groupOutlines,
      slotGroups,
      footprintWarnings,
    },
    interactions: { slotHeightById, slotMoveScopeResolver },
  } = model;
  const {
    width: trayWidth,
    depth: trayDepth,
    spacing,
    boundarySpacing,
    cornerRadius,
    sideBevelWidth,
    showEffectiveBaseplate,
    showMaxBuildBoundary,
    fixedUsableArea,
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
  const [symmetryHighlightIds, setSymmetryHighlightIds] = useState<
    ReadonlySet<string>
  >(EMPTY_SET);
  const symmetryHighlightTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

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
    canMove: boolean;
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
  const isActionPanelExpanded = activeActionTab !== null;
  const effectiveSelectedIds = useMemo(
    () => sanitizeCanvasSelectedIds(selectedIds, slotById),
    [selectedIds, slotById],
  );
  const effectiveDraggingId =
    draggingId && slotById.has(draggingId) ? draggingId : null;
  const effectiveHoveredId =
    hoveredId && slotById.has(hoveredId) ? hoveredId : null;
  const selectionBoxRect = useMemo(
    () => (selectionBox ? getCanvasSelectionBoxRect(selectionBox) : null),
    [selectionBox],
  );
  const selectedSymmetrySlots = useMemo(
    () => Array.from(effectiveSelectedIds).flatMap((id) => {
      const slot = slotById.get(id);
      return slot ? [slot as SymmetrySlot] : [];
    }),
    [effectiveSelectedIds, slotById],
  );
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
  const heightBySlotId = useMemo(() => {
    const result = new Map<string, number>();

    if (slotHeightById) {
      Object.entries(slotHeightById).forEach(([slotId, height]) => {
        if (Number.isFinite(height)) {
          result.set(slotId, height);
        }
      });
    }

    if (steppedGroupMetaById) {
      slots.forEach((slot) => {
        if ("groupId" in slot) {
          const groupHeight = steppedGroupMetaById.get(slot.groupId)?.bottomHeight;
          if (typeof groupHeight === "number" && Number.isFinite(groupHeight)) {
            result.set(slot.id, groupHeight);
          }
        }
      });
    }

    return result.size > 0 ? result : null;
  }, [slotHeightById, slots, steppedGroupMetaById]);
  const heightGroupSpacingOptions = useMemo(() => {
    if (!heightBySlotId) {
      return undefined;
    }

    return {
      maxSpacing: spacing + HEIGHT_GROUP_PROTECTION_MM,
      getPairSpacing: (
        left: FreeSlot | SteppedSlot,
        right: FreeSlot | SteppedSlot,
        baseSpacing: number,
      ) => {
        const leftHeight = heightBySlotId.get(left.id);
        const rightHeight = heightBySlotId.get(right.id);
        return leftHeight !== undefined &&
          rightHeight !== undefined &&
          leftHeight !== rightHeight
          ? baseSpacing + HEIGHT_GROUP_PROTECTION_MM
          : baseSpacing;
      },
    };
  }, [heightBySlotId, spacing]);
  const selectedIdsRef = useRef<Set<string>>(effectiveSelectedIds);
  const slotsRef = useRef(slots);
  const lastNotifiedSelectedIdsRef = useRef<string[]>([]);

  useEffect(() => {
    selectedIdsRef.current = effectiveSelectedIds;
    slotsRef.current = slots;
  }, [effectiveSelectedIds, slots]);

  useEffect(() => {
    const shouldSyncWhileInactive = selectedIds.size !== effectiveSelectedIds.size;
    if (!isActive && !shouldSyncWhileInactive) {
      return;
    }

    const nextIds = Array.from(effectiveSelectedIds);
    const previousIds = lastNotifiedSelectedIdsRef.current;
    const didSelectionChange =
      nextIds.length !== previousIds.length ||
      nextIds.some((id, index) => id !== previousIds[index]);

    if (!didSelectionChange) {
      return;
    }

    lastNotifiedSelectedIdsRef.current = nextIds;
    selectionChanged?.(nextIds);
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

  const handleSymmetryUnmatched = useCallback((unmatchedIds: string[]) => {
    if (unmatchedIds.length === 0) {
      return;
    }
    setSymmetryHighlightIds(new Set(unmatchedIds));
    if (symmetryHighlightTimerRef.current) {
      clearTimeout(symmetryHighlightTimerRef.current);
    }
    symmetryHighlightTimerRef.current = setTimeout(() => {
      setSymmetryHighlightIds(EMPTY_SET);
      symmetryHighlightTimerRef.current = null;
    }, SYMMETRY_HIGHLIGHT_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (symmetryHighlightTimerRef.current) {
        clearTimeout(symmetryHighlightTimerRef.current);
      }
    };
  }, []);

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

  const clearPointerInteractionState = useCallback(() => {
    setDraggingId(null);
    setIsPanning(false);
    setSelectionBox(null);
    setIsRotating(false);
    setGuideLines([]);
    rotateStartRef.current = null;
    dragStartRef.current = null;
  }, [setIsPanning]);

  const resetTransientCanvasState = useCallback(() => {
    clearPointerInteractionState();
    setHoveredId(null);
    setIsSpacePressed(false);
    stopActionPanelResize();
  }, [clearPointerInteractionState, setIsSpacePressed, stopActionPanelResize]);

  const cancelCanvasInteraction = useCallback(() => {
    flushScheduledLiveUpdates();
    cancelContinuousEdit?.();
    editInteractionChanged?.(false);
    primaryPointerIdRef.current = null;
    clearPointerInteractionState();
  }, [cancelContinuousEdit, clearPointerInteractionState, editInteractionChanged, flushScheduledLiveUpdates]);

  const handleCanvasUndo = useCallback(() => {
    flushScheduledLiveUpdates();
    undo?.();
    editInteractionChanged?.(false);
    primaryPointerIdRef.current = null;
    clearPointerInteractionState();
  }, [clearPointerInteractionState, editInteractionChanged, flushScheduledLiveUpdates, undo]);

  useCanvasKeyboard({
    enabled: isActive,
    selectedIdsRef,
    slotsRef,
    onUpdateSlot: updateSlotPosition,
    onUpdateSlots: handleUpdateSlots,
    onRemoveSlot: removeSlot,
    onRemoveSlots: removeSlots,
    onDuplicateSlots: duplicateSlots,
    onUndo: handleCanvasUndo,
    onCancelInteraction: cancelCanvasInteraction,
    setSelectedIds,
    setIsRotating,
    setIsSpacePressed,
    setIsPanning,
    setShowHints,
  });

  useEffect(() => {
    if (!isActive) {
      flushScheduledLiveUpdates();
      cancelContinuousEdit?.();
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
    cancelContinuousEdit,
    resetTransientCanvasState,
  ]);

  const collisionOptions = useMemo(
    () => ({
      ...heightGroupSpacingOptions,
      getBoundaryReasons: fixedUsableArea
        ? (slot: FreeSlot | SteppedSlot) =>
            isCustomSlotWithinFixedTrayUsableArea(slot, fixedUsableArea)
              ? []
              : ["超出固定托盘可用区域"]
        : undefined,
    }),
    [fixedUsableArea, heightGroupSpacingOptions],
  );

  const collisionState = useMemo(
    () =>
      measurePerf("canvas.collision", () =>
        buildCanvasCollisionState(
          slots,
          spacing,
          undefined,
          collisionOptions,
        ),
      ),
    [collisionOptions, slots, spacing],
  );

  const effectiveBaseplate = useMemo(
    () =>
      calculateEffectiveBaseplate(
        slots,
        trayDepth,
        boundarySpacing,
        undefined,
        sideBevelWidth,
      ),
    [boundarySpacing, sideBevelWidth, slots, trayDepth],
  );

  const fixedBoundaryViolationCount = useMemo(
    () =>
      fixedUsableArea
        ? slots.filter(
            (slot) =>
              (collisionState.collisionMap.get(slot.id)?.boundaryReasons.length ??
                0) > 0,
          ).length
        : 0,
    [collisionState.collisionMap, fixedUsableArea, slots],
  );
  const isEffectiveOversized =
    (fixedUsableArea ? trayWidth : effectiveBaseplate.width) >
      MAX_BUILD_SIZE ||
    (fixedUsableArea ? trayDepth : effectiveBaseplate.height) >
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

    if (beginContinuousEdit) {
      if (beginContinuousEdit() === false) return;
    } else {
      saveSnapshot?.();
    }
    editInteractionChanged?.(true);
    setIsRotating(true);
    setDraggingId(slot.id);
    rotateStartRef.current = {
      angle,
      startRotation: slot.rotation,
    };
  };

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

      if (
        effectiveDraggingId &&
        !isRotating &&
        dragStartRef.current?.canMove
      ) {
        const svgPoint = getSvgPointFromClient(event.clientX, event.clientY);
        if (!svgPoint) {
          return;
        }

        const dragOrigins = dragStartRef.current.slotOrigins;
        let finalDraggingPosition: CanvasPoint;
        if (event.shiftKey) {
          const dragPosition = calculateCanvasDragPosition({
            draggingSlotId: effectiveDraggingId,
            dragOrigins,
            currentMouse: svgPoint,
            startMouse: dragStartRef.current.mouseStart,
          });
          if (!dragPosition) {
            return;
          }

          setGuideLines([]);
          finalDraggingPosition = dragPosition;
        } else {
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
          finalDraggingPosition = {
            x: dragSnap.finalX,
            y: dragSnap.finalY,
          };
        }

        const liveUpdates = buildLayoutCanvasDragUpdates({
          draggingId: effectiveDraggingId,
          dragOrigins,
          finalDraggingPosition,
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

    if (event.button === MIDDLE_MOUSE_BUTTON || isSpacePressed) {
      setIsPanning(true);
      panStartRef.current = { x: event.clientX, y: event.clientY };
      return;
    }

    if (slotId) {
      const wasAlreadySelected = effectiveSelectedIds.has(slotId);
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
      const dragStart = resolveLayoutCanvasDragStart({
        draggingId: slotId,
        selectedIds: Array.from(dragSelection),
        slotById,
        slotMoveScopeResolver,
      });

      if (!dragStart) {
        setDraggingId(null);
        dragStartRef.current = null;
        editInteractionChanged?.(false);
        return;
      }

      if (beginContinuousEdit) {
        if (beginContinuousEdit() === false) return;
      } else {
        saveSnapshot?.();
      }
      editInteractionChanged?.(true);
      setDraggingId(slotId);

      dragStartRef.current = {
        mouseStart: { x: svgPoint.x, y: svgPoint.y },
        slotOrigins: dragStart.origins,
        canMove: !isCtrl && wasAlreadySelected,
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

  const finishPointerInteraction = (cancelled: boolean) => {
    flushScheduledLiveUpdates();
    if (cancelled) {
      cancelContinuousEdit?.();
    } else {
      commitContinuousEdit?.();
    }
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
          onPointerUp={() => finishPointerInteraction(false)}
          onPointerLeave={() => finishPointerInteraction(false)}
          onPointerCancel={() => finishPointerInteraction(true)}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onAuxClick={(event) => {
            if (event.button === MIDDLE_MOUSE_BUTTON) {
              event.preventDefault();
            }
          }}
          preserveAspectRatio="xMidYMid meet"
        >
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
            fixedUsableArea={fixedUsableArea}
            cornerRadius={cornerRadius}
            sideBevelWidth={sideBevelWidth}
            symmetryAxes={symmetryAxes}
            collisionState={collisionState}
            focusedGroupId={focusedGroupId}
            guideLines={guideLines}
            outlinePreview={groupOutlines}
          />

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
            symmetryHighlightIds={symmetryHighlightIds}
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
          footprintWarnings={footprintWarnings}
        />

        {isEffectiveOversized && (
          <div role="alert" className="absolute top-14 right-3 z-72 px-3 py-1.5 bg-[#3b1515]/90 border border-[#8b1a1a] rounded-sm text-xs text-[#f2b8b8] font-mono backdrop-blur-sm">
            {fixedUsableArea ? "打印边框超限" : "有效底板超限"}:{" "}
            {(fixedUsableArea ? trayWidth : effectiveBaseplate.width).toFixed(0)}{" "}
            ×{" "}
            {(fixedUsableArea ? trayDepth : effectiveBaseplate.height).toFixed(0)}{" "}
            mm
          </div>
        )}

        {fixedBoundaryViolationCount > 0 && (
          <div role="alert" className={`absolute ${isEffectiveOversized ? "top-24" : "top-14"} right-3 z-72 px-3 py-1.5 bg-[#3b1515]/90 border border-[#8b1a1a] rounded-sm text-xs text-[#f2b8b8] font-mono backdrop-blur-sm`}>
            有 {fixedBoundaryViolationCount} 个凹槽超出可用区域
          </div>
        )}

        <KeyboardHintsOverlay
          showHints={showHints}
          onClose={() => setShowHints(false)}
        />
      </div>

      <div
        className={`hidden shrink-0 cursor-col-resize items-stretch justify-center bg-[#100d0a] transition-[width,opacity] duration-150 lg:flex ${isActionPanelExpanded ? "lg:w-0.75 lg:opacity-100" : "pointer-events-none lg:w-0 lg:opacity-0"}`}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          startActionPanelResize(event.clientX);
        }}
      >
        <div className="my-4 w-px bg-[#2e2a24]" />
      </div>

      <aside
        aria-label="布局工具"
        className={`block w-full shrink-0 border-t border-[#2e2a24] bg-[#100d0a] lg:h-full lg:w-[var(--action-panel-width)] lg:border-l lg:border-t-0 ${isActionPanelExpanded ? "h-1/2" : "h-14"} ${isResizingActionPanel ? "" : "transition-[width,height] duration-150"}`}
        style={{
          "--action-panel-width": `${isActionPanelExpanded
            ? ACTION_PANEL_TAB_RAIL_WIDTH + actionPanelWidth
            : ACTION_PANEL_TAB_RAIL_WIDTH}px`,
        } as CSSProperties}
      >
        <AlignmentToolbar
          selectedIds={effectiveSelectedIds}
          selectedSlots={selectedSymmetrySlots}
          unselectedSlots={unselectedSymmetrySlots}
          enableCopyPreview={
            isActive && !effectiveDraggingId && !isRotating
          }
          slots={slots as Array<FreeSlot | SteppedSlot>}
          onUpdateSlots={handleUpdateSlots}
          onInsertSlots={insertSlots}
          onSymmetryUnmatched={handleSymmetryUnmatched}
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
