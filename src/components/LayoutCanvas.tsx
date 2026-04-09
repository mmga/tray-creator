"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { FreeSlot, CustomLayoutParams, SteppedLayoutParams, GroupOutlinePreview, SteppedSlot } from "@/types/custom-tray";
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
  type SymmetryInsertSlot,
  type SymmetrySlot,
} from "@/lib/layout-symmetry";

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
const ACTION_PANEL_MIN_WIDTH = 248 - EDIT_SIDEBAR_RAIL_WIDTH - ACTION_PANEL_RESIZER_WIDTH;
const ACTION_PANEL_MAX_WIDTH = 420 - EDIT_SIDEBAR_RAIL_WIDTH - ACTION_PANEL_RESIZER_WIDTH;
const ACTION_PANEL_DEFAULT_WIDTH = 304 - EDIT_SIDEBAR_RAIL_WIDTH - ACTION_PANEL_RESIZER_WIDTH;
const ACTION_PANEL_TAB_RAIL_WIDTH = EDIT_SIDEBAR_RAIL_WIDTH;

interface LayoutCanvasProps {
  isActive?: boolean;
  params: CustomLayoutParams | SteppedLayoutParams;
  onUpdateSlot: (id: string, x: number, y: number) => void;
  onRemoveSlot: (id: string) => void;
  onUpdateSlotRotation?: (id: string, rotation: number) => void;
  onUpdateMultipleSlots?: (updates: CanvasSlotUpdate[]) => void;
  onLiveUpdateMultipleSlots?: (updates: CanvasSlotUpdate[]) => void;
  onInsertSlots?: (slots: SymmetryInsertSlot[]) => void;
  onDuplicateSlots?: (ids: string[]) => string[] | void;
  onUndo?: () => void;
  onSaveSnapshot?: () => void;
  onSelectionChange?: (ids: string[]) => void;
  onEditInteractionChange?: (isInteracting: boolean) => void;
  // 轮廓预览（Stepped 模式：每组独立轮廓）
  outlinePreview?: GroupOutlinePreview[] | null;
  focusedGroupId?: string | null;
}

