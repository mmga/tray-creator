"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { FreeSlot, CustomLayoutParams, SteppedLayoutParams, GroupOutlinePreview } from "@/types/custom-tray";
import type { OutlineData } from "@/lib/outline-geometry";
import { getSlotTolerance, MAX_BUILD_SIZE } from "@/lib/config";
import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";
import AlignmentToolbar from "./AlignmentToolbar";
import { Trash2, Undo2, Copy, XCircle } from "lucide-react";

import { useCanvasZoom } from "../hooks/useCanvasZoom";
import { useCanvasKeyboard } from "../hooks/useCanvasKeyboard";
import { CanvasStatusBar } from "./canvas/CanvasStatusBar";
import { CanvasZoomControls } from "./canvas/CanvasZoomControls";
import { KeyboardHintsOverlay } from "./canvas/KeyboardHintsOverlay";

interface LayoutCanvasProps {
  params: CustomLayoutParams | SteppedLayoutParams;
  onUpdateSlot: (id: string, x: number, y: number) => void;
  onRemoveSlot: (id: string) => void;
  onResizeTray?: (width: number, depth: number) => void;
  onUpdateSlotRotation?: (id: string, rotation: number) => void;
  onUpdateMultipleSlots?: (updates: { id: string, x: number, y: number }[]) => void;
  onDuplicateSlots?: (ids: string[]) => void;
  onUndo?: () => void;
  onSaveSnapshot?: () => void;
  onSelectionChange?: (ids: string[]) => void;
  // 轮廓预览（Stepped 模式：每组独立轮廓）
  outlinePreview?: GroupOutlinePreview[] | null;
}

