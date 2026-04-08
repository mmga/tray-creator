"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type {
  FreeSlot,
  CustomLayoutParams,
  SteppedLayoutParams,
  GroupOutlinePreview,
  SimpleSteppedRowBand,
  SteppedSlot,
} from "@/types/custom-tray";
import { getSlotTolerance, MAX_BUILD_SIZE } from "@/lib/config";
import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";
import { measurePerf } from "@/lib/perf";
import AlignmentToolbar from "./AlignmentToolbar";
import {
  resolveMirrorAxis,
  type SymmetryInsertSlot,
  type SymmetrySlot,
} from "@/lib/layout-symmetry";

import { useCanvasZoom } from "../hooks/useCanvasZoom";
import { useCanvasKeyboard } from "../hooks/useCanvasKeyboard";
import { CanvasStatusBar } from "./canvas/CanvasStatusBar";
import { CanvasZoomControls } from "./canvas/CanvasZoomControls";
import { KeyboardHintsOverlay } from "./canvas/KeyboardHintsOverlay";
import { EDIT_SIDEBAR_RAIL_WIDTH } from "./canvas/EditSidebar";

const ACTION_PANEL_RESIZER_WIDTH = 3;
const ACTION_PANEL_MIN_WIDTH = 248 - EDIT_SIDEBAR_RAIL_WIDTH - ACTION_PANEL_RESIZER_WIDTH;
const ACTION_PANEL_MAX_WIDTH = 420 - EDIT_SIDEBAR_RAIL_WIDTH - ACTION_PANEL_RESIZER_WIDTH;
const ACTION_PANEL_DEFAULT_WIDTH = 304 - EDIT_SIDEBAR_RAIL_WIDTH - ACTION_PANEL_RESIZER_WIDTH;
const ACTION_PANEL_TAB_RAIL_WIDTH = EDIT_SIDEBAR_RAIL_WIDTH;

type SlotUpdate = { id: string; x: number; y: number; rotation?: number };

interface LayoutCanvasProps {
  isActive?: boolean;
  params: CustomLayoutParams | SteppedLayoutParams;
  onUpdateSlot: (id: string, x: number, y: number) => void;
  onRemoveSlot: (id: string) => void;
  onResizeTray?: (width: number, depth: number) => void;
  onUpdateSlotRotation?: (id: string, rotation: number) => void;
  onUpdateMultipleSlots?: (updates: SlotUpdate[]) => void;
  onLiveUpdateMultipleSlots?: (updates: SlotUpdate[]) => void;
  onInsertSlots?: (slots: SymmetryInsertSlot[]) => void;
  onDuplicateSlots?: (ids: string[]) => string[] | void;
  onUndo?: () => void;
  onSaveSnapshot?: () => void;
  onSelectionChange?: (ids: string[]) => void;
  onEditInteractionChange?: (isInteracting: boolean) => void;
  // 轮廓预览（Stepped 模式：每组独立轮廓）
  outlinePreview?: GroupOutlinePreview[] | null;
  focusedGroupId?: string | null;
  rowBands?: SimpleSteppedRowBand[] | null;
  slotMoveScopeResolver?: (draggingId: string, selectedIds: string[]) => string[];
}