export default function LayoutCanvas({
  isActive = true,
  params,
  onUpdateSlot,
  onRemoveSlot,
  onUpdateSlotRotation,
  onUpdateMultipleSlots,
  onLiveUpdateMultipleSlots,
  onInsertSlots,
  onDuplicateSlots,
  onUndo,
  onSaveSnapshot,
  onSelectionChange,
  onEditInteractionChange,
  outlinePreview,
  focusedGroupId,
}: LayoutCanvasProps) {
  // Core State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeActionTab, setActiveActionTab] = useState<string | null>(null);

  // Hoisted state (must be before hooks to avoid reference errors)
  const [isRotating, setIsRotating] = useState(false);
  const [showHints, setShowHints] = useState(false);

  // Refs for DOM and logic
  const svgRef = useRef<SVGSVGElement>(null);
  const parentRef = useRef<HTMLDivElement>(null); // To get client rect for marquee
  const rotateStartRef = useRef<{ angle: number; startRotation: number } | null>(null);

  // 主触摸指针 ID（防止多指时第二根手指触发拖拽/框选）
  const primaryPointerIdRef = useRef<number | null>(null);

  // Multi-drag State
  const dragStartRef = useRef<{
    mouseStart: { x: number, y: number }; // SVG coords
    slotOrigins: Map<string, { x: number, y: number }>;
  } | null>(null);

  // Marquee Selection State (Client Coords)
  const [selectionBox, setSelectionBox] = useState<CanvasSelectionBox | null>(null);
  const [guideLines, setGuideLines] = useState<CanvasGuideLine[]>([]);
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

  // Extracted canvas zoom/pan hook
  const {
    zoom, setPan, viewBox, viewW, viewH, minX, minY,
    isSpacePressed, setIsSpacePressed,
    isPanning, setIsPanning,
    panStartRef, handleWheel,
    handleTouchStart, handleTouchMove, handleTouchEnd,
    resetZoom,
  } = useCanvasZoom({
    baseW: params.trayWidth + 40, // trayWidth + (PADDING_MM * 2)
    baseH: params.trayDepth + 40,
    trayWidth: params.trayWidth,
    trayDepth: params.trayDepth,
  });

  const { trayWidth, trayDepth, slots, spacing } = params;
  const slotById = useMemo(
    () => new Map(slots.map((slot) => [slot.id, slot] as const)),
    [slots],
  );
  const slotIds = useMemo(() => new Set(slots.map((slot) => slot.id)), [slots]);
  const isActionPanelExpanded = activeActionTab !== null;
  const effectiveSelectedIds = useMemo(
    () => sanitizeCanvasSelectedIds(selectedIds, slots),
    [selectedIds, slots],
  );
  const effectiveDraggingId = draggingId && slotIds.has(draggingId) ? draggingId : null;
  const effectiveHoveredId = hoveredId && slotIds.has(hoveredId) ? hoveredId : null;
  const selectionBoxRect = useMemo(
    () => (selectionBox ? getCanvasSelectionBoxRect(selectionBox) : null),
    [selectionBox],
  );
  const selectedSymmetrySlots = slots.filter((slot) => effectiveSelectedIds.has(slot.id)) as SymmetrySlot[];
  const unselectedSymmetrySlots = useMemo(
    () => slots.filter((slot) => !effectiveSelectedIds.has(slot.id)) as Array<FreeSlot | SteppedSlot>,
    [effectiveSelectedIds, slots],
  );
  const boundarySpacing = 'boundarySpacingIndependent' in params && params.boundarySpacingIndependent
    ? (params as CustomLayoutParams).boundarySpacing
    : spacing;
  const steppedGroupMetaById = useMemo(() => {
    if (!('groups' in params)) {
      return null;
    }

    return new Map(
        (params as SteppedLayoutParams).groups.map((group) => [group.id, group]),
    );
  }, [params]);
  const selectedIdsRef = useRef<Set<string>>(effectiveSelectedIds);
  const slotsRef = useRef(params.slots);

  useEffect(() => {
    selectedIdsRef.current = effectiveSelectedIds;
    slotsRef.current = params.slots;
  }, [effectiveSelectedIds, params.slots]);

  // Notify parent of selection changes (for stepped mode per-slot editing)
  useEffect(() => {
    const shouldSyncWhileInactive = selectedIds.size !== effectiveSelectedIds.size;
    if (!isActive && !shouldSyncWhileInactive) {
      return;
    }

    onSelectionChange?.(Array.from(effectiveSelectedIds));
  }, [effectiveSelectedIds, isActive, onSelectionChange, selectedIds]);

  // Helper to handle multiple updates
  const handleUpdateSlots = useCallback((updates: CanvasSlotUpdate[]) => {
    if (onUpdateMultipleSlots) {
      onUpdateMultipleSlots(updates);
    } else {
      // Fallback
      onSaveSnapshot?.();
      updates.forEach((update) => {
        onUpdateSlot(update.id, update.x, update.y);
        if (update.rotation !== undefined && onUpdateSlotRotation) {
          onUpdateSlotRotation(update.id, update.rotation);
        }
      });
    }
  }, [onSaveSnapshot, onUpdateMultipleSlots, onUpdateSlot, onUpdateSlotRotation]);

  const applyLiveUpdates = useCallback((updates: CanvasSlotUpdate[]) => {
    if (onLiveUpdateMultipleSlots) {
      onLiveUpdateMultipleSlots(updates);
      return;
    }

    updates.forEach((update) => {
      onUpdateSlot(update.id, update.x, update.y);
      if (update.rotation !== undefined && onUpdateSlotRotation) {
        onUpdateSlotRotation(update.id, update.rotation);
      }
    });
  }, [onLiveUpdateMultipleSlots, onUpdateSlot, onUpdateSlotRotation]);
  const { flushScheduledLiveUpdates, scheduleLiveUpdates } = useLiveSlotUpdates({
    applyLiveUpdates,
  });

  // Extracted canvas keyboard event hook
  useCanvasKeyboard({
    enabled: isActive,
    selectedIdsRef,
    slotsRef,
    onUpdateSlot,
    onRemoveSlot,
    onDuplicateSlots,
    onUndo,
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
    rotateStartRef.current = null;
    dragStartRef.current = null;
    setGuideLines([]);
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
      onEditInteractionChange?.(false);
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
    onEditInteractionChange,
    resetTransientCanvasState,
  ]);

  const collisionState = useMemo(() => {
    return measurePerf("canvas.collision", () =>
      buildCanvasCollisionState(slots, spacing),
    );
  }, [slots, spacing]);

  const effectiveBaseplate = useMemo(
    () => calculateEffectiveBaseplate(slots, trayDepth, boundarySpacing),
    [boundarySpacing, slots, trayDepth],
  );

  const isEffectiveOversized =
    effectiveBaseplate.width > MAX_BUILD_SIZE ||
    effectiveBaseplate.height > MAX_BUILD_SIZE;

  const symmetryAxes = selectedSymmetrySlots.length > 0
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

    onSaveSnapshot?.();
    onEditInteractionChange?.(true);
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

        scheduleLiveUpdates([{
          id: effectiveDraggingId,
          x: slot.x,
          y: slot.y,
          rotation: newRotation,
        }]);
        return;
      }

      if (effectiveDraggingId && !isRotating && dragStartRef.current) {
        const svgPoint = getSvgPointFromClient(event.clientX, event.clientY);
        if (!svgPoint) {
          return;
        }

        const dragOrigins = dragStartRef.current.slotOrigins;
        const draggingOrigin = dragOrigins.get(effectiveDraggingId);
        if (!draggingOrigin) {
          return;
        }

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
      let nextSelection = new Set(effectiveSelectedIds);

      if (isCtrl) {
        if (nextSelection.has(slotId)) {
          nextSelection.delete(slotId);
        } else {
          nextSelection.add(slotId);
        }
        setSelectedIds(nextSelection);
      } else {
        if (!nextSelection.has(slotId)) {
          nextSelection = new Set([slotId]);
          setSelectedIds(nextSelection);
        }
      }

      onSaveSnapshot?.();
      onEditInteractionChange?.(true);
      setDraggingId(slotId);

      const svgPoint = getSvgPointFromClient(event.clientX, event.clientY);
      if (svgPoint) {
        const dragSelection =
          isCtrl && effectiveSelectedIds.has(slotId)
            ? nextSelection
            : nextSelection.has(slotId)
              ? nextSelection
              : new Set([slotId]);

        const origins = new Map<string, { x: number, y: number }>();
        dragSelection.forEach((id) => {
          const slot = slotById.get(id);
          if (slot) {
            origins.set(id, { x: slot.x, y: slot.y });
          }
        });

        dragStartRef.current = {
          mouseStart: { x: svgPoint.x, y: svgPoint.y },
          slotOrigins: origins,
        };
      }
    } else {
      if (!isCtrl) {
        setSelectedIds(new Set());
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
    }
  };

  const handlePointerUp = () => {
    flushScheduledLiveUpdates();
    onEditInteractionChange?.(false);

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
    <div
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-[#120f0c] lg:flex-row"
    >
      <div
        ref={parentRef}
        className={`relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#1c1a16] select-none ${isSpacePressed ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
        style={{ touchAction: 'none' }}
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none transition-all duration-300"
          style={{
            backgroundImage: `linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            backgroundPosition: 'center'
          }}
        />

        <svg
          ref={svgRef}
          viewBox={viewBox}
          className={`w-full h-full max-w-full max-h-full ${isSpacePressed ? '' : 'cursor-crosshair'}`}
          style={{ touchAction: 'none' }}
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
          <CanvasOverlayLayer
            trayWidth={trayWidth}
            trayDepth={trayDepth}
            zoom={zoom}
            minX={minX}
            minY={minY}
            viewW={viewW}
            viewH={viewH}
            showEffectiveBaseplate={!('groups' in params)}
            effectiveBaseplate={effectiveBaseplate}
            cornerRadius={'cornerRadius' in params ? params.cornerRadius : 0}
            symmetryAxes={symmetryAxes}
            collisionState={collisionState}
            focusedGroupId={focusedGroupId}
            guideLines={guideLines}
            outlinePreview={outlinePreview}
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
            onSlotPointerDown={handlePointerDown}
            onSlotPointerEnter={setHoveredId}
            onSlotPointerLeave={() => setHoveredId(null)}
            onSlotRotatePointerDown={handleRotateMouseDown}
          />
        </svg>

        {selectionBoxRect && (
          <div
            style={{
              position: 'absolute',
              left: selectionBoxRect.left,
              top: selectionBoxRect.top,
              width: selectionBoxRect.width,
              height: selectionBoxRect.height,
              border: '1px solid #38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              pointerEvents: 'none',
              zIndex: 40
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
            有效底板超限: {effectiveBaseplate.width.toFixed(0)} × {effectiveBaseplate.height.toFixed(0)} mm
          </div>
        )}

        <KeyboardHintsOverlay
          showHints={showHints}
          onClose={() => setShowHints(false)}
        />

      </div>

      <div
        className={`shrink-0 cursor-col-resize items-stretch justify-center bg-[#100d0a] transition-[width,opacity] duration-150 flex ${isActionPanelExpanded ? 'w-0.75 opacity-100' : 'pointer-events-none w-0 opacity-0'}`}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          startActionPanelResize(event.clientX);
        }}
      >
        <div className="my-4 w-px bg-[#2e2a24]" />
      </div>

      <aside
        className={`shrink-0 border-l border-[#2e2a24] bg-[#100d0a] block ${isResizingActionPanel ? '' : 'transition-[width] duration-150'}`}
        style={{ width: isActionPanelExpanded ? ACTION_PANEL_TAB_RAIL_WIDTH + actionPanelWidth : ACTION_PANEL_TAB_RAIL_WIDTH }}
      >
        <AlignmentToolbar
          selectedIds={effectiveSelectedIds}
          selectedSlots={selectedSymmetrySlots}
          unselectedSlots={unselectedSymmetrySlots}
          enableCopyPreview={isActive && !effectiveDraggingId && !isRotating}
          slots={slots as Array<FreeSlot | SteppedSlot>}
          onUpdateSlots={handleUpdateSlots}
          onInsertSlots={onInsertSlots}
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
