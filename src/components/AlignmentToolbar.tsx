
import { 
  AlignLeft, AlignCenterHorizontal, AlignRight, 
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter 
} from "lucide-react";
import { FreeSlot } from "@/types/custom-tray";
import { HOLE_TOLERANCE } from "@/lib/config";

interface AlignmentToolbarProps {
  selectedIds: Set<string>;
  slots: FreeSlot[];
  onUpdateSlots: (updates: { id: string, x: number, y: number }[]) => void;
}

export default function AlignmentToolbar({ selectedIds, slots, onUpdateSlots }: AlignmentToolbarProps) {
  if (selectedIds.size < 2) return null;

  const handleAlign = (type: string) => {
    const selected = slots.filter(s => selectedIds.has(s.id));
    if (selected.length < 2) return;

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    // For distribution
    const xSorted = [...selected].sort((a, b) => a.x - b.x);
    const ySorted = [...selected].sort((a, b) => a.y - b.y);

    selected.forEach(s => {
      // Use physical coordinates (center)
      // Visual Bounds: x - w/2, x + w/2
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

    // Alignment Logic
    if (type === 'left') {
      selected.forEach(s => {
        const halfW = (s.width + HOLE_TOLERANCE) / 2;
        updates.push({ id: s.id, x: minX + halfW, y: s.y });
      });
    } else if (type === 'center-x') {
      selected.forEach(s => {
        updates.push({ id: s.id, x: centerX, y: s.y });
      });
    } else if (type === 'right') {
      selected.forEach(s => {
        const halfW = (s.width + HOLE_TOLERANCE) / 2;
        updates.push({ id: s.id, x: maxX - halfW, y: s.y });
      });
    } else if (type === 'top') {
      // Physical Y: Higher is Top?
      // In LayoutCanvas, `svgY = trayDepth - slot.y`.
      // So large slot.y means small svgY (Top of SVG).
      // Wait. SVG coordinate system: 0 is top.
      // Physical coordinate system: 0 is bottom-left (Cartesian)?
      // Let's check LayoutCanvas. `const svgY = trayDepth - slot.y;`
      // Yes, slot.y is distance from BOTTOM.
      // So "Align Top" means align to MAX(slot.y + halfH).
      selected.forEach(s => {
        const halfH = (s.height + HOLE_TOLERANCE) / 2;
        updates.push({ id: s.id, x: s.x, y: maxY - halfH });
      });
    } else if (type === 'center-y') {
      selected.forEach(s => {
        updates.push({ id: s.id, x: s.x, y: centerY });
      });
    } else if (type === 'bottom') {
      // Align to MIN(slot.y - halfH)
      selected.forEach(s => {
        const halfH = (s.height + HOLE_TOLERANCE) / 2;
        updates.push({ id: s.id, x: s.x, y: minY + halfH });
      });
    } else if (type === 'distribute-h') {
      // Distribute Spacing (Equal Gaps)
      // Available width = (maxX - minX)
      // Total item width = sum(widths)
      // Remaining space = Available - Total
      // Gap = Remaining / (n-1)
      
      const n = selected.length;
      if (n > 2) {
        const totalItemWidth = xSorted.reduce((sum, s) => sum + (s.width + HOLE_TOLERANCE), 0);
        const totalSpace = (maxX - minX);
        const freeSpace = totalSpace - totalItemWidth;
        // Wait, totalItemWidth includes the halves of the first and last item?
        // Let's recalculate precisely.
        // Span = (Rightmost Edge) - (Leftmost Edge).
        // Actual gaps sum = Span - (sum of all widths).
        // Correct.
        // Gap = freeSpace / (n - 1).
        
        // But logic is simpler if we just place them left-to-right.
        // Start X = minX.
        // currentX = minX;
        // for each: place at currentX + halfW. currentX += w + gap.
        
        const gap = freeSpace / (n - 1);
        let curX = minX;
        
        xSorted.forEach(s => {
           const w = s.width + HOLE_TOLERANCE;
           const halfW = w / 2;
           updates.push({ id: s.id, x: curX + halfW, y: s.y });
           curX += w + gap;
        });
      }
    } else if (type === 'distribute-v') {
      // Sort specific for V? Yes ySorted.
      // Vertical from Bottom to Top? or Top to Bottom?
      // Does not matter as long as sorted.
      // minY is bottom-most edge. maxY is top-most edge.
      const n = selected.length;
      if (n > 2) {
        const totalItemHeight = ySorted.reduce((sum, s) => sum + (s.height + HOLE_TOLERANCE), 0);
        const totalSpace = (maxY - minY);
        const freeSpace = totalSpace - totalItemHeight;
        const gap = freeSpace / (n - 1);
        
        let curY = minY;
        ySorted.forEach(s => {
          const h = s.height + HOLE_TOLERANCE;
          const halfH = h / 2;
          updates.push({ id: s.id, x: s.x, y: curY + halfH });
          curY += h + gap;
        });
      }
    }

    if (updates.length > 0) {
      onUpdateSlots(updates);
    }
  };

  const btnClass = "p-1.5 hover:bg-neutral-700/50 rounded text-neutral-300 hover:text-white transition-colors cursor-pointer group relative";
  const tooltipClass = "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity";

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-neutral-800/90 backdrop-blur-sm border border-neutral-700 rounded-lg shadow-xl px-2 py-1.5 z-50">
      
      {/* Horizontal Alignment */}
      <button className={btnClass} onClick={() => handleAlign('left')}>
        <AlignLeft size={18} />
        <span className={tooltipClass}>Align Left</span>
      </button>
      <button className={btnClass} onClick={() => handleAlign('center-x')}>
        <AlignCenterHorizontal size={18} />
        <span className={tooltipClass}>Align Center X</span>
      </button>
      <button className={btnClass} onClick={() => handleAlign('right')}>
        <AlignRight size={18} />
        <span className={tooltipClass}>Align Right</span>
      </button>

      <div className="w-px h-6 bg-neutral-700 mx-1" />

      {/* Vertical Alignment */}
      <button className={btnClass} onClick={() => handleAlign('top')}>
        <AlignStartVertical size={18} />
        <span className={tooltipClass}>Align Top</span>
      </button>
      <button className={btnClass} onClick={() => handleAlign('center-y')}>
        <AlignCenterVertical size={18} />
        <span className={tooltipClass}>Align Center Y</span>
      </button>
      <button className={btnClass} onClick={() => handleAlign('bottom')}>
        <AlignEndVertical size={18} />
        <span className={tooltipClass}>Align Bottom</span>
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

      <div className="ml-2 text-xs text-neutral-500 font-mono">
        {selectedIds.size} Selected
      </div>
    </div>
  );
}
