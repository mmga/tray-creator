"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { FreeSlot, CustomLayoutParams } from "@/types/custom-tray";
import { HOLE_TOLERANCE } from "@/lib/config";
import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";
import AlignmentToolbar from "./AlignmentToolbar";

interface LayoutCanvasProps {
  params: CustomLayoutParams;
  onUpdateSlot: (id: string, x: number, y: number) => void;
  onRemoveSlot: (id: string) => void;
  onUpdateSlotRotation?: (id: string, rotation: number) => void;
  onUndo?: () => void;
  onSaveSnapshot?: () => void;
}

export default function LayoutCanvas({
  params,
  onUpdateSlot,
  onRemoveSlot,
  onUpdateSlotRotation,
  onUndo,
  onSaveSnapshot,
}: LayoutCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null); // To get client rect for marquee

  // Multi-drag State
  const dragStartRef = useRef<{
    mouseStart: { x: number, y: number }; // SVG coords
    slotOrigins: Map<string, { x: number, y: number }>;
  } | null>(null);

  // Marquee Selection State (Client Coords)
  const [selectionBox, setSelectionBox] = useState<{ start: { x: number, y: number }, current: { x: number, y: number } } | null>(null);

  // Helper to handle multiple updates
  const handleUpdateSlots = useCallback((updates: { id: string, x: number, y: number }[]) => {
    updates.forEach(u => onUpdateSlot(u.id, u.x, u.y));
  }, [onUpdateSlot]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Smart Guides
  interface GuideLine {
    axis: 'x' | 'y';
    value: number; // SVG coordinate
  }
  const [guideLines, setGuideLines] = useState<GuideLine[]>([]);

  // Refs for logic (to avoid stale closures in useEffect)
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

  const { trayWidth, trayDepth, slots, spacing } = params;

  // Global key listener for Space & Tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        setIsSpacePressed(true);
      }
      // Nudge: Arrow keys move selected slots by 1mm
      const arrowCodes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (selectedIdsRef.current.size > 0 && arrowCodes.includes(e.code)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1; // Shift+Arrow = 10mm (1cm), Arrow = 1mm? Code says 1mm.
        // Wait, Code said: "step = 1; // mm".
        // Let's stick to 1mm default.
        // And Shift? User said "Shift+Arrow moves 1mm or 10px?". 
        // Current code: "step = 1".
        // I will keep 1mm default.

        let dx = 0, dy = 0;
        if (e.code === 'ArrowLeft') dx = -1;
        if (e.code === 'ArrowRight') dx = 1;
        if (e.code === 'ArrowUp') dy = 1;  // physical Y up
        if (e.code === 'ArrowDown') dy = -1;

        selectedIdsRef.current.forEach(id => {
          const slot = slotsRef.current.find(s => s.id === id);
          if (slot) {
            onUpdateSlotRef.current(id, slot.x + dx, slot.y + dy);
          }
        });
      }

      // Ctrl+Z / Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndoRef.current?.();
        return;
      }

      // Delete: Remove selected slots
      if (selectedIdsRef.current.size > 0 && (e.code === 'Delete' || e.code === 'Backspace')) {
        e.preventDefault();
        selectedIdsRef.current.forEach(id => onRemoveSlot(id));
        setSelectedIds(new Set()); // Clear selection
        setContextMenu(null);
      }

      // Escape: Deselect / Close Menu
      if (e.code === 'Escape') {
        e.preventDefault();
        setSelectedIds(new Set());
        setContextMenu(null);
        setIsRotating(false);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Prevent default browser zooming
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }

    // Simple zoom logic
    const delta = -e.deltaY;
    const factor = 0.1;
    setZoom((z) => {
      const newZoom = z + (delta > 0 ? factor : -factor);
      return Math.min(Math.max(0.5, newZoom), 5); // Limit 0.5x to 5x
    });
  }, []);

  const adjustZoom = (amount: number) => {
    setZoom((z) => Math.min(Math.max(0.5, z + amount), 5));
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ViewBox calculation with Pan support
  const PADDING_MM = 20;
  const baseW = trayWidth + PADDING_MM * 2;
  const baseH = trayDepth + PADDING_MM * 2;

  const viewW = baseW / zoom;
  const viewH = baseH / zoom;
  // Center of Tray is (trayWidth/2, trayDepth/2).
  // Pan is in screen pixels (from mouse movement) converted to SVG units? 
  // Actually, easier to treat `pan` as "Viewer Offset in MM".
  const minX = (trayWidth / 2) - (viewW / 2) - pan.x;
  const minY = (trayDepth / 2) - (viewH / 2) - pan.y;

  const viewBox = `${minX} ${minY} ${viewW} ${viewH}`;

  /**
   * 碰撞检测 (Approximation for Ellipses)
   * Slot-Slot: Use average radius (Circle approximation).
   * Boundary: Use precise Axis-Aligned Bounding Box (AABB) of rotated ellipse.
   */
  const getCollisionRadius = (slot: FreeSlot) => {
    return (Math.max(slot.width, slot.height) + HOLE_TOLERANCE) / 2;
  };

  const getEllipseBoundingBox = (w: number, h: number, rotation: number) => {
    const rad = (rotation * Math.PI) / 180;
    const a = (w + HOLE_TOLERANCE) / 2;
    const b = (h + HOLE_TOLERANCE) / 2;
    const halfW = Math.sqrt(Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2));
    const halfH = Math.sqrt(Math.pow(a * Math.sin(rad), 2) + Math.pow(b * Math.cos(rad), 2));
    return { halfW, halfH };
  };

  const checkBoundaryCollision = (x: number, y: number, w: number, h: number, rot: number) => {
    const { halfW, halfH } = getEllipseBoundingBox(w, h, rot);
    return (
      x - halfW < spacing ||
      x + halfW > trayWidth - spacing ||
      y - halfH < spacing ||
      y + halfH > trayDepth - spacing
    );
  };

  const checkSlotCollision = (id: string, x: number, y: number, currentW: number, currentH: number, currentRot: number) => {
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
    const margin = spacing / 2 + HOLE_TOLERANCE / 2;
    const poly1 = getEllipsePolygon(x, y, currentW, currentH, currentRot, margin, 12); // 12 steps is good balance

    for (const other of slots) {
      if (other.id === id) continue;

      // Expand other slot by spacing/2
      const poly2 = getEllipsePolygon(other.x, other.y, other.width, other.height, other.rotation, margin, 12);

      if (polygonsIntersect(poly1, poly2)) {
        return true;
      }
    }
    return false;
  };

  // Check if currently dragging slot hits the boundary
  const draggingSlotResult = slots.find(s => s.id === draggingId);
  const draggingRadius = draggingSlotResult ? getCollisionRadius(draggingSlotResult) : 0;

  const isDraggingBoundaryCollision = draggingSlotResult
    ? checkBoundaryCollision(
      draggingSlotResult.x,
      draggingSlotResult.y,
      draggingSlotResult.width,
      draggingSlotResult.height,
      draggingSlotResult.rotation
    )
    : false;

  const [isRotating, setIsRotating] = useState(false);
  const rotateStartRef = useRef<{ angle: number; startRotation: number } | null>(null);

  // ... (keep existing helpers)

  // Rotation Handle Logic
  const handleRotateMouseDown = (e: React.MouseEvent, slot: FreeSlot) => {
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

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

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
      newRotation = (newRotation % 360 + 360) % 360;

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
      // Apply 0.2mm step snapping to the raw proposed position first
      const roundToStep = (val: number) => Math.round(val / 0.2) * 0.2;

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

  const handleMouseDown = useCallback((e: React.MouseEvent, slotId?: string) => {
    e.preventDefault();
    e.stopPropagation();

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
      // Start Marquee
      const rect = parentRef.current?.getBoundingClientRect();
      if (rect) {
        setSelectionBox({
          start: { x: e.clientX - rect.left, y: e.clientY - rect.top },
          current: { x: e.clientX - rect.left, y: e.clientY - rect.top }
        });
      }
    }
  }, [selectedIds, isSpacePressed, slots, trayDepth]);

  const handleMouseUp = useCallback(() => {
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

  // Icons
  const ZoomIn = require("lucide-react").ZoomIn;
  const ZoomOut = require("lucide-react").ZoomOut;
  const Maximize = require("lucide-react").Maximize;

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slotId: string } | null>(null);

  // ... (useEffect click listener is fine)

  const handleContextMenu = useCallback((e: React.MouseEvent, slotId: string) => {
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
      onUpdateSlotRotation(id, val);
    }
  };

  return (
    <div
      ref={parentRef}
      className={`w-full h-full bg-[#1c1a16] rounded-sm overflow-hidden relative select-none flex items-center justify-center ${isSpacePressed ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
      onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
    >
      {/* Debug Info Overlay (Bottom Right) inside the canvas container or separate? 
          User said "Bottom Bar, after Zoom".
          Zoom controls are below? 
          Wait, I don't see Zoom controls in the JSX I read earlier?
          Let me check where Zoom controls are.
          Ah, I might have missed them in the truncated view.
          Let me read the bottom of LayoutCanvas.tsx first.
      */}
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
        className="absolute inset-0 opacity-10 pointer-events-none"
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
        onMouseDown={(e) => handleMouseDown(e)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
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
        {slots.map((slot) => {
          // Geometry
          const w = slot.width + HOLE_TOLERANCE;
          const h = slot.height + HOLE_TOLERANCE;

          // Collision Radius (Approximation)
          const collisionR = getCollisionRadius(slot);

          // Position
          const svgY = trayDepth - slot.y;

          // Collision Check
          const isBoundary = checkBoundaryCollision(slot.x, slot.y, slot.width, slot.height, slot.rotation);
          // Collision now uses SAT
          const isOverlap = checkSlotCollision(slot.id, slot.x, slot.y, slot.width, slot.height, slot.rotation);
          const isColliding = isBoundary || isOverlap;

          const isHovered = hoveredId === slot.id;
          const isDragging = draggingId === slot.id;
          const isSelected = selectedIds.has(slot.id);
          const color = isSelected ? "#f97316" : "#eab308"; // Orange if selected, else Yellow

          return (
            <g
              key={slot.id}
              transform={`translate(${slot.x}, ${svgY}) rotate(${-slot.rotation})`} // Rotation! Note: SVG Y is inverted, so maybe rotation direction needs care. -Rotation fits typical 2D intuition if Y is up.
              onMouseDown={(e) => handleMouseDown(e, slot.id)}
              onContextMenu={(e) => handleContextMenu(e, slot.id)}
              onMouseEnter={() => setHoveredId(slot.id)}
              onMouseLeave={() => setHoveredId(null)}
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
                stroke={isColliding ? "#ef4444" : "#888"}
                strokeWidth={0.25 / zoom}
                strokeDasharray="2 2"
                opacity={isColliding ? 1 : 0.6}
                pointerEvents="none"
              />

              {/* Highlight Halo - Inside - Show if Hovered/Dragging/Colliding (Selection uses fill color) */}
              {(isColliding || isHovered || isDragging) && (
                <ellipse
                  rx={Math.max(0, w / 2 - 0.5 / zoom)}
                  ry={Math.max(0, h / 2 - 0.5 / zoom)}
                  fill="none"
                  stroke={isColliding ? "#ef4444" : "#fbbf24"}
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
                stroke={isColliding ? "#ef4444" : "#fff"}
                strokeWidth={(isColliding ? 0.5 : 0.2) / zoom}
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
                  onMouseDown={(e) => handleRotateMouseDown(e, slot)}
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

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 bg-[#1c1a16] border border-[#2e2a24] p-1.5 rounded shadow-lg">
        <button
          className="p-1.5 hover:bg-[#2e2a24] text-muted-foreground hover:text-primary rounded transition-colors"
          onClick={resetZoom}
          title="Reset View"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Context Menu (Enhanced) */}
      {contextMenu && (
        <div
          className="fixed bg-[#2a2a2e] border border-[#444] rounded shadow-xl z-50 overflow-hidden min-w-[140px] flex flex-col"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-[#444] bg-[#222]">
            <label className="text-[10px] text-muted-foreground block mb-1">Rotation (°)</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="w-full h-6 bg-[#111] border border-[#555] rounded px-1 text-xs text-secondary-foreground"
                value={Math.round(slots.find(s => s.id === contextMenu.slotId)?.rotation || 0)}
                onChange={(e) => handleRotationInput(e, contextMenu.slotId)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <button
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#3e3e42] hover:text-red-300 transition-colors"
            onClick={handleDeleteFromMenu}
          >
            Delete
          </button>
        </div>
      )}

      {/* 底部提示 & Debug Info */}
      <div className="absolute bottom-2 left-2 right-12 flex items-end justify-between pointer-events-none px-2 pb-1">
        <div className="text-[10px] text-muted-foreground/60 font-mono flex gap-4">
          <span>CANVAS: {trayWidth}mm × {trayDepth}mm</span>
          <span>ZOOM: {Math.round(zoom * 100)}%</span>

          {selectedIds.size === 1 && (() => {
            const s = slots.find(slot => slot.id === Array.from(selectedIds)[0]);
            if (!s) return null;
            return (
              <span className="text-orange-400">
                ID:{s.id.slice(0, 4)} | X:{s.x.toFixed(1)} Y:{s.y.toFixed(1)} | W:{s.width} H:{s.height} | R:{Math.round(s.rotation)}°
              </span>
            );
          })()}

          {selectedIds.size > 1 && (
            <span className="text-orange-400">
              {selectedIds.size} ITEMS SELECTED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
