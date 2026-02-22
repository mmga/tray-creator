import {
  AlignLeft, AlignCenterHorizontal, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine
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
  const hasSelection = selectedIds.size > 0;
  const hasMultiple = selectedIds.size > 1;

  // Helper to get bounding box of rotated ellipse
  const getEllipseRotatedBounds = (slot: FreeSlot) => {
    const w = slot.width;
    const h = slot.height;
    const rotation = slot.rotation || 0;

    const rad = (rotation * Math.PI) / 180;
    const a = (w + HOLE_TOLERANCE) / 2;
    const b = (h + HOLE_TOLERANCE) / 2;

    const halfW = Math.sqrt(Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2));
    const halfH = Math.sqrt(Math.pow(a * Math.sin(rad), 2) + Math.pow(b * Math.cos(rad), 2));

    return { halfW, halfH };
  };

  const getSelectionBounds = () => {
    const selected = slots.filter(s => selectedIds.has(s.id));
    if (selected.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Bounds are based on Visual Edge (including tolerance)
    selected.forEach(s => {
      const { halfW, halfH } = getEllipseRotatedBounds(s);
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
      const { halfW, halfH } = getEllipseRotatedBounds(s);
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
        const { halfW } = getEllipseRotatedBounds(s);
        updates.push({ id: s.id, x: roundToStep(minX + halfW), y: s.y });
      });
    } else if (type === 'center-x') {
      selected.forEach(s => {
        updates.push({ id: s.id, x: roundToStep(centerX), y: s.y });
      });
    } else if (type === 'right') {
      selected.forEach(s => {
        const { halfW } = getEllipseRotatedBounds(s);
        updates.push({ id: s.id, x: roundToStep(maxX - halfW), y: s.y });
      });
    } else if (type === 'top') {
      // Align Top: Max Y
      selected.forEach(s => {
        const { halfH } = getEllipseRotatedBounds(s);
        updates.push({ id: s.id, x: s.x, y: roundToStep(maxY - halfH) });
      });
    } else if (type === 'center-y') {
      selected.forEach(s => {
        updates.push({ id: s.id, x: s.x, y: roundToStep(centerY) });
      });
    } else if (type === 'bottom') {
      // Align Bottom: Min Y
      selected.forEach(s => {
        const { halfH } = getEllipseRotatedBounds(s);
        updates.push({ id: s.id, x: s.x, y: roundToStep(minY + halfH) });
      });
    } else if (type === 'distribute-h') {
      const n = selected.length;
      if (n > 2) {
        const totalSpace = (maxX - minX);
        const totalItemWidth = xSorted.reduce((sum, s) => {
          const { halfW } = getEllipseRotatedBounds(s);
          return sum + halfW * 2;
        }, 0);
        const freeSpace = totalSpace - totalItemWidth;
        const gap = freeSpace / (n - 1);
        let currentEdge = minX;
        xSorted.forEach((s, i) => {
          const { halfW } = getEllipseRotatedBounds(s);
          const w = halfW * 2;
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
        const totalItemHeight = ySorted.reduce((sum, s) => {
          const { halfH } = getEllipseRotatedBounds(s);
          return sum + halfH * 2;
        }, 0);
        const freeSpace = totalSpace - totalItemHeight;
        const gap = freeSpace / (n - 1);
        let currentEdge = minY;
        ySorted.forEach((s, i) => {
          const { halfH } = getEllipseRotatedBounds(s);
          const h = halfH * 2;
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

    let dx = 0;
    let dy = 0;

    const { minX, maxX, minY, maxY } = bounds;

    // Horizontal with Spacing
    if (position === 'left') {
      const targetMinX = roundToStep(spacing);
      dx = targetMinX - minX;
    } else if (position === 'right') {
      const targetMaxX = roundToStep(canvasWidth - spacing);
      dx = targetMaxX - maxX;
    } else if (position === 'center-x') {
      const canvasCx = canvasWidth / 2;
      const groupCx = (minX + maxX) / 2;
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
        updates.push({ id: s.id, x: s.x + dx, y: s.y + dy });
      }
    });

    if (updates.length > 0) onUpdateSlots(updates);
  };

  const btnClass = "p-1.5 hover:bg-neutral-700/50 rounded text-neutral-300 hover:text-white transition-colors cursor-pointer group relative disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-300";
  const tooltipClass = "absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50";

  // Canvas Align Icons
  const CanvasIconLeft = ArrowLeftToLine;
  const CanvasIconRight = ArrowRightToLine;
  const CanvasIconTop = ArrowUpToLine;
  const CanvasIconBottom = ArrowDownToLine;
  const CanvasIconCenterX = AlignCenterHorizontal;
  const CanvasIconCenterY = AlignCenterVertical;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-neutral-800/90 backdrop-blur-sm border border-neutral-700 rounded-lg shadow-xl px-2 py-1.5 z-50">

      {/* 画布对齐 */}
      <div className="flex items-center gap-0.5 mr-2 pr-2 border-r border-neutral-700">
        {/* 水平 */}
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('left')}>
          <CanvasIconLeft size={16} strokeWidth={2.5} />
          <span className={tooltipClass}>靠左对齐画布</span>
        </button>
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('center-x')}>
          <CanvasIconCenterX size={16} />
          <span className={tooltipClass}>水平居中画布</span>
        </button>
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('right')}>
          <CanvasIconRight size={16} strokeWidth={2.5} />
          <span className={tooltipClass}>靠右对齐画布</span>
        </button>

        <div className="w-px h-4 bg-neutral-700 mx-1" />

        {/* 垂直 */}
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('top')}>
          <CanvasIconTop size={16} strokeWidth={2.5} />
          <span className={tooltipClass}>靠上对齐画布</span>
        </button>
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('center-y')}>
          <CanvasIconCenterY size={16} />
          <span className={tooltipClass}>垂直居中画布</span>
        </button>
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('bottom')}>
          <CanvasIconBottom size={16} strokeWidth={2.5} />
          <span className={tooltipClass}>靠下对齐画布</span>
        </button>
      </div>

      {/* 多选对齐 */}
      <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('left')}>
        <AlignLeft size={18} />
        <span className={tooltipClass}>左对齐选中项</span>
      </button>
      <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('center-x')}>
        <AlignCenterHorizontal size={18} />
        <span className={tooltipClass}>水平居中选中项</span>
      </button>
      <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('right')}>
        <AlignRight size={18} />
        <span className={tooltipClass}>右对齐选中项</span>
      </button>

      <div className="w-px h-6 bg-neutral-700 mx-1" />

      <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('top')}>
        <AlignStartVertical size={18} />
        <span className={tooltipClass}>顶部对齐选中项</span>
      </button>
      <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('center-y')}>
        <AlignCenterVertical size={18} />
        <span className={tooltipClass}>垂直居中选中项</span>
      </button>
      <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('bottom')}>
        <AlignEndVertical size={18} />
        <span className={tooltipClass}>底部对齐选中项</span>
      </button>

      <div className="w-px h-6 bg-neutral-700 mx-1" />

      {/* 分布 */}
      <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('distribute-h')}>
        <AlignHorizontalDistributeCenter size={18} />
        <span className={tooltipClass}>水平等距分布</span>
      </button>
      <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('distribute-v')}>
        <AlignVerticalDistributeCenter size={18} />
        <span className={tooltipClass}>垂直等距分布</span>
      </button>

      <div className="ml-2 text-xs text-neutral-500 font-mono">
        {selectedIds.size > 0 ? `${selectedIds.size} 已选择` : '未选择'}
      </div>
    </div>
  );
}
