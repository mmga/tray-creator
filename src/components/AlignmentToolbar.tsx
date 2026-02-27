import {
  AlignLeft, AlignCenterHorizontal, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Rows2,
  Columns2,
} from "lucide-react";
import { FreeSlot } from "@/types/custom-tray";
import { getSlotTolerance } from "@/lib/config";

// ── 常量与工具 ──────────────────────────────
const STEP = 0.2; // 对齐步长 mm
const roundToStep = (val: number) => Math.round(val / STEP) * STEP;

type AlignType = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';
type ArrangeType = 'row' | 'column';
type Update = { id: string; x: number; y: number };

/** 计算旋转椭圆的 AABB 半尺寸（含公差） */
function getSlotBounds(slot: FreeSlot) {
  const rad = ((slot.rotation || 0) * Math.PI) / 180;
  const a = (slot.width + getSlotTolerance(slot.width)) / 2;
  const b = (slot.height + getSlotTolerance(slot.height)) / 2;
  return {
    halfW: Math.sqrt((a * Math.cos(rad)) ** 2 + (b * Math.sin(rad)) ** 2),
    halfH: Math.sqrt((a * Math.sin(rad)) ** 2 + (b * Math.cos(rad)) ** 2),
  };
}

// ── 组件 ──────────────────────────────

interface AlignmentToolbarProps {
  selectedIds: Set<string>;
  slots: FreeSlot[];
  onUpdateSlots: (updates: Update[]) => void;
  spacing: number;
}

