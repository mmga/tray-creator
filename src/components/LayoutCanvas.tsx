"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { FreeSlot, CustomLayoutParams } from "@/types/custom-tray";
import { SLOT_COLORS, HOLE_TOLERANCE } from "@/lib/config";

interface LayoutCanvasProps {
  params: CustomLayoutParams;
  onUpdateSlot: (id: string, x: number, y: number) => void;
  onRemoveSlot: (id: string) => void;
}

export default function LayoutCanvas({
  params,
  onUpdateSlot,
  onRemoveSlot,
}: LayoutCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
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
   * 碰撞检测
   */
  const checkBoundaryCollision = (x: number, y: number, r: number) => {
     return (
      x - r < spacing ||
      x + r > trayWidth - spacing ||
      y - r < spacing ||
      y + r > trayDepth - spacing
    );
  };

  const checkSlotCollision = (id: string, x: number, y: number, r: number) => {
    for (const other of slots) {
      if (other.id === id) continue;
      const otherR = (other.diameter + HOLE_TOLERANCE) / 2;
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
  const isDraggingBoundaryCollision = draggingSlotResult 
    ? checkBoundaryCollision(
        draggingSlotResult.x, 
        draggingSlotResult.y, 
        (draggingSlotResult.diameter + HOLE_TOLERANCE) / 2
      ) 
    : false;

  const handleMouseDown = useCallback((e: React.MouseEvent, slotId?: string) => {
    e.preventDefault();
    e.stopPropagation();

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

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      
      // Convert pixel delta to SVG MM delta
      // We need to know the scale. 
      // SVG Width in Pixels / SVG Width in MM (viewW)
      if (svgRef.current) {
         const screenCTM = svgRef.current.getScreenCTM();
         if (screenCTM) {
             // scale = screenCTM.a (usually)
             // dx_mm = dx / scale
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

    if (draggingId && svgRef.current) {
      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

      const newSvgX = svgP.x - dragOffset.x;
      const newSvgY = svgP.y - dragOffset.y;
      const newPhysicalY = trayDepth - newSvgY;

      onUpdateSlot(draggingId, newSvgX, newPhysicalY);
    }
  }, [draggingId, dragOffset, isPanning, onUpdateSlot, trayDepth]);

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
    setIsPanning(false);
  }, []);

  // Icons
  const ZoomIn = require("lucide-react").ZoomIn;
  const ZoomOut = require("lucide-react").ZoomOut;
  const Maximize = require("lucide-react").Maximize;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slotId: string } | null>(null);

  // Close context menu on any click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, slotId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, slotId });
  }, []);

  const handleDeleteFromMenu = () => {
    if (contextMenu?.slotId) {
      onRemoveSlot(contextMenu.slotId);
      setContextMenu(null);
    }
  };

  return (
    <div 
      className={`w-full h-full bg-[#1c1a16] rounded-sm overflow-hidden relative select-none flex items-center justify-center ${isSpacePressed ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
      onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} // Disable default context menu on canvas
    >
      {/* 网格背景 */}
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
        {/* 托盘底板轮廓 */}
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

        {/* 安全区域虚线 (Unified Style) - Always Fine Dashed */}
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

        {/* 凹槽 */}
        {slots.map((slot) => {
          const r = (slot.diameter + HOLE_TOLERANCE) / 2;
          const svgY = trayDepth - slot.y;
          
          const isBoundary = checkBoundaryCollision(slot.x, slot.y, r);
          const isOverlap = checkSlotCollision(slot.id, slot.x, slot.y, r);
          const isColliding = isBoundary || isOverlap;
          
          const color = SLOT_COLORS[slot.diameter] || "#ccc";
          const isHovered = hoveredId === slot.id;
          const isDragging = draggingId === slot.id;

          return (
            <g
              key={slot.id}
              transform={`translate(${slot.x}, ${svgY})`}
              onMouseDown={(e) => handleMouseDown(e, slot.id)}
              onContextMenu={(e) => handleContextMenu(e, slot.id)} // Right click handler
              onMouseEnter={() => setHoveredId(slot.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`transition-opacity duration-200 ${isSpacePressed ? '' : 'cursor-move'}`}
              style={{ opacity: isDragging ? 0.9 : 1 }}
            >
              {/* 边距指示圈 (Unified Style) - Always Fine Dashed */}
              <circle
                r={r + spacing}
                fill="none"
                stroke={isColliding ? "#ef4444" : "#888"}
                strokeWidth={0.25 / zoom}
                strokeDasharray="2 2"
                opacity={isColliding ? 1 : 0.6}
                pointerEvents="none"
              />

              {/* 碰撞/选中/拖拽 高亮光环 - Move INSIDE */}
              {(isColliding || isHovered || isDragging) && (
                <circle
                  r={Math.max(0, r - 0.5 / zoom)} // Inside stroke
                  fill="none"
                  stroke={isColliding ? "#ef4444" : "#fbbf24"}
                  strokeWidth={0.8 / zoom}
                  strokeOpacity={0.8}
                  pointerEvents="none"
                />
              )}

              {/* 实体圆 */}
              <circle
                r={r}
                fill={color}
                fillOpacity={0.8}
                stroke={isColliding ? "#ef4444" : "#fff"}
                strokeWidth={(isColliding ? 0.5 : 0.2) / zoom}
              />
              
              {/* 尺寸文字 */}
              <text
                dy={(r * 0.4)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(r, 12)}
                fill="#fff"
                fontWeight="bold"
                pointerEvents="none"
                style={{ userSelect: 'none' }}
              >
                {slot.diameter}
              </text>
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
      
      {/* Context Menu (Simple) */}
      {contextMenu && (
        <div 
          className="fixed bg-[#2a2a2e] border border-[#444] rounded shadow-xl z-50 overflow-hidden min-w-[100px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
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