export default function LayoutCanvas({
  params,
  onUpdateSlot,
  onRemoveSlot,
  onResizeTray,
  onUpdateSlotRotation,
  onUpdateMultipleSlots,
  onDuplicateSlots,
  onUndo,
  onSaveSnapshot,
  onSelectionChange,
  outlinePreview,
}: LayoutCanvasProps) {
  // Core State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
  const [selectionBox, setSelectionBox] = useState<{ start: { x: number, y: number }, current: { x: number, y: number } } | null>(null);

  // Smart Guides
  interface GuideLine {
    axis: 'x' | 'y';
    value: number; // SVG coordinate
  }
  const [guideLines, setGuideLines] = useState<GuideLine[]>([]);

  // Extracted canvas zoom/pan hook
  const {
    zoom, pan, setPan, viewBox, viewW, viewH, minX, minY,
    isSpacePressed, setIsSpacePressed,
    isPanning, setIsPanning,
    panStartRef, handleWheel,
    handleTouchStart, handleTouchMove, handleTouchEnd,
    adjustZoom, resetZoom,
  } = useCanvasZoom({
    baseW: params.trayWidth + 40, // trayWidth + (PADDING_MM * 2)
    baseH: params.trayDepth + 40,
    trayWidth: params.trayWidth,
    trayDepth: params.trayDepth,
  });

  const { trayWidth, trayDepth, slots, spacing } = params;
  const boundarySpacing = 'boundarySpacingIndependent' in params && params.boundarySpacingIndependent
    ? (params as CustomLayoutParams).boundarySpacing
    : spacing;
  const selectedIdsRef = useRef(selectedIds);
  const slotsRef = useRef(params.slots);
  const onUpdateSlotRef = useRef(onUpdateSlot);
  const onUndoRef = useRef(onUndo);
  const onSaveSnapshotRef = useRef(onSaveSnapshot);
  selectedIdsRef.current = selectedIds;
  slotsRef.current = params.slots;
  onUpdateSlotRef.current = onUpdateSlot;
  onUndoRef.current = onUndo;
  onSaveSnapshotRef.current = onSaveSnapshot;

  // Notify parent of selection changes (for stepped mode per-slot editing)
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedIds));
  }, [selectedIds, onSelectionChange]);

  // Helper to handle multiple updates
  const handleUpdateSlots = useCallback((updates: { id: string, x: number, y: number }[]) => {
    if (onUpdateMultipleSlots) {
      onUpdateMultipleSlots(updates);
    } else {
      // Fallback
      onSaveSnapshotRef.current?.();
      updates.forEach(u => onUpdateSlot(u.id, u.x, u.y));
    }
  }, [onUpdateSlot, onUpdateMultipleSlots]);

  // Extracted canvas keyboard event hook
  useCanvasKeyboard({
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

  /**
   * 碰撞检测 (Approximation for Ellipses)
   * Slot-Slot: Use average radius (Circle approximation).
   * Boundary: Use precise Axis-Aligned Bounding Box (AABB) of rotated ellipse.
   */
  const getCollisionRadius = (slot: FreeSlot) => {
    return (Math.max(slot.width, slot.height) + getSlotTolerance(Math.max(slot.width, slot.height))) / 2;
  };

  const getEllipseBoundingBox = (w: number, h: number, rotation: number) => {
    const rad = (rotation * Math.PI) / 180;
    const a = (w + getSlotTolerance(w)) / 2;
    const b = (h + getSlotTolerance(h)) / 2;
    const halfW = Math.sqrt(Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2));
    const halfH = Math.sqrt(Math.pow(a * Math.sin(rad), 2) + Math.pow(b * Math.cos(rad), 2));
    return { halfW, halfH };
  };

  const checkBoundaryCollision = (): string[] => [];

  /** 返回与指定槽位发生碰撞的其他槽位 ID 列表 */
  const checkSlotCollision = (id: string, x: number, y: number, currentW: number, currentH: number, currentRot: number): string[] => {
    // Optimization: First do a broad phase check using bounding circles
    // (We keep the old logic as a fast cull, but with margin)
    // Actually, let's just use SAT for accuracy as requested by user.

    // We need to check if (Slot A + Spacing/2) intersects (Slot B + Spacing/2).
    // Or simpler: (Slot A) intersects (Slot B expanded by Spacing).
    // Let's go with: Check if slot `id` (at x,y,w,h,rot) intersects any `other` (at other.x...) 
    // AND the distance is < spacing.

    // The requirement is "maintain spacing". 
    // So distinct shapes A and B must be > spacing apart.
    // Equivalent to: Shape A expanded by spacing/2 intersects Shape B expanded by spacing/2.

    // Let's generate polygon for NEW position of current slot (expanded by spacing/2)
    const margin = spacing / 2 + getSlotTolerance(currentW) / 2;
    const poly1 = getEllipsePolygon(x, y, currentW, currentH, currentRot, margin, 12); // 12 steps is good balance

    const collidingIds: string[] = [];
    for (const other of slots) {
      if (other.id === id) continue;

      // Expand other slot by spacing/2
      const margin2 = spacing / 2 + getSlotTolerance(other.width) / 2;
      const poly2 = getEllipsePolygon(other.x, other.y, other.width, other.height, other.rotation, margin2, 12);

      if (polygonsIntersect(poly1, poly2)) {
        collidingIds.push(other.id);
      }
    }
    return collidingIds;
  };

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
      let deltaDeg = deltaAngle * (180 / Math.PI);

      let newRotation = rotateStartRef.current.startRotation - deltaDeg;
      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15;
      }
      // 限定为 1 度为步长，不使用小数
      newRotation = Math.round((newRotation % 360 + 360) % 360);

      if (onUpdateSlotRotation) {
        onUpdateSlotRotation(draggingId, newRotation);
      }
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
      const dragSlotOrigin = dragStartRef.current.slotOrigins.get(draggingId);
      if (!dragSlotOrigin) return;

      // Current Mouse - Start Mouse = Delta for all
      // But we need snapping for the Primary.
      // Let's first calculate "Proposed Position" of Primary based on simple delta
      const totalDx = svgP.x - dragStartRef.current.mouseStart.x;
      const totalDy = svgRef.current.getScreenCTM() ? (svgP.y - dragStartRef.current.mouseStart.y) : 0;
      // Note: SVG Y increases downwards. Slot Y increases upwards.
      // DeltaY in SVG = +10 => Slot Y should vary by -10.
      const totalPhysDx = totalDx;
      const totalPhysDy = -(svgP.y - dragStartRef.current.mouseStart.y);

      // Proposed Primary Phys Position
      // Apply smooth snap
      const snapStep = 0.2; // 0.2mm smooth snap
      const roundToStep = (val: number) => Math.round(val / snapStep) * snapStep;

      let proposedX = roundToStep(dragSlotOrigin.x + totalPhysDx);
      let proposedY = roundToStep(dragSlotOrigin.y + totalPhysDy);

      // Apply Snapping to Proposed Position
      const dragSlot = slots.find(s => s.id === draggingId);
      const dragBB = dragSlot ? getEllipseBoundingBox(dragSlot.width, dragSlot.height, dragSlot.rotation) : { halfW: 0, halfH: 0 };
      const dragRx = dragBB.halfW;
      const dragRy = dragBB.halfH;

      const SNAP_THRESHOLD = 1.5;
      const guides: GuideLine[] = [];

      let finalX = proposedX;
      let finalY = proposedY;

      // Snap Logic (Same as before, but checking proposedX/Y)
      for (const other of slots) {
        if (selectedIds.has(other.id)) continue; // Don't snap to moved items

        const otherBB = getEllipseBoundingBox(other.width, other.height, other.rotation);
        const otherRx = otherBB.halfW;
        const otherRy = otherBB.halfH;

        // X Snaps
        const xSnaps = [
          { target: other.x, guide: other.x },
          { target: other.x - otherRx + dragRx, guide: other.x - otherRx },
          { target: other.x + otherRx - dragRx, guide: other.x + otherRx },
        ];
        for (const snap of xSnaps) {
          if (Math.abs(finalX - snap.target) < SNAP_THRESHOLD) {
            finalX = snap.target;
            guides.push({ axis: 'x', value: snap.guide });
            break;
          }
        }

        // Y Snaps
        const ySnaps = [
          { target: other.y, guide: other.y },
          { target: other.y - otherRy + dragRy, guide: other.y - otherRy },
          { target: other.y + otherRy - dragRy, guide: other.y + otherRy },
        ];
        for (const snap of ySnaps) {
          if (Math.abs(finalY - snap.target) < SNAP_THRESHOLD) {
            finalY = snap.target;
            guides.push({ axis: 'y', value: trayDepth - snap.guide });
            break;
          }
        }
      }

      setGuideLines(guides);

      // Calculate FINAL delta based on snapped position
      const finalDeltaX = finalX - dragSlotOrigin.x;
      const finalDeltaY = finalY - dragSlotOrigin.y;

      // Apply to ALL selected slots
      selectedIds.forEach(id => {
        const origin = dragStartRef.current?.slotOrigins.get(id);
        if (origin) {
          onUpdateSlot(id, origin.x + finalDeltaX, origin.y + finalDeltaY);
        }
      });
    }
  }, [draggingId, isPanning, isRotating, selectedIds, selectionBox, onUpdateSlot, onUpdateSlotRotation, trayDepth, slots]);

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

      // Start Drag
      onSaveSnapshotRef.current?.(); // 保存快照供撤销
      setDraggingId(slotId);

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
        // If I deselected it, setIds doesn't have it.
        // If I selected it (single or add), setIds has it.

        setIds.forEach(id => {
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
  }, [selectedIds, isSpacePressed, slots, trayDepth]);

  const handlePointerUp = useCallback(() => {
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
    setSelectionBox(null);
    setIsRotating(false);
    rotateStartRef.current = null;
    dragStartRef.current = null;
    setGuideLines([]);
  }, [selectionBox, selectedIds, slots, trayDepth]);

  const collisionErrorCount = (() => {
    let count = 0;
    for (const slot of slots) {
      const overlapIds = checkSlotCollision(slot.id, slot.x, slot.y, slot.width, slot.height, slot.rotation);
      for (const otherId of overlapIds) {
        // 只报告一个方向避免重复
        if (slot.id < otherId) {
          count += 1;
        }
      }
    }
    return count;
  })();

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

  const isEffectiveOversized =
    effectiveBaseplate.width > MAX_BUILD_SIZE ||
    effectiveBaseplate.height > MAX_BUILD_SIZE;

  return (
    <div
      ref={parentRef}
      className={`w-full h-full bg-[#1c1a16] rounded-sm overflow-hidden relative select-none flex items-center justify-center ${isSpacePressed ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
      style={{ touchAction: 'none' }}
    >
      {/* Debug Info Overlay (Bottom Right) inside the canvas container or separate? */}



      <AlignmentToolbar
        selectedIds={selectedIds}
        slots={slots}
        onUpdateSlots={handleUpdateSlots}
        spacing={spacing}
      />
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
          stroke="#4b5563"
          strokeWidth={0.5 / zoom}
          strokeDasharray={`${3 / zoom} ${3 / zoom}`}
          strokeOpacity={0.9}
        />

        {/* Effective Baseplate (inner) */}
        {effectiveBaseplate.hasSlots && (
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

        {/* Slots */}
        {(() => {
          // 预计算所有碰撞信息，用于高亮冲突对方和生成摘要
          const collisionMap = new Map<string, { boundaryReasons: string[]; overlapIds: string[] }>();
          // 被其他碰撞槽位"牵连"高亮的 ID 集合
          const involvedIds = new Set<string>();

          for (const slot of slots) {
            const boundaryReasons: string[] = [];
            const overlapIds = checkSlotCollision(slot.id, slot.x, slot.y, slot.width, slot.height, slot.rotation);
            collisionMap.set(slot.id, { boundaryReasons, overlapIds });
            if (overlapIds.length > 0) {
              involvedIds.add(slot.id);
              overlapIds.forEach(id => involvedIds.add(id));
            }
          }

          return slots.map((slot) => {
            // Geometry
            const w = slot.width + getSlotTolerance(slot.width);
            const h = slot.height + getSlotTolerance(slot.height);

            // Collision Radius (Approximation)
            const collisionR = getCollisionRadius(slot);

            // Position
            const svgY = trayDepth - slot.y;

            // Collision Check (from pre-computed map)
            const info = collisionMap.get(slot.id)!;
            const isBoundary = info.boundaryReasons.length > 0;
            const isOverlap = info.overlapIds.length > 0;
            const isColliding = isBoundary || isOverlap;
            // 此槽位是否被别人的碰撞牵连高亮（但自身并非碰撞源）
            const isInvolvedViaOther = !isColliding && involvedIds.has(slot.id);

            const isHovered = hoveredId === slot.id;
            const isDragging = draggingId === slot.id;
            const isSelected = selectedIds.has(slot.id);
            const color = isSelected ? "#f97316" : "#eab308"; // Orange if selected, else Yellow

            // Heatmap color for bottomHeight label text (legacy, kept for safety)
            const bhLabelColor = "#86efac";

            // 分组颜色（Stepped 模式通过 groupId 查组色）
            const steppedGroups = 'groups' in params
              ? (params as SteppedLayoutParams).groups
              : undefined;
            const isSteppedSlot = 'groupId' in slot;
            const groupColor = isSteppedSlot && steppedGroups
              ? (steppedGroups.find(g => g.id === (slot as { groupId: string }).groupId)?.color ?? "#86efac")
              : null;
            const groupBottomHeight = isSteppedSlot && steppedGroups
              ? (steppedGroups.find(g => g.id === (slot as { groupId: string }).groupId)?.bottomHeight ?? null)
              : null;

            return (
              <g
                key={slot.id}
                transform={`translate(${slot.x}, ${svgY}) rotate(${-slot.rotation})`} // Rotation! Note: SVG Y is inverted, so maybe rotation direction needs care. -Rotation fits typical 2D intuition if Y is up.
                onPointerDown={(e) => handlePointerDown(e, slot.id)}
                onPointerEnter={() => setHoveredId(slot.id)}
                onPointerLeave={() => setHoveredId(null)}
                className={`transition-opacity duration-200 ${isSpacePressed ? '' : 'cursor-move'}`}
                style={{ opacity: isDragging ? 0.9 : 1 }}
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
          });
        })()}

        {/* Collision connector lines — 连接冲突的槽位对，增强可理解性 */}
        {(() => {
          const lines: React.ReactNode[] = [];
          const drawn = new Set<string>();
          for (const slot of slots) {
            const overlapIds = checkSlotCollision(slot.id, slot.x, slot.y, slot.width, slot.height, slot.rotation);
            for (const otherId of overlapIds) {
              const key = [slot.id, otherId].sort().join("|");
              if (drawn.has(key)) continue;
              drawn.add(key);
              const other = slots.find(s => s.id === otherId);
              if (!other) continue;
              lines.push(
                <line
                  key={`col-${key}`}
                  x1={slot.x} y1={trayDepth - slot.y}
                  x2={other.x} y2={trayDepth - other.y}
                  stroke="#ef4444"
                  strokeWidth={0.5 / zoom}
                  strokeDasharray="3 2"
                  opacity={0.6}
                  pointerEvents="none"
                />
              );
            }
          }
          return lines;
        })()}

        {/* Smart Guide Lines */}
        {guideLines.map((g, i) => (
          g.axis === 'x'
            ? <line key={`guide-${i}`} x1={g.value} y1={minY} x2={g.value} y2={minY + viewH}
              stroke="#38bdf8" strokeWidth={0.3 / zoom} strokeDasharray="2 2" pointerEvents="none" opacity={0.8} />
            : <line key={`guide-${i}`} x1={minX} y1={g.value} x2={minX + viewW} y2={g.value}
              stroke="#38bdf8" strokeWidth={0.3 / zoom} strokeDasharray="2 2" pointerEvents="none" opacity={0.8} />
        ))}

        {/* 分组轮廓预览（Stepped 模式：按高度升序渲染，高组颜色压住低组，重叠处显示最高组颜色） */}
        {outlinePreview && outlinePreview.map((go) => {
          if (go.points.length < 3) return null;
          const pathData = go.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${(trayDepth - p.y).toFixed(2)}`)
            .join(' ') + ' Z';
          return (
            <path
              key={go.groupId}
              d={pathData}
              fill="none"
              stroke={go.color}
              strokeWidth={0.9 / zoom}
              strokeOpacity={0.85}
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
        collisionErrorCount={collisionErrorCount}
      />

      {isEffectiveOversized && (
        <div className="absolute top-14 lg:top-16 right-3 z-[72] px-3 py-1.5 bg-[#3b1515]/90 border border-[#8b1a1a] rounded text-xs text-[#f2b8b8] font-mono backdrop-blur-sm">
          有效底板超限: {effectiveBaseplate.width.toFixed(0)} × {effectiveBaseplate.height.toFixed(0)} mm
        </div>
      )}

      <KeyboardHintsOverlay
        showHints={showHints}
        onClose={() => setShowHints(false)}
      />

      {/* 移动端浮动操作栏 - 选中凹槽时显示 */}
      {selectedIds.size > 0 && (
        <div className="lg:hidden absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-800/95 backdrop-blur-sm border border-neutral-700 rounded-full shadow-xl px-3 py-1.5 z-40 animate-fade-in">
          <span className="text-[10px] text-neutral-400 font-mono mr-1">{selectedIds.size}选中</span>

          {onDuplicateSlots && (
            <button
              className="p-2 rounded-full hover:bg-neutral-700/60 text-neutral-300 active:text-white transition-colors"
              onClick={() => {
                onDuplicateSlots(Array.from(selectedIds));
              }}
            >
              <Copy size={18} />
            </button>
          )}

          {onUndo && (
            <button
              className="p-2 rounded-full hover:bg-neutral-700/60 text-neutral-300 active:text-white transition-colors"
              onClick={onUndo}
            >
              <Undo2 size={18} />
            </button>
          )}

          <button
            className="p-2 rounded-full hover:bg-red-900/60 text-red-400 active:text-red-300 transition-colors"
            onClick={() => {
              selectedIds.forEach((id) => onRemoveSlot(id));
              setSelectedIds(new Set());
            }}
          >
            <Trash2 size={18} />
          </button>

          <button
            className="p-2 rounded-full hover:bg-neutral-700/60 text-neutral-500 active:text-white transition-colors"
            onClick={() => {
              setSelectedIds(new Set());
            }}
          >
            <XCircle size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