export default function AlignmentToolbar({ selectedIds, slots, onUpdateSlots, spacing }: AlignmentToolbarProps) {
  const hasSelection = selectedIds.size > 0;
  const hasMultiple = selectedIds.size > 1;

  /** 获取选中项的总包围盒 */
  const getSelectionBounds = (selected: FreeSlot[]) => {
    if (selected.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    selected.forEach(s => {
      const { halfW, halfH } = getSlotBounds(s);
      minX = Math.min(minX, s.x - halfW);
      maxX = Math.max(maxX, s.x + halfW);
      minY = Math.min(minY, s.y - halfH);
      maxY = Math.max(maxY, s.y + halfH);
    });

    return { minX, maxX, minY, maxY };
  };

  const getSelected = () => {
    const selected = slots.filter(s => selectedIds.has(s.id));
    return selected;
  };

  const getSelectionCenter = (selected: FreeSlot[]) => {
    const bounds = getSelectionBounds(selected);
    if (!bounds) return null;
    return {
      cx: (bounds.minX + bounds.maxX) / 2,
      cy: (bounds.minY + bounds.maxY) / 2,
    };
  };

  // ── 选中项之间的相对对齐 ──────────

  const handleAlign = (type: AlignType) => {
    const selected = getSelected();
    if (selected.length < 2) return;

    // 仅在需要时计算完整包围盒
    const bounds = getSelectionBounds(selected);
    if (!bounds) return;
    const { minX, maxX, minY, maxY } = bounds;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const updates: Update[] = [];

    switch (type) {
      case 'left':
        selected.forEach(s => {
          const { halfW } = getSlotBounds(s);
          updates.push({ id: s.id, x: roundToStep(minX + halfW), y: s.y });
        });
        break;
      case 'center-x':
        selected.forEach(s => {
          updates.push({ id: s.id, x: roundToStep(centerX), y: s.y });
        });
        break;
      case 'right':
        selected.forEach(s => {
          const { halfW } = getSlotBounds(s);
          updates.push({ id: s.id, x: roundToStep(maxX - halfW), y: s.y });
        });
        break;
      case 'top':
        selected.forEach(s => {
          const { halfH } = getSlotBounds(s);
          updates.push({ id: s.id, x: s.x, y: roundToStep(maxY - halfH) });
        });
        break;
      case 'center-y':
        selected.forEach(s => {
          updates.push({ id: s.id, x: s.x, y: roundToStep(centerY) });
        });
        break;
      case 'bottom':
        selected.forEach(s => {
          const { halfH } = getSlotBounds(s);
          updates.push({ id: s.id, x: s.x, y: roundToStep(minY + halfH) });
        });
        break;
    }

    if (updates.length > 0) onUpdateSlots(updates);
  };

  const handleArrange = (type: ArrangeType) => {
    const selected = getSelected();
    if (selected.length < 2) return;

    const center = getSelectionCenter(selected);
    if (!center) return;
    const updates: Update[] = [];

    if (type === 'row') {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const totalWidth = sorted.reduce((sum, slot) => sum + getSlotBounds(slot).halfW * 2, 0);
      const totalGap = spacing * (sorted.length - 1);
      const totalSpan = totalWidth + totalGap;

      let cursor = center.cx - totalSpan / 2;
      sorted.forEach((slot) => {
        const { halfW } = getSlotBounds(slot);
        const x = cursor + halfW;
        updates.push({ id: slot.id, x: roundToStep(x), y: roundToStep(center.cy) });
        cursor += halfW * 2 + spacing;
      });
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const totalHeight = sorted.reduce((sum, slot) => sum + getSlotBounds(slot).halfH * 2, 0);
      const totalGap = spacing * (sorted.length - 1);
      const totalSpan = totalHeight + totalGap;

      let cursor = center.cy - totalSpan / 2;
      sorted.forEach((slot) => {
        const { halfH } = getSlotBounds(slot);
        const y = cursor + halfH;
        updates.push({ id: slot.id, x: roundToStep(center.cx), y: roundToStep(y) });
        cursor += halfH * 2 + spacing;
      });
    }

    if (updates.length > 0) onUpdateSlots(updates);
  };

  // ── UI ──────────

  const btnClass = "h-8 px-2 lg:px-2.5 hover:bg-neutral-700/50 rounded text-neutral-300 hover:text-white transition-colors cursor-pointer group relative disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-300 shrink-0 inline-flex items-center gap-1";
  const tooltipClass = "absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50 hidden lg:block";

  if (!hasSelection) return null;

  return (
    <div className="absolute top-2 lg:top-4 left-1/2 transform -translate-x-1/2 max-w-[calc(100vw-1rem)] flex items-center bg-neutral-800/90 backdrop-blur-sm border border-neutral-700 rounded-lg shadow-xl px-1 lg:px-2 py-1 lg:py-1.5 z-50 overflow-x-auto scrollbar-none">
      {/* 组内对齐 */}
      <div className="flex items-center gap-0.5 mr-1 lg:mr-2 pr-1 lg:pr-2 border-r border-neutral-700 shrink-0">
        <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('left')}>
          <AlignLeft size={16} />
          <span className="hidden lg:inline text-[10px]">左</span>
          <span className={tooltipClass}>左对齐选中项</span>
        </button>
        <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('center-x')}>
          <AlignCenterHorizontal size={16} />
          <span className="hidden lg:inline text-[10px]">中</span>
          <span className={tooltipClass}>水平居中选中项</span>
        </button>
        <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('right')}>
          <AlignRight size={16} />
          <span className="hidden lg:inline text-[10px]">右</span>
          <span className={tooltipClass}>右对齐选中项</span>
        </button>

        <div className="w-px h-6 bg-neutral-700 mx-0.5 lg:mx-1 shrink-0" />

        <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('top')}>
          <AlignStartVertical size={16} />
          <span className="hidden lg:inline text-[10px]">上</span>
          <span className={tooltipClass}>顶部对齐选中项</span>
        </button>
        <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('center-y')}>
          <AlignCenterVertical size={16} />
          <span className="hidden lg:inline text-[10px]">中</span>
          <span className={tooltipClass}>垂直居中选中项</span>
        </button>
        <button className={btnClass} disabled={!hasMultiple} onClick={() => handleAlign('bottom')}>
          <AlignEndVertical size={16} />
          <span className="hidden lg:inline text-[10px]">下</span>
          <span className={tooltipClass}>底部对齐选中项</span>
        </button>
      </div>

      {/* 排成一排/列 */}
      <div className="flex items-center gap-0.5 mr-1 lg:mr-2 pr-1 lg:pr-2 border-r border-neutral-700 shrink-0">
        <button className={btnClass} disabled={!hasMultiple} onClick={() => handleArrange('row')}>
          <Rows2 size={16} />
          <span className="hidden lg:inline text-[10px]">一排</span>
          <span className={tooltipClass}>排成一排（间距+{spacing}mm）</span>
        </button>
        <button className={btnClass} disabled={!hasMultiple} onClick={() => handleArrange('column')}>
          <Columns2 size={16} />
          <span className="hidden lg:inline text-[10px]">一列</span>
          <span className={tooltipClass}>排成一列（间距+{spacing}mm）</span>
        </button>
      </div>

      <div className="ml-1 lg:ml-2 text-[10px] lg:text-xs text-neutral-500 font-mono shrink-0">
        {selectedIds.size > 0 ? `${selectedIds.size} 选中` : '未选择'}
      </div>
    </div>
  );
}