export default function LayoutCanvas({
  isActive = true,
  params,
  onUpdateSlot,
  onRemoveSlot,
  onResizeTray,
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
  rowBands,
  slotMoveScopeResolver,
}: LayoutCanvasProps) {
  // Core State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeActionTab, setActiveActionTab] = useState<string | null>(null);
  const [actionPanelWidth, setActionPanelWidth] = useState(ACTION_PANEL_DEFAULT_WIDTH);
  const [isResizingActionPanel, setIsResizingActionPanel] = useState(false);

  // Hoisted state (must be before hooks to avoid reference errors)
  const [isRotating, setIsRotating] = useState(false);
  const [showHints, setShowHints] = useState(false);

  // Refs for DOM and logic
  const svgRef = useRef<SVGSVGElement>(null);
  const parentRef = useRef<HTMLDivElement>(null); // To get client rect for marquee
  const rotateStartRef = useRef<{ angle: number; startRotation: number } | null>(null);
  const trayResizeRef = useRef<{
    mode: "right" | "bottom" | "corner";
    minWidth: number;
    minDepth: number;
  } | null>(null);

  // 主触摸指针 ID（防止多指时第二根手指触发拖拽/框选）
  const primaryPointerIdRef = useRef<number | null>(null);

  // Multi-drag State
  const dragStartRef = useRef<{
    mouseStart: { x: number, y: number }; // SVG coords
    slotOrigins: Map<string, { x: number, y: number }>;
  } | null>(null);
  const liveUpdateFrameRef = useRef<number | null>(null);
  const pendingLiveUpdatesRef = useRef<SlotUpdate[] | null>(null);
  const [isResizingTray, setIsResizingTray] = useState(false);

  // Marquee Selection State (Client Coords)
  const [selectionBox, setSelectionBox] = useState<{ start: { x: number, y: number }, current: { x: number, y: number } } | null>(null);

  // Smart Guides
  interface GuideLine {
    axis: 'x' | 'y';
    value: number; // SVG coordinate
  }
  interface CollisionInfo {
    boundaryReasons: string[];
    overlapIds: string[];
  }
  const [guideLines, setGuideLines] = useState<GuideLine[]>([]);
  const resizeActionPanelRef = useRef<{ startX: number; startWidth: number } | null>(null);

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
  const isActionPanelExpanded = activeActionTab !== null;
  const effectiveSelectedIds = useMemo<Set<string>>(
    () => new Set(slots.filter((slot) => selectedIds.has(slot.id)).map((slot) => slot.id)),
    [selectedIds, slots],
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
  const selectedIdsRef = useRef(selectedIds);
  const slotsRef = useRef(params.slots);
  const onUpdateSlotRef = useRef(onUpdateSlot);
  const onUndoRef = useRef(onUndo);
  const onSaveSnapshotRef = useRef(onSaveSnapshot);

  useEffect(() => {
    selectedIdsRef.current = effectiveSelectedIds;
    slotsRef.current = params.slots;
    onUpdateSlotRef.current = onUpdateSlot;
    onUndoRef.current = onUndo;
    onSaveSnapshotRef.current = onSaveSnapshot;
  }, [effectiveSelectedIds, onSaveSnapshot, onUndo, onUpdateSlot, params.slots]);

  // Notify parent of selection changes (for stepped mode per-slot editing)
  useEffect(() => {
    const shouldSyncWhileInactive = selectedIds.size !== effectiveSelectedIds.size;
    if (!isActive && !shouldSyncWhileInactive) {
      return;
    }

    onSelectionChange?.(Array.from(effectiveSelectedIds));
  }, [effectiveSelectedIds, isActive, onSelectionChange, selectedIds]);

  useEffect(() => {
    const validIds = new Set(slots.map((slot) => slot.id));
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });

    if (draggingId && !validIds.has(draggingId)) {
      setDraggingId(null);
    }

    if (hoveredId && !validIds.has(hoveredId)) {
      setHoveredId(null);
    }
  }, [draggingId, hoveredId, slots]);

  useEffect(() => {
    if (!isResizingActionPanel) {
      return;
    }

    const stopResize = () => {
      resizeActionPanelRef.current = null;
      setIsResizingActionPanel(false);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const state = resizeActionPanelRef.current;
      if (!state) {
        return;
      }

      const delta = event.clientX - state.startX;
      const nextWidth = Math.max(
        ACTION_PANEL_MIN_WIDTH,
        Math.min(ACTION_PANEL_MAX_WIDTH, state.startWidth - delta),
      );
      setActionPanelWidth(nextWidth);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopResize();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    window.addEventListener("blur", stopResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      window.removeEventListener("blur", stopResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingActionPanel]);

  // Helper to handle multiple updates
  const handleUpdateSlots = useCallback((updates: SlotUpdate[]) => {
    if (onUpdateMultipleSlots) {
      onUpdateMultipleSlots(updates);
    } else {
      // Fallback
      onSaveSnapshotRef.current?.();
      updates.forEach((update) => {
        onUpdateSlot(update.id, update.x, update.y);
        if (update.rotation !== undefined && onUpdateSlotRotation) {
          onUpdateSlotRotation(update.id, update.rotation);
        }
      });
    }
  }, [onUpdateMultipleSlots, onUpdateSlot, onUpdateSlotRotation]);

  const applyLiveUpdates = useCallback((updates: SlotUpdate[]) => {
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

  const flushScheduledLiveUpdates = useCallback(() => {
    if (liveUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(liveUpdateFrameRef.current);
      liveUpdateFrameRef.current = null;
    }

    const pendingUpdates = pendingLiveUpdatesRef.current;
    pendingLiveUpdatesRef.current = null;
    if (!pendingUpdates || pendingUpdates.length === 0) {
      return;
    }

    applyLiveUpdates(pendingUpdates);
  }, [applyLiveUpdates]);

  const scheduleLiveUpdates = useCallback((updates: SlotUpdate[]) => {
    pendingLiveUpdatesRef.current = updates;
    if (liveUpdateFrameRef.current !== null) {
      return;
    }

    liveUpdateFrameRef.current = window.requestAnimationFrame(() => {
      liveUpdateFrameRef.current = null;
      const pendingUpdates = pendingLiveUpdatesRef.current;
      pendingLiveUpdatesRef.current = null;
      if (!pendingUpdates || pendingUpdates.length === 0) {
        return;
      }

      applyLiveUpdates(pendingUpdates);
    });
  }, [applyLiveUpdates]);

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

  useEffect(() => {
    return () => {
      if (liveUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(liveUpdateFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      flushScheduledLiveUpdates();
      onEditInteractionChange?.(false);
      setHoveredId(null);
      setDraggingId(null);
      setGuideLines([]);
      setSelectionBox(null);
      setIsRotating(false);
      setIsPanning(false);
      trayResizeRef.current = null;
      setIsResizingTray(false);
      setIsSpacePressed(false);
      setIsResizingActionPanel(false);
    }
  }, [flushScheduledLiveUpdates, isActive, onEditInteractionChange, setIsPanning, setIsSpacePressed]);

  const getEllipseBoundingBox = (w: number, h: number, rotation: number) => {
    const rad = (rotation * Math.PI) / 180;
    const a = (w + getSlotTolerance(w)) / 2;
    const b = (h + getSlotTolerance(h)) / 2;
    const halfW = Math.sqrt(Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2));
    const halfH = Math.sqrt(Math.pow(a * Math.sin(rad), 2) + Math.pow(b * Math.cos(rad), 2));
    return { halfW, halfH };
  };

  const collisionState = useMemo(() => {
    return measurePerf("canvas.collision", () => {
      const collisionMap = new Map<string, CollisionInfo>();
      const involvedIds = new Set<string>();
      const connectorPairs: Array<{ key: string; firstId: string; secondId: string }> = [];
      const slotById = new Map(slots.map((slot) => [slot.id, slot]));

      if (slots.length === 0) {
        return {
          collisionErrorCount: 0,
          collisionMap,
          connectorPairs,
          involvedIds,
          slotById,
        };
      }

      const expandedBounds = slots
        .map((slot) => {
          const margin = spacing / 2 + getSlotTolerance(slot.width) / 2;
          const { halfW, halfH } = getEllipseBoundingBox(
            slot.width,
            slot.height,
            slot.rotation,
          );

          return {
            slot,
            margin,
            minX: slot.x - halfW - margin,
            maxX: slot.x + halfW + margin,
            minY: slot.y - halfH - margin,
            maxY: slot.y + halfH + margin,
          };
        })
        .sort((a, b) => a.minX - b.minX);
      const expandedPolygons = new Map<string, ReturnType<typeof getEllipsePolygon>>();
      const getExpandedPolygon = (slot: typeof slots[number], margin: number) => {
        const cached = expandedPolygons.get(slot.id);
        if (cached) {
          return cached;
        }

        const polygon = getEllipsePolygon(
          slot.x,
          slot.y,
          slot.width,
          slot.height,
          slot.rotation,
          margin,
          12,
        );
        expandedPolygons.set(slot.id, polygon);
        return polygon;
      };

      slots.forEach((slot) => {
        collisionMap.set(slot.id, {
          boundaryReasons: [],
          overlapIds: [],
        });
      });

      let collisionErrorCount = 0;
      for (let i = 0; i < expandedBounds.length; i++) {
        const current = expandedBounds[i];

        for (let j = i + 1; j < expandedBounds.length; j++) {
          const other = expandedBounds[j];
          if (other.minX > current.maxX) {
            break;
          }

          if (current.maxY < other.minY || other.maxY < current.minY) {
            continue;
          }

          const currentPoly = getExpandedPolygon(current.slot, current.margin);
          const otherPoly = getExpandedPolygon(other.slot, other.margin);
          if (!polygonsIntersect(currentPoly, otherPoly)) {
            continue;
          }

          collisionMap.get(current.slot.id)?.overlapIds.push(other.slot.id);
          collisionMap.get(other.slot.id)?.overlapIds.push(current.slot.id);
          involvedIds.add(current.slot.id);
          involvedIds.add(other.slot.id);
          collisionErrorCount += 1;
          connectorPairs.push({
            key: [current.slot.id, other.slot.id].sort().join("|"),
            firstId: current.slot.id,
            secondId: other.slot.id,
          });
        }
      }

      return {
        collisionErrorCount,
        collisionMap,
        connectorPairs,
        involvedIds,
        slotById,
      };
    });
  }, [slots, spacing]);

  // ... (keep existing helpers)

  // Rotation Handle Logic
  const handleRotateMouseDown = (e: React.PointerEvent, slot: FreeSlot) => {
    e.preventDefault();
    e.stopPropagation();

    if (!svgRef.current) return;

    // Calculate initial angle
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

    // Slot center in SVG coords
    const slotCx = slot.x;
    const slotCy = trayDepth - slot.y;

    // SVG Y is down, so dy is inverted relative to standard cartesian if we want CCW positive.
    // However, we just need delta. 
    const angle = Math.atan2(svgP.y - slotCy, svgP.x - slotCx);

    onSaveSnapshotRef.current?.(); // 保存快照供撤销
    onEditInteractionChange?.(true);
    setIsRotating(true);
    setDraggingId(slot.id); // Set draggingId to keep slot active/highlighted
    rotateStartRef.current = {
      angle: angle,
      startRotation: slot.rotation
    };
  };

  // ... (Rotation Logic added previously)

  // ... (Rotation Logic added previously)

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    measurePerf("canvas.pointermove", () => {
      e.preventDefault();

      // 多指防护：仅处理主指针的移动事件
      if (e.pointerType === 'touch' && primaryPointerIdRef.current !== null && e.pointerId !== primaryPointerIdRef.current) {
        return;
      }

      // Pan
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        if (svgRef.current) {
          const screenCTM = svgRef.current.getScreenCTM();
          if (screenCTM) {
            const scale = screenCTM.a;
            setPan(prev => ({
              x: prev.x + dx / scale,
              y: prev.y + dy / scale
            }));
          }
        }
        panStartRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (rowBands && trayResizeRef.current && svgRef.current && onResizeTray) {
        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
        const nextWidth = Math.max(
          trayResizeRef.current.minWidth,
          Math.min(MAX_BUILD_SIZE, svgP.x),
        );
        const nextDepth = Math.max(
          trayResizeRef.current.minDepth,
          Math.min(MAX_BUILD_SIZE, svgP.y),
        );

        if (trayResizeRef.current.mode === "right") {
          onResizeTray(nextWidth, trayDepth);
        } else if (trayResizeRef.current.mode === "bottom") {
          onResizeTray(trayWidth, nextDepth);
        } else {
          onResizeTray(nextWidth, nextDepth);
        }
        return;
      }

      // Marquee Selection
      if (selectionBox) {
        // Just update current point
        const rect = parentRef.current?.getBoundingClientRect();
        if (rect) {
          setSelectionBox(prev => prev ? { ...prev, current: { x: e.clientX - rect.left, y: e.clientY - rect.top } } : null);
        }
        return;
      }

      // Rotate (Single Item)
      if (isRotating && draggingId && svgRef.current && rotateStartRef.current) {
        const slot = slots.find(s => s.id === draggingId);
        if (!slot) return;

        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

        const slotCx = slot.x;
        const slotCy = trayDepth - slot.y;

        const currentAngle = Math.atan2(svgP.y - slotCy, svgP.x - slotCx);
        const deltaAngle = currentAngle - rotateStartRef.current.angle;
        const deltaDeg = deltaAngle * (180 / Math.PI);

        let newRotation = rotateStartRef.current.startRotation - deltaDeg;
        if (e.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }
        // 限定为 1 度为步长，不使用小数
        newRotation = Math.round((newRotation % 360 + 360) % 360);

        scheduleLiveUpdates([{
          id: draggingId,
          x: slot.x,
          y: slot.y,
          rotation: newRotation,
        }]);
        return;
      }

      // Drag (Multi-item support)
      if (draggingId && !isRotating && svgRef.current && dragStartRef.current) {
        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

        // Calculate new position for the PRIMARY dragged slot
        // We use the same offset logic for snapping
        const dragOrigins = dragStartRef.current.slotOrigins;
        const dragSlotOrigin = dragOrigins.get(draggingId);
        if (!dragSlotOrigin) return;

        // Current Mouse - Start Mouse = Delta for all
        // But we need snapping for the Primary.
        // Let's first calculate "Proposed Position" of Primary based on simple delta
        const totalDx = svgP.x - dragStartRef.current.mouseStart.x;
        // Note: SVG Y increases downwards. Slot Y increases upwards.
        // DeltaY in SVG = +10 => Slot Y should vary by -10.
        const totalPhysDx = totalDx;
        const totalPhysDy = -(svgP.y - dragStartRef.current.mouseStart.y);

        // Proposed Primary Phys Position
        // Apply smooth snap
        const snapStep = 0.2; // 0.2mm smooth snap
        const roundToStep = (val: number) => Math.round(val / snapStep) * snapStep;

        const proposedX = roundToStep(dragSlotOrigin.x + totalPhysDx);
        const proposedY = roundToStep(dragSlotOrigin.y + totalPhysDy);

        // Apply Snapping to Proposed Position
        const dragSlot = slots.find(s => s.id === draggingId);
        const dragBB = dragSlot ? getEllipseBoundingBox(dragSlot.width, dragSlot.height, dragSlot.rotation) : { halfW: 0, halfH: 0 };
        const dragRx = dragBB.halfW;
        const dragRy = dragBB.halfH;

        const SNAP_THRESHOLD = 1.5;
        const trayCenterX = trayWidth / 2;
        const trayCenterY = trayDepth / 2;
        const guides: GuideLine[] = [];

        let finalX = proposedX;
        let finalY = proposedY;
        let bestXSnap: { target: number; guide: number; distance: number } | null = null;
        let bestYSnap: { target: number; guide: number; distance: number } | null = null;

        const considerXSnap = (target: number, guide: number) => {
          const distance = Math.abs(proposedX - target);
          if (distance >= SNAP_THRESHOLD) return;
          if (!bestXSnap || distance < bestXSnap.distance) {
            bestXSnap = { target, guide, distance };
          }
        };

        const considerYSnap = (target: number, guide: number) => {
          const distance = Math.abs(proposedY - target);
          if (distance >= SNAP_THRESHOLD) return;
          if (!bestYSnap || distance < bestYSnap.distance) {
            bestYSnap = { target, guide, distance };
          }
        };

        // Snap Logic (Same as before, but checking proposedX/Y)
        for (const other of slots) {
          if (dragOrigins.has(other.id)) continue; // Don't snap to moved items

          const otherBB = getEllipseBoundingBox(other.width, other.height, other.rotation);
          const otherRx = otherBB.halfW;
          const otherRy = otherBB.halfH;

          considerXSnap(other.x, other.x);
          considerXSnap(other.x - otherRx + dragRx, other.x - otherRx);
          considerXSnap(other.x + otherRx - dragRx, other.x + otherRx);

          considerYSnap(other.y, other.y);
          considerYSnap(other.y - otherRy + dragRy, other.y - otherRy);
          considerYSnap(other.y + otherRy - dragRy, other.y + otherRy);
        }

        considerXSnap(trayCenterX, trayCenterX);
        considerYSnap(trayCenterY, trayCenterY);

        const resolvedXSnap = bestXSnap as { target: number; guide: number; distance: number } | null;
        if (resolvedXSnap) {
          finalX = resolvedXSnap.target;
          guides.push({ axis: 'x', value: resolvedXSnap.guide });
        }

        const resolvedYSnap = bestYSnap as { target: number; guide: number; distance: number } | null;
        if (resolvedYSnap) {
          finalY = resolvedYSnap.target;
          guides.push({ axis: 'y', value: trayDepth - resolvedYSnap.guide });
        }

        setGuideLines(guides);

        // Calculate FINAL delta based on snapped position
        const finalDeltaX = finalX - dragSlotOrigin.x;
        const finalDeltaY = finalY - dragSlotOrigin.y;

        // Apply to ALL selected slots
        const liveUpdates: SlotUpdate[] = [];
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
  }, [draggingId, isPanning, isRotating, onResizeTray, panStartRef, rowBands, scheduleLiveUpdates, selectionBox, setPan, trayDepth, trayWidth, slots]);

  const handlePointerDown = useCallback((e: React.PointerEvent, slotId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    // 多指防护：仅追踪主指针（第一根手指），后续手指忽略
    if (e.pointerType === 'touch') {
      if (primaryPointerIdRef.current !== null && primaryPointerIdRef.current !== e.pointerId) {
        // 第二根手指触碰，让 touch 事件处理双指缩放
        return;
      }
      primaryPointerIdRef.current = e.pointerId;
    }

    // Capture pointer for reliable tracking (especially on touch)
    (e.target as Element)?.setPointerCapture?.(e.pointerId);

    const isCtrl = e.ctrlKey || e.metaKey;

    // Panning Mode
    if (isSpacePressed) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (slotId) {
      // Slot Click
      let newSelection = new Set(selectedIds);

      if (isCtrl) {
        // Toggle
        if (newSelection.has(slotId)) newSelection.delete(slotId);
        else newSelection.add(slotId);
        setSelectedIds(newSelection);
      } else {
        // Normal Click
        if (!newSelection.has(slotId)) {
          // Select Single
          newSelection = new Set([slotId]);
          setSelectedIds(newSelection);
        }
        // If already selected, keep selection (to allow multi-drag)
      }

      // Init Drag Data
      if (svgRef.current) {
        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

        const origins = new Map<string, { x: number, y: number }>();
        // Just be safe: ensure slotId is in newSelection? 
        // If Ctrl-Deselected, it shouldn't drag? 
        // Standard: You can drag a deselcted item (it selects itself).
        // But my logic handling above toggles it.
        // If I Ctrl-Click to deselect, I shouldn't drag it essentially? 
        // Or I should drag it as single?
        // Let's assume if I deselect, draggingId is set but it's not in selectedIds?
        // If so, loop below won't find it.
        // Let's handle: if draggingId not in selection, drag it alone?
        // No, simpler: on MouseMove, we loop selectedIds.
        // So if deselected, nothing moves? 
        // That's weird.
        // Fix: If Ctrl-Click DESELECTS, we should probably NOT start drag, or clear draggingId immediately?
        // Or just let it be. Move won't update anything.

        // Store origins for all currently selected items
        const setIds = isCtrl && selectedIds.has(slotId) ? newSelection : (newSelection.has(slotId) ? newSelection : new Set([slotId]));
        const scopedDragIds = slotMoveScopeResolver
          ? slotMoveScopeResolver(slotId, Array.from(setIds))
          : Array.from(setIds);

        if (scopedDragIds.length === 0) {
          setDraggingId(null);
          dragStartRef.current = null;
          onEditInteractionChange?.(false);
          return;
        }

        onSaveSnapshotRef.current?.(); // 保存快照供撤销
        onEditInteractionChange?.(true);
        setDraggingId(slotId);

        scopedDragIds.forEach(id => {
          const s = slots.find(sl => sl.id === id);
          if (s) origins.set(id, { x: s.x, y: s.y });
        });

        dragStartRef.current = {
          mouseStart: { x: svgP.x, y: svgP.y },
          slotOrigins: origins
        };
      }

    } else {
      // Background Click
      if (!isCtrl) {
        setSelectedIds(new Set());
      }
      // 仅鼠标启动框选，触屏上点击空白区域只做取消选中
      if (e.pointerType !== 'touch') {
        const rect = parentRef.current?.getBoundingClientRect();
        if (rect) {
          setSelectionBox({
            start: { x: e.clientX - rect.left, y: e.clientY - rect.top },
            current: { x: e.clientX - rect.left, y: e.clientY - rect.top }
          });
        }
      }
    }
  }, [isSpacePressed, onEditInteractionChange, panStartRef, selectedIds, setIsPanning, slotMoveScopeResolver, slots, trayDepth]);

  const handlePointerUp = useCallback(() => {
    flushScheduledLiveUpdates();
    onEditInteractionChange?.(false);

    // 释放主指针追踪
    primaryPointerIdRef.current = null;

    // End Marquee
    if (selectionBox && svgRef.current && parentRef.current) {
      const boxRect = {
        left: Math.min(selectionBox.start.x, selectionBox.current.x),
        top: Math.min(selectionBox.start.y, selectionBox.current.y),
        right: Math.max(selectionBox.start.x, selectionBox.current.x),
        bottom: Math.max(selectionBox.start.y, selectionBox.current.y)
      };
      const w = boxRect.right - boxRect.left;
      const h = boxRect.bottom - boxRect.top;

      if (w > 2 || h > 2) { // Tolerance
        // Check Intersection with Slots
        // Need to check Screen vs Screen Rects?
        // Or convert Box to SVG? 
        // Slots are rendered in SVG.
        // Use getBoundingClientRect of slot elements?
        const newSel = new Set(selectedIds);

        // We can use DOM logic since slots are DOM elements?
        // Or Math logic. Math logic requires converting selectionBox to SVG coords.
        const pt = svgRef.current.createSVGPoint();
        const ctm = svgRef.current.getScreenCTM();
        if (ctm) {
          const containerRect = parentRef.current.getBoundingClientRect();
          // Box is relative to container.
          // Screen Coords:
          const screenLeft = containerRect.left + boxRect.left;
          const screenTop = containerRect.top + boxRect.top;
          const screenRight = containerRect.left + boxRect.right;
          const screenBottom = containerRect.top + boxRect.bottom;

          slots.forEach(slot => {
            // Get slot screen rect? Hard without iterating DOM.
            // Use DOM query based on data-id?
            // Or just Math with screenCTM?
            // Let's use logic:
            // Slot Center in SVG: (slot.x, trayDepth - slot.y)
            // Convert to Screen?
            pt.x = slot.x;
            pt.y = trayDepth - slot.y;
            const slotScreen = pt.matrixTransform(ctm);

            if (slotScreen.x >= screenLeft && slotScreen.x <= screenRight &&
              slotScreen.y >= screenTop && slotScreen.y <= screenBottom) {
              newSel.add(slot.id);
            }
          });
          setSelectedIds(newSel);
        }
      }
    }

    setDraggingId(null);
    setIsPanning(false);
    trayResizeRef.current = null;
    setIsResizingTray(false);
    setSelectionBox(null);
    setIsRotating(false);
    rotateStartRef.current = null;
    dragStartRef.current = null;
    setGuideLines([]);
  }, [flushScheduledLiveUpdates, onEditInteractionChange, selectionBox, selectedIds, setIsPanning, slots, trayDepth]);

  const effectiveBaseplate = (() => {
    if (slots.length === 0) {
      return {
        hasSlots: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const slot of slots) {
      const { halfW, halfH } = getEllipseBoundingBox(
        slot.width,
        slot.height,
        slot.rotation,
      );
      minX = Math.min(minX, slot.x - halfW);
      maxX = Math.max(maxX, slot.x + halfW);
      minY = Math.min(minY, slot.y - halfH);
      maxY = Math.max(maxY, slot.y + halfH);
    }

    const width = Math.max(0, maxX - minX + boundarySpacing * 2);
    const height = Math.max(0, maxY - minY + boundarySpacing * 2);
    const left = minX - boundarySpacing;
    const top = trayDepth - (maxY + boundarySpacing);

    return {
      hasSlots: true,
      x: left,
      y: top,
      width,
      height,
    };
  })();

  const isSimpleSteppedCanvas = Boolean(rowBands);
  const isEffectiveOversized =
    (isSimpleSteppedCanvas ? trayWidth : effectiveBaseplate.width) > MAX_BUILD_SIZE ||
    (isSimpleSteppedCanvas ? trayDepth : effectiveBaseplate.height) > MAX_BUILD_SIZE;

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
  const minimumTrayBounds = useMemo(() => {
    if (!rowBands || rowBands.length === 0) {
      return {
        width: effectiveBaseplate.width,
        depth: effectiveBaseplate.height,
      };
    }

    const minX = Math.min(...rowBands.map((band) => band.x));
    const maxX = Math.max(...rowBands.map((band) => band.x + band.width));
    const minY = Math.min(...rowBands.map((band) => band.y));
    const maxY = Math.max(...rowBands.map((band) => band.y + band.depth));

    return {
      width: Math.max(0, maxX - minX),
      depth: Math.max(0, maxY - minY),
    };
  }, [effectiveBaseplate.height, effectiveBaseplate.width, rowBands]);
  const trayOutlineStroke = "#4b5563";
  const trayOutlineStrokeWidth = 0.5 / zoom;
  const trayOutlineStrokeDash = `${3 / zoom} ${3 / zoom}`;
  const trayOutlineStrokeOpacity = 0.9;
  const axisGuideStroke = "#38bdf8";
  const axisGuideStrokeWidth = 0.3 / zoom;
  const axisGuideStrokeDash = `${2 / zoom} ${2 / zoom}`;
  const axisGuideStrokeOpacity = 0.8;
  const trayResizeHandleSize = 10 / zoom;
  const trayResizeHitSize = 14 / zoom;

  const startTrayResize = useCallback(
    (
      event: React.PointerEvent,
      mode: "right" | "bottom" | "corner",
    ) => {
      if (!onResizeTray || !rowBands) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      (event.target as Element)?.setPointerCapture?.(event.pointerId);
      onSaveSnapshotRef.current?.();
      onEditInteractionChange?.(true);
      trayResizeRef.current = {
        mode,
        minWidth: Math.max(1, minimumTrayBounds.width),
        minDepth: Math.max(1, minimumTrayBounds.depth),
      };
      setIsResizingTray(true);
    },
    [minimumTrayBounds.depth, minimumTrayBounds.width, onEditInteractionChange, onResizeTray, rowBands],
  );

  return (
    <div
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-[#120f0c] lg:flex-row"
    >
      <div
        ref={parentRef}
        className={`relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#1c1a16] select-none ${isSpacePressed ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
        style={{ touchAction: 'none' }}
      >
        {/* Debug Info Overlay (Bottom Right) inside the canvas container or separate? */}

        {/* ... (Background Grid and SVG setup unchanged) ... */}

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
          onPointerDown={(e) => handlePointerDown(e)}
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
          {/* Virtual Canvas (outer) */}
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

          {/* Effective Baseplate (inner) */}
          {!('groups' in params) && !isSimpleSteppedCanvas && effectiveBaseplate.hasSlots && (
            <rect
              x={effectiveBaseplate.x}
              y={effectiveBaseplate.y}
              width={effectiveBaseplate.width}
              height={effectiveBaseplate.height}
              fill="none"
              stroke="#8b7355"
              strokeWidth={0.7 / zoom}
              rx={Math.max(0, Math.min('cornerRadius' in params ? params.cornerRadius : 0, effectiveBaseplate.width / 2, effectiveBaseplate.height / 2))}
              strokeOpacity={0.95}
            />
          )}

          {onResizeTray && isSimpleSteppedCanvas && (
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
              <line
                x1={trayWidth}
                y1={0}
                x2={trayWidth}
                y2={trayDepth}
                stroke={isResizingTray ? "#fbbf24" : "#8b7355"}
                strokeWidth={0.5 / zoom}
                strokeOpacity={0.7}
                pointerEvents="none"
              />
              <line
                x1={0}
                y1={trayDepth}
                x2={trayWidth}
                y2={trayDepth}
                stroke={isResizingTray ? "#fbbf24" : "#8b7355"}
                strokeWidth={0.5 / zoom}
                strokeOpacity={0.7}
                pointerEvents="none"
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

          {rowBands && rowBands.map((band) => (
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

          {/* Slots */}
          {slots.map((slot) => {
              // Geometry
              const w = slot.width + getSlotTolerance(slot.width);
              const h = slot.height + getSlotTolerance(slot.height);

              // Position
              const svgY = trayDepth - slot.y;

              // Collision Check (from pre-computed map)
              const info = collisionState.collisionMap.get(slot.id) ?? {
                boundaryReasons: [],
                overlapIds: [],
              };
              const isBoundary = info.boundaryReasons.length > 0;
              const isOverlap = info.overlapIds.length > 0;
              const isColliding = isBoundary || isOverlap;
              // 此槽位是否被别人的碰撞牵连高亮（但自身并非碰撞源）
              const isInvolvedViaOther = !isColliding && collisionState.involvedIds.has(slot.id);

              const isHovered = hoveredId === slot.id;
              const isDragging = draggingId === slot.id;
              const isSelected = selectedIds.has(slot.id);
              const color = isSelected ? "#f97316" : "#eab308"; // Orange if selected, else Yellow

              // Heatmap color for bottomHeight label text (legacy, kept for safety)
              const bhLabelColor = "#86efac";

              // 分组颜色（Stepped 模式通过 groupId 查组色）
              const isSteppedSlot = 'groupId' in slot;
              const isDimmedByGroupFocus = Boolean(
                focusedGroupId &&
                isSteppedSlot &&
                (slot as { groupId: string }).groupId !== focusedGroupId,
              );
              const groupMeta = isSteppedSlot && steppedGroupMetaById
                ? steppedGroupMetaById.get((slot as { groupId: string }).groupId)
                : null;
              const groupColor = isSteppedSlot
                ? (groupMeta?.color ?? "#86efac")
                : null;

              return (
                <g
                  key={slot.id}
                  transform={`translate(${slot.x}, ${svgY}) rotate(${-slot.rotation})`} // Rotation! Note: SVG Y is inverted, so maybe rotation direction needs care. -Rotation fits typical 2D intuition if Y is up.
                  onPointerDown={(e) => handlePointerDown(e, slot.id)}
                  onPointerEnter={() => setHoveredId(slot.id)}
                  onPointerLeave={() => setHoveredId(null)}
                  className={`transition-opacity duration-200 ${isSpacePressed ? '' : 'cursor-move'}`}
                  style={{ opacity: (isDragging ? 0.9 : 1) * (isDimmedByGroupFocus ? 0.18 : 1) }}
                >
                  {/* Margin / Safe Area Indicator - colored by group for stepped mode */}
                  <ellipse
                    rx={w / 2 + spacing}
                    ry={h / 2 + spacing}
                    fill="none"
                    stroke={isColliding ? "#ef4444" : isInvolvedViaOther ? "#ef4444" : (groupColor ?? "#888")}
                    strokeWidth={0.25 / zoom}
                    strokeDasharray="2 2"
                    opacity={isColliding ? 1 : isInvolvedViaOther ? 0.7 : (groupColor ? 0.5 : 0.6)}
                    pointerEvents="none"
                  />

                  {/* Highlight Halo - Inside - Show if Hovered/Dragging/Colliding (Selection uses fill color) */}
                  {(isColliding || isInvolvedViaOther || isHovered || isDragging) && (
                    <ellipse
                      rx={Math.max(0, w / 2 - 0.5 / zoom)}
                      ry={Math.max(0, h / 2 - 0.5 / zoom)}
                      fill="none"
                      stroke={isColliding || isInvolvedViaOther ? "#ef4444" : "#fbbf24"}
                      strokeWidth={0.8 / zoom}
                      strokeOpacity={0.8}
                      pointerEvents="none"
                    />
                  )}

                  {/* Slot Shape */}
                  <ellipse
                    rx={w / 2}
                    ry={h / 2}
                    fill={isSteppedSlot
                      ? (isSelected ? "#f97316" : (groupColor ?? bhLabelColor))
                      : color}
                    fillOpacity={0.85}
                    stroke={isColliding || isInvolvedViaOther ? "#ef4444"
                      : isSteppedSlot ? (groupColor ? groupColor + "cc" : "#fff")
                        : "#fff"}
                    strokeWidth={(isColliding || isInvolvedViaOther ? 0.5 : isSteppedSlot ? 0.4 : 0.2) / zoom}
                  />

                  {/* Size Text */}
                  <text
                    dy={isSteppedSlot ? -Math.min(w, h) * 0.12 : Math.min(w, h) * 0.2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.min(w, h, 24) / 2}
                    fill="#fff"
                    fontWeight="bold"
                    pointerEvents="none"
                    style={{ userSelect: 'none' }}
                  >
                    {slot.width === slot.height ? slot.width : `${slot.width}x${slot.height}`}
                  </text>

                  {/* Rotation Handle - Only show when SELECTED and NOT a circle */}
                  {isSelected && Math.abs(slot.width - slot.height) > 0.01 && (
                    <g
                      transform={`translate(${w / 2 + spacing + 4}, 0)`}
                      onPointerDown={(e) => handleRotateMouseDown(e, slot)}
                      className="cursor-pointer"
                      style={{ cursor: 'grab' }}
                    >
                      {/* Transparent bigger hit area */}
                      <circle
                        r={6 / zoom}
                        fill="transparent"
                      />
                      {/* Connection Line - Solid */}
                      <line
                        x1={-(4 + spacing)}
                        y1={0}
                        x2={0}
                        y2={0}
                        stroke="#fff"
                        strokeWidth={0.5 / zoom}
                        pointerEvents="none"
                      />
                      {/* Handle Circle - Smaller & Solid */}
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
              );
          })}

          {/* Collision connector lines — 连接冲突的槽位对，增强可理解性 */}
          {collisionState.connectorPairs.map((pair) => {
            const slot = collisionState.slotById.get(pair.firstId);
            const other = collisionState.slotById.get(pair.secondId);
            if (!slot || !other) {
              return null;
            }

            const lineOpacity = !focusedGroupId
              ? 0.6
              : (('groupId' in slot && slot.groupId === focusedGroupId) || ('groupId' in other && other.groupId === focusedGroupId))
                ? 0.5
                : 0.12;

            return (
              <line
                key={`col-${pair.key}`}
                x1={slot.x} y1={trayDepth - slot.y}
                x2={other.x} y2={trayDepth - other.y}
                stroke="#ef4444"
                strokeWidth={0.5 / zoom}
                strokeDasharray="3 2"
                opacity={lineOpacity}
                pointerEvents="none"
              />
            );
          })}

          {/* Smart Guide Lines */}
          {guideLines.map((g, i) => (
            g.axis === 'x'
              ? <line key={`guide-${i}`} x1={g.value} y1={minY} x2={g.value} y2={minY + viewH}
                stroke={axisGuideStroke} strokeWidth={axisGuideStrokeWidth} strokeDasharray={axisGuideStrokeDash} pointerEvents="none" opacity={axisGuideStrokeOpacity} />
              : <line key={`guide-${i}`} x1={minX} y1={g.value} x2={minX + viewW} y2={g.value}
                stroke={axisGuideStroke} strokeWidth={axisGuideStrokeWidth} strokeDasharray={axisGuideStrokeDash} pointerEvents="none" opacity={axisGuideStrokeOpacity} />
          ))}

          {/* 分组轮廓预览（Stepped 模式：按高度升序渲染，高组颜色压住低组，重叠处显示最高组颜色） */}
          {outlinePreview && outlinePreview.map((go) => {
            if (go.points.length < 3) return null;
            const isDimmed = Boolean(focusedGroupId && go.groupId !== focusedGroupId);
            const pathData = go.points
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${(trayDepth - p.y).toFixed(2)}`)
              .join(' ') + ' Z';
            return (
              <path
                key={go.key}
                d={pathData}
                fill="none"
                stroke={go.color}
                strokeWidth={0.9 / zoom}
                strokeOpacity={isDimmed ? 0.16 : 0.85}
                pointerEvents="none"
              />
            );
          })}
        </svg>

        {/* Marquee Selection Box */}
        {selectionBox && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(selectionBox.start.x, selectionBox.current.x),
              top: Math.min(selectionBox.start.y, selectionBox.current.y),
              width: Math.abs(selectionBox.current.x - selectionBox.start.x),
              height: Math.abs(selectionBox.current.y - selectionBox.start.y),
              border: '1px solid #38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              pointerEvents: 'none',
              zIndex: 40
            }}
          />
        )}

        {/* Extracted UI Overlays */}
        <CanvasZoomControls
          onResetZoom={resetZoom}
          onShowHints={() => setShowHints(true)}
        />

        <CanvasStatusBar
          trayWidth={trayWidth}
          trayDepth={trayDepth}
          zoom={zoom}
          selectedIds={selectedIds}
          slots={slots}
          collisionErrorCount={collisionState.collisionErrorCount}
        />

        {isEffectiveOversized && (
          <div className="absolute top-14 right-3 z-72 px-3 py-1.5 bg-[#3b1515]/90 border border-[#8b1a1a] rounded-sm text-xs text-[#f2b8b8] font-mono backdrop-blur-sm">
            {isSimpleSteppedCanvas ? "打印边框超限" : "有效底板超限"}: {(isSimpleSteppedCanvas ? trayWidth : effectiveBaseplate.width).toFixed(0)} × {(isSimpleSteppedCanvas ? trayDepth : effectiveBaseplate.height).toFixed(0)} mm
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
          resizeActionPanelRef.current = {
            startX: event.clientX,
            startWidth: actionPanelWidth,
          };
          setIsResizingActionPanel(true);
        }}
      >
        <div className="my-4 w-px bg-[#2e2a24]" />
      </div>

      <aside
        className={`shrink-0 border-l border-[#2e2a24] bg-[#100d0a] block ${isResizingActionPanel ? '' : 'transition-[width] duration-150'}`}
        style={{ width: isActionPanelExpanded ? ACTION_PANEL_TAB_RAIL_WIDTH + actionPanelWidth : ACTION_PANEL_TAB_RAIL_WIDTH }}
      >
        <AlignmentToolbar
          selectedIds={selectedIds}
          selectedSlots={selectedSymmetrySlots}
          unselectedSlots={unselectedSymmetrySlots}
          enableCopyPreview={isActive && !draggingId && !isRotating}
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
