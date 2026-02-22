import {
  AlignLeft, AlignCenterHorizontal, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  AlignHorizontalSpaceAround, AlignVerticalSpaceAround,
  ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine
} from "lucide-react";
import { FreeSlot } from "@/types/custom-tray";
import { HOLE_TOLERANCE } from "@/lib/config";

// ── 常量与工具 ──────────────────────────────
const STEP = 0.2; // 对齐步长 mm
const roundToStep = (val: number) => Math.round(val / STEP) * STEP;

type AlignType = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom' | 'distribute-h' | 'distribute-v';
type CanvasAlignPos = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';
type Update = { id: string; x: number; y: number };

/** 计算旋转椭圆的 AABB 半尺寸（含公差） */
function getSlotBounds(slot: FreeSlot) {
  const rad = ((slot.rotation || 0) * Math.PI) / 180;
  const a = (slot.width + HOLE_TOLERANCE) / 2;
  const b = (slot.height + HOLE_TOLERANCE) / 2;
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
  canvasWidth: number;
  canvasHeight: number;
  spacing: number;
}

export default function AlignmentToolbar({ selectedIds, slots, onUpdateSlots, canvasWidth, canvasHeight, spacing }: AlignmentToolbarProps) {
  const hasSelection = selectedIds.size > 0;
  const hasMultiple = selectedIds.size > 1;

  /** 获取选中项的总包围盒 */
  const getSelectionBounds = () => {
    const selected = slots.filter(s => selectedIds.has(s.id));
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

  // ── 选中项之间的相对对齐 ──────────

  const handleAlign = (type: AlignType) => {
    const selected = slots.filter(s => selectedIds.has(s.id));
    if (selected.length < 2) return;

    // 仅在需要时计算完整包围盒
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    selected.forEach(s => {
      const { halfW, halfH } = getSlotBounds(s);
      minX = Math.min(minX, s.x - halfW);
      maxX = Math.max(maxX, s.x + halfW);
      minY = Math.min(minY, s.y - halfH);
      maxY = Math.max(maxY, s.y + halfH);
    });

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
      case 'distribute-h':
        distributeAxis(selected, 'x', minX, maxX, updates);
        break;
      case 'distribute-v':
        distributeAxis(selected, 'y', minY, maxY, updates);
        break;
    }

    if (updates.length > 0) onUpdateSlots(updates);
  };

  /**
   * 在选中项包围盒内等距分布
   * - n=2 时：首尾贴边
   * - n>2 时：首尾固定，中间等距
   */
  function distributeAxis(
    selected: FreeSlot[],
    axis: 'x' | 'y',
    rangeMin: number,
    rangeMax: number,
    updates: Update[]
  ) {
    const n = selected.length;
    if (n < 2) return;

    const sorted = [...selected].sort((a, b) => a[axis] - b[axis]);
    const getHalf = (s: FreeSlot) => axis === 'x' ? getSlotBounds(s).halfW : getSlotBounds(s).halfH;

    if (n === 2) {
      // 2 个元素：各自贴到包围盒两端
      const h0 = getHalf(sorted[0]);
      const h1 = getHalf(sorted[1]);
      if (axis === 'x') {
        updates.push({ id: sorted[0].id, x: roundToStep(rangeMin + h0), y: sorted[0].y });
        updates.push({ id: sorted[1].id, x: roundToStep(rangeMax - h1), y: sorted[1].y });
      } else {
        updates.push({ id: sorted[0].id, x: sorted[0].x, y: roundToStep(rangeMin + h0) });
        updates.push({ id: sorted[1].id, x: sorted[1].x, y: roundToStep(rangeMax - h1) });
      }
      return;
    }

    // n>2：首尾固定，中间等距
    const totalSpace = rangeMax - rangeMin;
    const totalItemSize = sorted.reduce((sum, s) => sum + getHalf(s) * 2, 0);
    const gap = (totalSpace - totalItemSize) / (n - 1);

    // 使用第一个排序元素自身的半宽作为起始边缘
    const firstHalf = getHalf(sorted[0]);
    let currentEdge = rangeMin + firstHalf * 2 + gap; // 第一个元素占据的空间后

    sorted.forEach((s, i) => {
      const half = getHalf(s);
      if (i === 0) {
        // 第一个：贴左/上
        if (axis === 'x') updates.push({ id: s.id, x: roundToStep(rangeMin + half), y: s.y });
        else updates.push({ id: s.id, x: s.x, y: roundToStep(rangeMin + half) });
      } else if (i === n - 1) {
        // 最后一个：贴右/下
        if (axis === 'x') updates.push({ id: s.id, x: roundToStep(rangeMax - half), y: s.y });
        else updates.push({ id: s.id, x: s.x, y: roundToStep(rangeMax - half) });
      } else {
        // 中间：等距
        if (axis === 'x') updates.push({ id: s.id, x: roundToStep(currentEdge + half), y: s.y });
        else updates.push({ id: s.id, x: s.x, y: roundToStep(currentEdge + half) });
        currentEdge += half * 2 + gap;
      }
    });
  }

  // ── 画布对齐（整组平移到画布边缘/中心） ──────────

  const handleCanvasAlign = (position: CanvasAlignPos) => {
    const bounds = getSelectionBounds();
    if (!bounds) return;

    const { minX, maxX, minY, maxY } = bounds;
    let dx = 0, dy = 0;

    // 对目标位置做 round，而非对 delta 做 round，避免精度偏差
    switch (position) {
      case 'left': dx = roundToStep(spacing) - minX; break;
      case 'right': dx = roundToStep(canvasWidth - spacing) - maxX; break;
      case 'center-x': dx = roundToStep(canvasWidth / 2) - (minX + maxX) / 2; break;
      case 'bottom': dy = roundToStep(spacing) - minY; break;
      case 'top': dy = roundToStep(canvasHeight - spacing) - maxY; break;
      case 'center-y': dy = roundToStep(canvasHeight / 2) - (minY + maxY) / 2; break;
    }

    const updates: Update[] = [];
    selectedIds.forEach(id => {
      const s = slots.find(slot => slot.id === id);
      if (s) updates.push({ id: s.id, x: s.x + dx, y: s.y + dy });
    });

    if (updates.length > 0) onUpdateSlots(updates);
  };

  // ── 画布内等距分布（space-evenly） ──────────

  const handleCanvasDistribute = (axis: 'h' | 'v') => {
    const selected = slots.filter(s => selectedIds.has(s.id));
    if (selected.length < 2) return;

    const updates: Update[] = [];
    const isH = axis === 'h';

    const sorted = [...selected].sort((a, b) =>
      isH ? a.x - b.x : a.y - b.y
    );

    const canvasSize = isH ? canvasWidth : canvasHeight;
    const availableStart = spacing;
    const totalAvailable = canvasSize - spacing * 2;

    const totalItemSize = sorted.reduce((sum, s) => {
      const b = getSlotBounds(s);
      return sum + (isH ? b.halfW : b.halfH) * 2;
    }, 0);

    const gap = (totalAvailable - totalItemSize) / (sorted.length + 1);
    let cursor = availableStart + gap;

    sorted.forEach(s => {
      const b = getSlotBounds(s);
      const half = isH ? b.halfW : b.halfH;
      if (isH) {
        updates.push({ id: s.id, x: roundToStep(cursor + half), y: s.y });
      } else {
        updates.push({ id: s.id, x: s.x, y: roundToStep(cursor + half) });
      }
      cursor += half * 2 + gap;
    });

    if (updates.length > 0) onUpdateSlots(updates);
  };

  // ── UI ──────────

  const btnClass = "p-1.5 hover:bg-neutral-700/50 rounded text-neutral-300 hover:text-white transition-colors cursor-pointer group relative disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-300";
  const tooltipClass = "absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50";

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-neutral-800/90 backdrop-blur-sm border border-neutral-700 rounded-lg shadow-xl px-2 py-1.5 z-50">

      {/* 画布对齐 */}
      <div className="flex items-center gap-0.5 mr-2 pr-2 border-r border-neutral-700">
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('left')}>
          <ArrowLeftToLine size={16} strokeWidth={2.5} />
          <span className={tooltipClass}>靠左对齐画布</span>
        </button>
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('center-x')}>
          <AlignCenterHorizontal size={16} />
          <span className={tooltipClass}>水平居中画布</span>
        </button>
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('right')}>
          <ArrowRightToLine size={16} strokeWidth={2.5} />
          <span className={tooltipClass}>靠右对齐画布</span>
        </button>

        <div className="w-px h-4 bg-neutral-700 mx-1" />

        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('top')}>
          <ArrowUpToLine size={16} strokeWidth={2.5} />
          <span className={tooltipClass}>靠上对齐画布</span>
        </button>
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('center-y')}>
          <AlignCenterVertical size={16} />
          <span className={tooltipClass}>垂直居中画布</span>
        </button>
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleCanvasAlign('bottom')}>
          <ArrowDownToLine size={16} strokeWidth={2.5} />
          <span className={tooltipClass}>靠下对齐画布</span>
        </button>

        <div className="w-px h-4 bg-neutral-700 mx-1" />

        {/* 画布分布 */}
        <button className={btnClass} disabled={!hasMultiple} onClick={() => handleCanvasDistribute('h')}>
          <AlignHorizontalSpaceAround size={16} />
          <span className={tooltipClass}>水平均匀分布于画布</span>
        </button>
        <button className={btnClass} disabled={!hasMultiple} onClick={() => handleCanvasDistribute('v')}>
          <AlignVerticalSpaceAround size={16} />
          <span className={tooltipClass}>垂直均匀分布于画布</span>
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

      {/* 选中项内分布 */}
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
