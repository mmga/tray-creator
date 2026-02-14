"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { FreeSlot, CustomLayoutParams } from "@/types/custom-tray";
import { SLOT_COLORS, HOLE_TOLERANCE } from "@/lib/config";

interface LayoutCanvasProps {
  params: CustomLayoutParams;
  onUpdateSlot: (id: string, x: number, y: number) => void;
  onRemoveSlot: (id: string) => void;
  onUpdateSlotRotation?: (id: string, rotation: number) => void;
}

export default function LayoutCanvas({
  params,
  onUpdateSlot,
  onRemoveSlot,
  onUpdateSlotRotation,
}: LayoutCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const { trayWidth, trayDepth, slots, spacing } = params;

  // Global key listener for Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        setIsSpacePressed(true);
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

  const checkSlotCollision = (id: string, x: number, y: number, r: number) => {
    for (const other of slots) {
      if (other.id === id) continue;
      const otherR = getCollisionRadius(other);
      const minDist = r + otherR + spacing;
      const dist = Math.hypot(x - other.x, y - other.y);
      if (dist < minDist - 0.01) {
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

    // Rotate
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
       
       // Snap to 15 degrees if Shift is held
       let newRotation = rotateStartRef.current.startRotation - deltaDeg;
       
       if (e.shiftKey) {
         newRotation = Math.round(newRotation / 15) * 15;
       }
       
       // Normalize to 0-360
       newRotation = (newRotation % 360 + 360) % 360;
       
       if (onUpdateSlotRotation) {
         onUpdateSlotRotation(draggingId, newRotation);
       }
       return;
    }

    // Drag
    if (draggingId && !isRotating && svgRef.current) {
      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

      const newSvgX = svgP.x - dragOffset.x;
      const newSvgY = svgP.y - dragOffset.y;
      const newPhysicalY = trayDepth - newSvgY;

      onUpdateSlot(draggingId, newSvgX, newPhysicalY);
    }
  }, [draggingId, dragOffset, isPanning, isRotating, onUpdateSlot, onUpdateSlotRotation, trayDepth, slots]);

  const handleMouseDown = useCallback((e: React.MouseEvent, slotId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Click Selection Logic
    if (slotId) {
      setSelectedId(slotId);
    } else if (!isSpacePressed) {
      // Clicked query background (no slotId) and not panning -> Deselect
      setSelectedId(null);
    }

    // Panning Mode (Space held)
    if (isSpacePressed) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Dragging Slot Mode
    if (slotId && svgRef.current) {
      const slot = slots.find(s => s.id === slotId);
      if (!slot) return;

      setDraggingId(slotId);
      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
      const slotSvgY = trayDepth - slot.y;
      
      setDragOffset({
        x: svgP.x - slot.x,
        y: svgP.y - slotSvgY
      });
    }
  }, [isSpacePressed, slots, trayDepth]);

  // handleMouseMove at 275 is removed by replacing the whole block up to 308 with just handleMouseDown (which we just defined above)
  // Wait, I need to cover the range 174 to 308.
  // 174 start handleMouseMove
  // 245 start handleMouseDown
  // 275 start handleMouseMove (duplicate)
  // 310 start handleMouseUp
  // I will replace from 174 to 309.

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
    setIsPanning(false);
    setIsRotating(false);
    rotateStartRef.current = null;
  }, []);

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
    setSelectedId(slotId);
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
      className={`w-full h-full bg-[#1c1a16] rounded-sm overflow-hidden relative select-none flex items-center justify-center ${isSpacePressed ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
      onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} 
    >
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
          const isOverlap = checkSlotCollision(slot.id, slot.x, slot.y, collisionR);
          const isColliding = isBoundary || isOverlap;
          
          const color = "#eab308"; // Unified color (Yellow-500 from 32mm)
          const isHovered = hoveredId === slot.id;
          const isDragging = draggingId === slot.id;
          const isSelected = selectedId === slot.id;

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

              {/* Highlight Halo - Inside - Show if Selected/Hovered/Dragging/Colliding */}
              {(isColliding || isHovered || isDragging || isSelected) && (
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
      </svg>
      
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
      
      {/* 底部提示 */}
      <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/60 font-mono pointer-events-none">
        CANVAS: {trayWidth}mm × {trayDepth}mm | ZOOM: {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
