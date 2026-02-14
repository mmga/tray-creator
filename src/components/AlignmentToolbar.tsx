import { 
  AlignLeft, AlignCenterHorizontal, AlignRight, 
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight
} from "lucide-react";
import { FreeSlot } from "@/types/custom-tray";
import { HOLE_TOLERANCE } from "@/lib/config";

interface AlignmentToolbarProps {
  selectedIds: Set<string>;
  slots: FreeSlot[];
  onUpdateSlots: (updates: { id: string, x: number, y: number }[]) => void;
  canvasWidth: number;
  canvasHeight: number;
  spacing: number;
}

export default function AlignmentToolbar({ selectedIds, slots, onUpdateSlots, canvasWidth, canvasHeight, spacing }: AlignmentToolbarProps) {
  if (selectedIds.size === 0) return null;

  const getSelectionBounds = () => {
    const selected = slots.filter(s => selectedIds.has(s.id));
    if (selected.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    // Bounds are based on Visual Edge (including tolerance)
    selected.forEach(s => {
      const halfW = (s.width + HOLE_TOLERANCE) / 2;
      const halfH = (s.height + HOLE_TOLERANCE) / 2;
      minX = Math.min(minX, s.x - halfW);
      maxX = Math.max(maxX, s.x + halfW);
      minY = Math.min(minY, s.y - halfH);
      maxY = Math.max(maxY, s.y + halfH);
    });
    
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  };

  const handleAlign = (type: string) => {
    const selected = slots.filter(s => selectedIds.has(s.id));
    if (selected.length < 2) return; // Standard Align needs >1

    // Calculate bounds for alignment reference
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    const xSorted = [...selected].sort((a, b) => a.x - b.x);
    const ySorted = [...selected].sort((a, b) => a.y - b.y);

    selected.forEach(s => {
      const halfW = (s.width + HOLE_TOLERANCE) / 2;
      const halfH = (s.height + HOLE_TOLERANCE) / 2;
      minX = Math.min(minX, s.x - halfW);
      maxX = Math.max(maxX, s.x + halfW);
      minY = Math.min(minY, s.y - halfH);
      maxY = Math.max(maxY, s.y + halfH);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const updates: { id: string, x: number, y: number }[] = [];

    // Helper for 0.2mm step
    const roundToStep = (val: number) => Math.round(val / 0.2) * 0.2;

    if (type === 'left') {
      selected.forEach(s => {
        const halfW = (s.width + HOLE_TOLERANCE) / 2;
        updates.push({ id: s.id, x: roundToStep(minX + halfW), y: s.y });
      });
    } else if (type === 'center-x') {
      selected.forEach(s => {
        updates.push({ id: s.id, x: roundToStep(centerX), y: s.y });
      });
    } else if (type === 'right') {
      selected.forEach(s => {
        const halfW = (s.width + HOLE_TOLERANCE) / 2;
        updates.push({ id: s.id, x: roundToStep(maxX - halfW), y: s.y });
      });
    } else if (type === 'top') {
      // Align Top: Max Y
      selected.forEach(s => {
        const halfH = (s.height + HOLE_TOLERANCE) / 2;
        updates.push({ id: s.id, x: s.x, y: roundToStep(maxY - halfH) });
      });
    } else if (type === 'center-y') {
      selected.forEach(s => {
        updates.push({ id: s.id, x: s.x, y: roundToStep(centerY) });
      });
    } else if (type === 'bottom') {
      // Align Bottom: Min Y
      selected.forEach(s => {
        const halfH = (s.height + HOLE_TOLERANCE) / 2;
        updates.push({ id: s.id, x: s.x, y: roundToStep(minY + halfH) });
      });
    } else if (type === 'distribute-h') {
       const n = selected.length;
       if (n > 2) {
         const totalSpace = (maxX - minX);
         const totalItemWidth = xSorted.reduce((sum, s) => sum + (s.width + HOLE_TOLERANCE), 0);
         const freeSpace = totalSpace - totalItemWidth;
         const gap = freeSpace / (n - 1);
         let currentEdge = minX;
         xSorted.forEach((s, i) => {
            const w = s.width + HOLE_TOLERANCE;
            const halfW = w / 2;
            if (i === 0) {
               updates.push({ id: s.id, x: roundToStep(minX + halfW), y: s.y });
               currentEdge += w + gap;
            } else if (i === n - 1) {
               updates.push({ id: s.id, x: roundToStep(maxX - halfW), y: s.y });
            } else {
               updates.push({ id: s.id, x: roundToStep(currentEdge + halfW), y: s.y });
               currentEdge += w + gap;
            }
         });
       }
    } else if (type === 'distribute-v') {
       const n = selected.length;
       if (n > 2) {
         const totalSpace = (maxY - minY);
         const totalItemHeight = ySorted.reduce((sum, s) => sum + (s.height + HOLE_TOLERANCE), 0);
         const freeSpace = totalSpace - totalItemHeight;
         const gap = freeSpace / (n - 1);
         let currentEdge = minY;
         ySorted.forEach((s, i) => {
            const h = s.height + HOLE_TOLERANCE;
            const halfH = h / 2;
            if (i === 0) {
               updates.push({ id: s.id, x: s.x, y: roundToStep(minY + halfH) });
               currentEdge += h + gap;
            } else if (i === n - 1) {
               updates.push({ id: s.id, x: s.x, y: roundToStep(maxY - halfH) });
            } else {
               updates.push({ id: s.id, x: s.x, y: roundToStep(currentEdge + halfH) });
               currentEdge += h + gap;
            }
         });
       }
    }
    
    if (updates.length > 0) onUpdateSlots(updates);
  };

  const handleCanvasAlign = (position: string) => {
    const bounds = getSelectionBounds();
    if (!bounds) return;

    // Helper for 0.2mm step
    const roundToStep = (val: number) => Math.round(val / 0.2) * 0.2;

    let targetX = 0; // Relative move logic is tricky with snapping.
    // Better to calculate TARGET position for group, then diff.
    // But group moves together.
    // If I snap the DELTA, the result might not be snapped if original wasn't.
    // If I snap the RESULT, relative positions might shift unless I snap the Reference Point.
    
    // Strategy: Calculate new Group Reference Point (e.g. MinX), Snap IT, then move others relative to it.
    
    let dx = 0;
    let dy = 0;
    
    const { minX, maxX, minY, maxY } = bounds;
    
    // Horizontal with Spacing
    if (position === 'left') {
      // Target MinX = spacing (Snapped?) Spacing is usually integer.
      // But let's snap the target position just in case.
      const targetMinX = roundToStep(spacing);
      dx = targetMinX - minX;
    } else if (position === 'right') {
      // Target MaxX = canvasWidth - spacing
      const targetMaxX = roundToStep(canvasWidth - spacing);
      dx = targetMaxX - maxX;
    } else if (position === 'center-x') {
       const canvasCx = canvasWidth / 2;
       const groupCx = (minX + maxX) / 2;
       // Target GroupCx = canvasCx
       // dx = canvasCx - groupCx
       // But we want the RESULTing positions to be roughly snapped?
       // If we center, we center. 
       // Let's snap the dx?
       dx = roundToStep(canvasCx - groupCx);
    }

    // Vertical with Spacing
    if (position === 'bottom') {
      const targetMinY = roundToStep(spacing);
      dy = targetMinY - minY;
    } else if (position === 'top') {
      const targetMaxY = roundToStep(canvasHeight - spacing);
      dy = targetMaxY - maxY;
    } else if (position === 'center-y') {
      const canvasCy = canvasHeight / 2;
      const groupCy = (minY + maxY) / 2;
      dy = roundToStep(canvasCy - groupCy);
    }

    const updates: { id: string, x: number, y: number }[] = [];
    selectedIds.forEach(id => {
      const s = slots.find(slot => slot.id === id);
      if (s) {
        // We apply dx, dy.
        // Should we snap the final result?
        // If we snap dx/dy, and s.x was snapped, result is snapped.
        // If s.x was NOT snapped, result is NOT snapped.
        // User wants "Automatic Snap".
        // It implies the result should be on grid.
        // If I have a group, I can't snap ALL of them unless their relative distance is multiple of 0.2.
        // Standard CAD: Snap the Reference Point (e.g. Edge) to Grid.
        // The others follow.
        // So `dx = target - current` is correct.
        updates.push({ id: s.id, x: s.x + dx, y: s.y + dy });
      }
    });
    
    if (updates.length > 0) onUpdateSlots(updates);
  };

  const btnClass = "p-1.5 hover:bg-neutral-700/50 rounded text-neutral-300 hover:text-white transition-colors cursor-pointer group relative disabled:opacity-30 disabled:cursor-not-allowed";
  const tooltipClass = "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50";

  const showGroupAlign = selectedIds.size > 1;

  // Canvas Align Icons
  const CanvasIconLeft = ArrowLeft;
  const CanvasIconRight = ArrowRight;
  const CanvasIconTop = ArrowUp;
  const CanvasIconBottom = ArrowDown;
  const CanvasIconCenterX = AlignCenterHorizontal; 
  const CanvasIconCenterY = AlignCenterVertical;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-neutral-800/90 backdrop-blur-sm border border-neutral-700 rounded-lg shadow-xl px-2 py-1.5 z-50">
      
      {/* Canvas Alignment (Linear Row) */}
      <div className="flex items-center gap-0.5 mr-2 pr-2 border-r border-neutral-700">
         {/* Horizontal */}
         <button className={btnClass} onClick={() => handleCanvasAlign('left')}>
            <CanvasIconLeft size={16} strokeWidth={2.5} />
            <span className={tooltipClass}>To Canvas Left</span>
         </button>
         <button className={btnClass} onClick={() => handleCanvasAlign('center-x')}>
            <CanvasIconCenterX size={16} />
            <span className={tooltipClass}>To Canvas Center X</span>
         </button>
         <button className={btnClass} onClick={() => handleCanvasAlign('right')}>
            <CanvasIconRight size={16} strokeWidth={2.5} />
            <span className={tooltipClass}>To Canvas Right</span>
         </button>
         
         <div className="w-px h-4 bg-neutral-700 mx-1" />

         {/* Vertical */}
         <button className={btnClass} onClick={() => handleCanvasAlign('top')}>
            <CanvasIconTop size={16} strokeWidth={2.5} />
            <span className={tooltipClass}>To Canvas Top</span>
         </button>
         <button className={btnClass} onClick={() => handleCanvasAlign('center-y')}>
            <CanvasIconCenterY size={16} />
            <span className={tooltipClass}>To Canvas Center Y</span>
         </button>
         <button className={btnClass} onClick={() => handleCanvasAlign('bottom')}>
            <CanvasIconBottom size={16} strokeWidth={2.5} />
            <span className={tooltipClass}>To Canvas Bottom</span>
         </button>
      </div>

      {/* Relative Alignment (Only if Multiple Selected) */}
      {showGroupAlign && (
        <>
          {/* Horizontal Alignment */}
          <button className={btnClass} onClick={() => handleAlign('left')}>
            <AlignLeft size={18} />
            <span className={tooltipClass}>Align Selection Left</span>
          </button>
          <button className={btnClass} onClick={() => handleAlign('center-x')}>
            <AlignCenterHorizontal size={18} />
            <span className={tooltipClass}>Align Selection Center X</span>
          </button>
          <button className={btnClass} onClick={() => handleAlign('right')}>
            <AlignRight size={18} />
            <span className={tooltipClass}>Align Selection Right</span>
          </button>

          <div className="w-px h-6 bg-neutral-700 mx-1" />

          {/* Vertical Alignment */}
          <button className={btnClass} onClick={() => handleAlign('top')}>
            <AlignStartVertical size={18} />
            <span className={tooltipClass}>Align Selection Top</span>
          </button>
          <button className={btnClass} onClick={() => handleAlign('center-y')}>
            <AlignCenterVertical size={18} />
            <span className={tooltipClass}>Align Selection Center Y</span>
          </button>
          <button className={btnClass} onClick={() => handleAlign('bottom')}>
            <AlignEndVertical size={18} />
            <span className={tooltipClass}>Align Selection Bottom</span>
          </button>

          <div className="w-px h-6 bg-neutral-700 mx-1" />

          {/* Distribution */}
          <button className={btnClass} onClick={() => handleAlign('distribute-h')}>
            <AlignHorizontalDistributeCenter size={18} />
            <span className={tooltipClass}>Distribute Horizontal Spacing</span>
          </button>
          <button className={btnClass} onClick={() => handleAlign('distribute-v')}>
            <AlignVerticalDistributeCenter size={18} />
            <span className={tooltipClass}>Distribute Vertical Spacing</span>
          </button>
        </>
      )}

      <div className="ml-2 text-xs text-neutral-500 font-mono">
        {selectedIds.size} Selected
      </div>
    </div>
  );
}
