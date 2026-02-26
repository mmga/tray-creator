"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { FreeSlot, CustomLayoutParams } from "@/types/custom-tray";
import { getSlotTolerance } from "@/lib/config";
import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";
import AlignmentToolbar from "./AlignmentToolbar";
import { Trash2, Undo2, Copy, XCircle } from "lucide-react";

import { useCanvasZoom } from "../hooks/useCanvasZoom";
import { useCanvasKeyboard } from "../hooks/useCanvasKeyboard";
import { CanvasStatusBar } from "./canvas/CanvasStatusBar";
import { CanvasZoomControls } from "./canvas/CanvasZoomControls";
import { KeyboardHintsOverlay } from "./canvas/KeyboardHintsOverlay";
import { CanvasContextMenu } from "./canvas/CanvasContextMenu";

interface LayoutCanvasProps {
  params: CustomLayoutParams;
  onUpdateSlot: (id: string, x: number, y: number) => void;
  onRemoveSlot: (id: string) => void;
  onResizeTray?: (width: number, depth: number) => void;
  onUpdateSlotRotation?: (id: string, rotation: number) => void;
  onUpdateMultipleSlots?: (updates: { id: string, x: number, y: number }[]) => void;
  onDuplicateSlots?: (ids: string[]) => void;
  onUndo?: () => void;
  onSaveSnapshot?: () => void;
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
}: LayoutCanvasProps) {
  // Core State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Hoisted state (must be before hooks to avoid reference errors)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slotId: string } | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showAdjustDebug, setShowAdjustDebug] = useState(false);

  // Refs for DOM and logic
  const svgRef = useRef<SVGSVGElement>(null);
  const parentRef = useRef<HTMLDivElement>(null); // To get client rect for marquee
  const rotateStartRef = useRef<{ angle: number; startRotation: number } | null>(null);

  // 长按定时器（移动端替代右键菜单）
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

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
    setContextMenu,
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

  const checkBoundaryCollision = (x: number, y: number, w: number, h: number, rot: number): string[] => {
    const { halfW, halfH } = getEllipseBoundingBox(w, h, rot);
    const reasons: string[] = [];
    if (x - halfW < spacing - 1e-6) reasons.push("左");
    if (x + halfW > trayWidth - spacing + 1e-6) reasons.push("右");
    if (y - halfH < spacing - 1e-6) reasons.push("下");
    if (y + halfH > trayDepth - spacing + 1e-6) reasons.push("上");
    return reasons;
  };

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

  // Check if currently dragging slot hits the boundary
  const draggingSlotResult = slots.find(s => s.id === draggingId);
  const draggingRadius = draggingSlotResult ? getCollisionRadius(draggingSlotResult) : 0;

  const draggingBoundaryReasons = draggingSlotResult
    ? checkBoundaryCollision(
      draggingSlotResult.x,
      draggingSlotResult.y,
      draggingSlotResult.width,
      draggingSlotResult.height,
      draggingSlotResult.rotation
    )
    : [];
  const isDraggingBoundaryCollision = draggingBoundaryReasons.length > 0;

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

    // 移动时取消长按定时器（防止拖拽触发上下文菜单）
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
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

    // 清除上一个长按定时器
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressFiredRef.current = false;

    const isCtrl = e.ctrlKey || e.metaKey;

    // Panning Mode
    if (isSpacePressed) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // 长按检测（触摸设备替代右键菜单）
    if (slotId && e.pointerType === 'touch') {
      const cx = e.clientX;
      const cy = e.clientY;
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        setSelectedIds(new Set([slotId]));
        setContextMenu({ x: cx, y: cy, slotId });
        // 取消拖拽
        setDraggingId(null);
        dragStartRef.current = null;
      }, 500);
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

    // 清除长按定时器
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // 如果长按已触发上下文菜单，跳过后续逻辑
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

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

  // Context Menu Helpers

  // ... (useEffect click listener is fine)

  const handleContextMenu = useCallback((e: React.MouseEvent | React.PointerEvent, slotId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(new Set([slotId]));
    setContextMenu({ x: e.clientX, y: e.clientY, slotId });
  }, []);

  const handleDeleteFromMenu = () => {
    if (contextMenu?.slotId) {
      onRemoveSlot(contextMenu.slotId);
      setContextMenu(null);
    }
  };

  const handleRotationInput = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const valStr = e.target.value;
    if (valStr === '') {
      if (onUpdateSlotRotation) onUpdateSlotRotation(id, 0);
      return;
    }
    const val = parseFloat(valStr);
    if (!isNaN(val) && onUpdateSlotRotation) {
      // 限定为 1 度为步长，不使用小数
      onUpdateSlotRotation(id, Math.round(val));
    }
  };

  const autoAdjustSlotsByIds = useCallback((ids: Set<string>) => {
    if (ids.size < 2) return;

    const safetyGap = 0.6;
    const minGap = Math.max(1, spacing + safetyGap);

    const buildLayout = (candidateIds: Set<string>) => {
      const targets = slots.filter((s) => candidateIds.has(s.id));
      if (targets.length < 2) return null;

      const sorted = [...targets].sort((a, b) => a.x - b.x);
      const widths = sorted.map((slot) => getEllipseBoundingBox(slot.width, slot.height, slot.rotation).halfW * 2);
      const halfHeights = sorted.map((slot) => getEllipseBoundingBox(slot.width, slot.height, slot.rotation).halfH);
      const totalItemWidth = widths.reduce((sum, w) => sum + w, 0);
      const requiredWidth = Math.ceil(totalItemWidth + spacing * 2 + minGap * (sorted.length - 1));
      const maxHalfH = Math.max(...halfHeights);
      const requiredDepth = Math.ceil(spacing * 2 + maxHalfH * 2);

      const nextTrayWidth = Math.max(trayWidth, requiredWidth);
      const nextTrayDepth = Math.max(trayDepth, requiredDepth);
      const availableWidth = Math.max(0, nextTrayWidth - spacing * 2);
      const betweenGap = sorted.length > 1
        ? Math.max(minGap, (availableWidth - totalItemWidth) / (sorted.length - 1))
        : 0;
      let cursorEdge = spacing;
      const centerY = nextTrayDepth / 2;

      const updates = sorted.map((slot) => {
        const { halfW, halfH } = getEllipseBoundingBox(slot.width, slot.height, slot.rotation);
        const slotWidth = halfW * 2;
        const x = cursorEdge + halfW;
        cursorEdge += slotWidth + betweenGap;
        const minY = spacing + halfH;
        const maxY = nextTrayDepth - spacing - halfH;
        const y = Math.max(minY, Math.min(maxY, centerY));
        return { id: slot.id, x, y };
      });

      return { updates, nextTrayWidth, nextTrayDepth, arrangedIds: new Set(sorted.map((s) => s.id)) };
    };

    const hasGlobalConflict = (layout: NonNullable<ReturnType<typeof buildLayout>>) => {
      const posMap = new Map<string, { x: number; y: number }>();
      layout.updates.forEach((u) => posMap.set(u.id, { x: u.x, y: u.y }));

      const getPos = (slot: FreeSlot) => posMap.get(slot.id) ?? { x: slot.x, y: slot.y };
      const marginSet = new Map<string, number>();
      slots.forEach(s => marginSet.set(s.id, spacing / 2 + getSlotTolerance(s.width) / 2));

      for (let i = 0; i < slots.length; i++) {
        const a = slots[i];
        const aPos = getPos(a);
        const aMoved = layout.arrangedIds.has(a.id);

        // 只关注“此次被移动的槽位”引入的边界问题
        if (aMoved) {
          const boundaryReasons = checkBoundaryCollision(aPos.x, aPos.y, a.width, a.height, a.rotation);
          if (boundaryReasons.length > 0) return true;
        }

        for (let j = i + 1; j < slots.length; j++) {
          const b = slots[j];
          const bPos = getPos(b);
          const bMoved = layout.arrangedIds.has(b.id);
          if (!aMoved && !bMoved) continue;

          const polyA = getEllipsePolygon(aPos.x, aPos.y, a.width, a.height, a.rotation, marginSet.get(a.id)!, 12);
          const polyB = getEllipsePolygon(bPos.x, bPos.y, b.width, b.height, b.rotation, marginSet.get(b.id)!, 12);
          if (polygonsIntersect(polyA, polyB)) return true;
        }
      }
      return false;
    };

    // 第一阶段：仅调整当前冲突集
    let layout = buildLayout(ids);
    if (!layout) return;

    // 第二阶段：如果会撞到其他凹槽，自动升级为全量凹槽排布
    if (hasGlobalConflict(layout)) {
      const allIds = new Set(slots.map((s) => s.id));
      const globalLayout = buildLayout(allIds);
      if (globalLayout) {
        layout = globalLayout;
      }
    }

    if (onResizeTray && (layout.nextTrayWidth !== trayWidth || layout.nextTrayDepth !== trayDepth)) {
      onResizeTray(layout.nextTrayWidth, layout.nextTrayDepth);
    }
    handleUpdateSlots(layout.updates);
    setSelectedIds(layout.arrangedIds);
  }, [slots, spacing, trayWidth, trayDepth, handleUpdateSlots, onResizeTray]);

  const autoExpandTrayOnlyByIds = useCallback((ids: Set<string>) => {
    if (!onResizeTray || ids.size === 0) return;

    const targets = slots.filter((s) => ids.has(s.id));
    if (targets.length === 0) return;

    let maxRequiredX = trayWidth;
    let maxRequiredY = trayDepth;

    for (const slot of targets) {
      const { halfW, halfH } = getEllipseBoundingBox(slot.width, slot.height, slot.rotation);
      // 只扩展右/上边界：不移动槽位
      maxRequiredX = Math.max(maxRequiredX, Math.ceil(slot.x + halfW + spacing));
      maxRequiredY = Math.max(maxRequiredY, Math.ceil(slot.y + halfH + spacing));
    }

    if (maxRequiredX !== trayWidth || maxRequiredY !== trayDepth) {
      onResizeTray(maxRequiredX, maxRequiredY);
    }
  }, [onResizeTray, slots, trayWidth, trayDepth, spacing]);

  // ── 碰撞摘要（用于底部提示条）──
  const collisionSummary = (() => {
    const messages: string[] = [];
    for (const slot of slots) {
      const boundaryReasons = checkBoundaryCollision(slot.x, slot.y, slot.width, slot.height, slot.rotation);
      if (boundaryReasons.length > 0) {
        const label = slot.width === slot.height ? `${slot.width}mm` : `${slot.width}x${slot.height}mm`;
        messages.push(`${label}(${slot.id.slice(0, 4)}) 超出${boundaryReasons.join("/")}边距`);
      }
      const overlapIds = checkSlotCollision(slot.id, slot.x, slot.y, slot.width, slot.height, slot.rotation);
      for (const otherId of overlapIds) {
        // 只报告一个方向避免重复
        if (slot.id < otherId) {
          const other = slots.find(s => s.id === otherId);
          if (other) {
            const labelA = slot.width === slot.height ? `${slot.width}mm` : `${slot.width}x${slot.height}mm`;
            const labelB = other.width === other.height ? `${other.width}mm` : `${other.width}x${other.height}mm`;
            messages.push(`${labelA}(${slot.id.slice(0, 4)}) 与 ${labelB}(${otherId.slice(0, 4)}) 间距不足`);
          }
        }
      }
    }
    return messages;
  })();

  const collisionInvolvedIds = (() => {
    const involved = new Set<string>();
    for (const slot of slots) {
      const overlaps = checkSlotCollision(slot.id, slot.x, slot.y, slot.width, slot.height, slot.rotation);
      if (overlaps.length > 0) {
        involved.add(slot.id);
        overlaps.forEach((id) => involved.add(id));
      }
      const boundaryReasons = checkBoundaryCollision(slot.x, slot.y, slot.width, slot.height, slot.rotation);
      if (boundaryReasons.length > 0) {
        involved.add(slot.id);
      }
    }
    return involved;
  })();

  const autoAdjustDebugInfo = (() => {
    const targets = slots.filter((s) => collisionInvolvedIds.has(s.id));
    if (targets.length < 2) return null;

    const widths = targets.map((slot) => getEllipseBoundingBox(slot.width, slot.height, slot.rotation).halfW * 2);
    const halfHeights = targets.map((slot) => getEllipseBoundingBox(slot.width, slot.height, slot.rotation).halfH);
    const totalItemWidth = widths.reduce((sum, w) => sum + w, 0);
    const safetyGap = 0.6;
    const minGap = Math.max(1, spacing + safetyGap);
    const requiredWidth = Math.ceil(totalItemWidth + spacing * 2 + minGap * (targets.length - 1));
    const maxHalfH = Math.max(...halfHeights);
    const requiredDepth = Math.ceil(spacing * 2 + maxHalfH * 2);

    const nextTrayWidth = Math.max(trayWidth, requiredWidth);
    const nextTrayDepth = Math.max(trayDepth, requiredDepth);
    const availableWidth = Math.max(0, nextTrayWidth - spacing * 2);
    const predictedGap = targets.length > 1
      ? Math.max(minGap, (availableWidth - totalItemWidth) / (targets.length - 1))
      : 0;

    return {
      targetCount: targets.length,
      totalItemWidth,
      minGap,
      requiredWidth,
      requiredDepth,
      nextTrayWidth,
      nextTrayDepth,
      willResize: nextTrayWidth !== trayWidth || nextTrayDepth !== trayDepth,
      predictedGap,
    };
  })();

  return (
    <div
      ref={parentRef}
      className={`w-full h-full bg-[#1c1a16] rounded-sm overflow-hidden relative select-none flex items-center justify-center ${isSpacePressed ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
      style={{ touchAction: 'none' }}
      onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
    >
      {/* Debug Info Overlay (Bottom Right) inside the canvas container or separate? */}



      <AlignmentToolbar
        selectedIds={selectedIds}
        slots={slots}
        onUpdateSlots={handleUpdateSlots}
        canvasWidth={trayWidth}
        canvasHeight={trayDepth}
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
        {/* Tray Body */}
        <rect
          x={0}
          y={0}
          width={trayWidth}
          height={trayDepth}
          fill="#2a2a2e"
          stroke="#58524a"
          strokeWidth={0.5 / zoom}
          rx={params.cornerRadius}
        />

        {/* Safe Area */}
        <rect
          x={spacing}
          y={spacing}
          width={Math.max(0, trayWidth - spacing * 2)}
          height={Math.max(0, trayDepth - spacing * 2)}
          fill="none"
          stroke={isDraggingBoundaryCollision ? "#ef4444" : "#666"}
          strokeWidth={0.25 / zoom}
          strokeDasharray="2 2"
          strokeOpacity={isDraggingBoundaryCollision ? 1 : 0.5}
          className="transition-colors duration-200"
        />

        {/* Slots */}
        {(() => {
          // 预计算所有碰撞信息，用于高亮冲突对方和生成摘要
          const collisionMap = new Map<string, { boundaryReasons: string[]; overlapIds: string[] }>();
          // 被其他碰撞槽位"牵连"高亮的 ID 集合
          const involvedIds = new Set<string>();

          for (const slot of slots) {
            const boundaryReasons = checkBoundaryCollision(slot.x, slot.y, slot.width, slot.height, slot.rotation);
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

            return (
              <g
                key={slot.id}
                transform={`translate(${slot.x}, ${svgY}) rotate(${-slot.rotation})`} // Rotation! Note: SVG Y is inverted, so maybe rotation direction needs care. -Rotation fits typical 2D intuition if Y is up.
                onPointerDown={(e) => handlePointerDown(e, slot.id)}
                onContextMenu={(e) => handleContextMenu(e, slot.id)}
                onPointerEnter={() => setHoveredId(slot.id)}
                onPointerLeave={() => setHoveredId(null)}
                className={`transition-opacity duration-200 ${isSpacePressed ? '' : 'cursor-move'}`}
                style={{ opacity: isDragging ? 0.9 : 1 }}
              >
                {/* Note: In SVG group with translation, (0,0) is center of slot. */}

                {/* Margin / Safe Area Indicator (Approximated Circle for simplicity in Ellipse?) 
                  If Ellipse, let's draw an Ellipse with spacing added?
                  Actually, simple: ellipse rx=w/2+spacing, ry=h/2+spacing
              */}
                <ellipse
                  rx={w / 2 + spacing}
                  ry={h / 2 + spacing}
                  fill="none"
                  stroke={isColliding ? "#ef4444" : isInvolvedViaOther ? "#ef4444" : "#888"}
                  strokeWidth={0.25 / zoom}
                  strokeDasharray="2 2"
                  opacity={isColliding ? 1 : isInvolvedViaOther ? 0.7 : 0.6}
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
                  fill={color}
                  fillOpacity={0.8}
                  stroke={isColliding || isInvolvedViaOther ? "#ef4444" : "#fff"}
                  strokeWidth={(isColliding || isInvolvedViaOther ? 0.5 : 0.2) / zoom}
                />

                {/* Size Text (rotated back so it's readable? or rotate with slot?) 
                  Let's rotate with slot. 
              */}
                <text
                  dy={(Math.min(w, h) * 0.2)} // Adjusted dy
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

      <CanvasContextMenu
        contextMenu={contextMenu}
        slots={slots}
        onRotationChange={handleRotationInput}
        onDelete={handleDeleteFromMenu}
        onDuplicate={contextMenu && onDuplicateSlots ? () => {
          onDuplicateSlots([contextMenu.slotId]);
          setContextMenu(null);
        } : undefined}
        onRotate90={contextMenu && onUpdateSlotRotation ? () => {
          const slot = slots.find(s => s.id === contextMenu.slotId);
          if (slot) {
            onUpdateSlotRotation(contextMenu.slotId, (slot.rotation + 90) % 360);
          }
          setContextMenu(null);
        } : undefined}
        onClose={() => setContextMenu(null)}
      />

      <CanvasStatusBar
        trayWidth={trayWidth}
        trayDepth={trayDepth}
        zoom={zoom}
        selectedIds={selectedIds}
        slots={slots}
      />

      {/* Collision Info Banner */}
      {collisionSummary.length > 0 && (
        <div className="absolute top-14 lg:top-16 left-1/2 -translate-x-1/2 z-[70] max-w-[90%] px-3 py-2 bg-[#201515]/95 border border-[#6b3030] rounded text-xs text-[#d18888] font-mono backdrop-blur-sm shadow-lg">
          <div className="flex items-start gap-2">
            <span className="text-red-400 font-bold shrink-0 mt-px">⚠</span>
            <div className="flex flex-col gap-1">
              {collisionSummary.slice(0, 3).map((msg, i) => (
                <span key={i}>{msg}</span>
              ))}
              {collisionSummary.length > 3 && (
                <span className="text-[#d18888]/60">…另有 {collisionSummary.length - 3} 处冲突</span>
              )}
              {collisionInvolvedIds.size > 0 && (
                <div className="pt-1 flex flex-wrap gap-2">
                  <button
                    onClick={() => autoAdjustSlotsByIds(collisionInvolvedIds)}
                    className="pointer-events-auto px-2 py-1 text-[11px] rounded border border-[#7a3b3b] bg-[#3a1c1c] text-[#f0b3b3] hover:bg-[#4a2424] transition-colors"
                  >
                    自动调整/对齐冲突项
                  </button>
                  <button
                    onClick={() => autoExpandTrayOnlyByIds(collisionInvolvedIds)}
                    className="pointer-events-auto px-2 py-1 text-[11px] rounded border border-[#5a4a2a] bg-[#2e2618] text-[#dec28a] hover:bg-[#3a301f] transition-colors"
                  >
                    只扩画布不移动槽位
                  </button>
                  <button
                    onClick={() => setShowAdjustDebug((prev) => !prev)}
                    className="pointer-events-auto px-2 py-1 text-[11px] rounded border border-[#3c4d6e] bg-[#1a2438] text-[#b6c7e6] hover:bg-[#22304a] transition-colors"
                  >
                    {showAdjustDebug ? "隐藏调试信息" : "显示调试信息"}
                  </button>
                </div>
              )}
              {showAdjustDebug && autoAdjustDebugInfo && (
                <div className="mt-1 p-2 rounded border border-[#3c4d6e]/60 bg-[#141b2a]/90 text-[10px] text-[#b6c7e6] leading-4">
                  <div>targets={autoAdjustDebugInfo.targetCount} totalWidth={autoAdjustDebugInfo.totalItemWidth.toFixed(2)} minGap={autoAdjustDebugInfo.minGap.toFixed(2)}</div>
                  <div>required={autoAdjustDebugInfo.requiredWidth}×{autoAdjustDebugInfo.requiredDepth} current={trayWidth}×{trayDepth}</div>
                  <div>next={autoAdjustDebugInfo.nextTrayWidth}×{autoAdjustDebugInfo.nextTrayDepth} resize={autoAdjustDebugInfo.willResize ? "yes" : "no"}</div>
                  <div>predictedBetweenGap={autoAdjustDebugInfo.predictedGap.toFixed(2)} spacing={spacing}</div>
                </div>
              )}
            </div>
          </div>
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
              setContextMenu(null);
            }}
          >
            <Trash2 size={18} />
          </button>

          <button
            className="p-2 rounded-full hover:bg-neutral-700/60 text-neutral-500 active:text-white transition-colors"
            onClick={() => {
              setSelectedIds(new Set());
              setContextMenu(null);
            }}
          >
            <XCircle size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
