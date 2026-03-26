import { useState } from "react";
import {
  AlignLeft, AlignCenterHorizontal, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Rows2,
  Columns2,
  FlipHorizontal,
  FlipVertical,
  Copy,
} from "lucide-react";
import { FreeSlot, type SteppedSlot } from "@/types/custom-tray";
import { getSlotTolerance } from "@/lib/config";
import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";
import { useToast } from "@/hooks/useToast";
import {
  buildMirrorInsertSlots,
  buildMirrorMoveUpdates,
  countOutOfBoundsSlots,
  type SymmetryInsertSlot,
  type SymmetryAxisSource,
  type SymmetryMode,
  type SymmetrySlot,
} from "@/lib/layout-symmetry";

// ── 常量与工具 ──────────────────────────────
const STEP = 0.2; // 对齐步长 mm
const roundToStep = (val: number) => Math.round(val / STEP) * STEP;

type AlignType = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';
type ArrangeType = 'row' | 'column';
type Update = { id: string; x: number; y: number; rotation?: number };

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
  slots: Array<FreeSlot | SteppedSlot>;
  onUpdateSlots: (updates: Update[]) => void;
  onInsertSlots?: (slots: SymmetryInsertSlot[]) => void;
  spacing: number;
  trayWidth: number;
  trayDepth: number;
}

export default function AlignmentToolbar({ selectedIds, slots, onUpdateSlots, onInsertSlots, spacing, trayWidth, trayDepth }: AlignmentToolbarProps) {
  const [axisSource, setAxisSource] = useState<SymmetryAxisSource>("selection");
  const { toast } = useToast();
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

  const getSelected = (): SymmetrySlot[] => {
    const selected = slots.filter(s => selectedIds.has(s.id));
    return selected as SymmetrySlot[];
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

  const handleMirrorMove = (mode: SymmetryMode) => {
    const selected = getSelected();
    if (selected.length === 0) return;

    const updates = buildMirrorMoveUpdates(
      selected,
      trayWidth,
      trayDepth,
      axisSource,
      mode,
    );

    if (updates.length > 0) {
      onUpdateSlots(updates);

      const nextSlots = updates
        .map((update) => {
          const original = selected.find((slot) => slot.id === update.id);
          if (!original) return null;

          return {
            ...original,
            x: update.x,
            y: update.y,
            rotation: update.rotation ?? original.rotation,
          };
        })
        .filter((slot): slot is SymmetrySlot => slot !== null);

      const outOfBoundsCount = countOutOfBoundsSlots(
        nextSlots,
        trayWidth,
        trayDepth,
      );

      if (outOfBoundsCount > 0) {
        toast(
          "info",
          `镜像后有 ${outOfBoundsCount} 个槽位超出托盘边界，请继续调整。`,
        );
      }
    }
  };

  const handleMirrorCopy = (mode: SymmetryMode) => {
    if (!onInsertSlots) return;

    const selected = getSelected();
    if (selected.length === 0) return;

    const inserts = buildMirrorInsertSlots(
      selected,
      trayWidth,
      trayDepth,
      axisSource,
      mode,
    );

    if (inserts.length === 0) return;

    const buildCollisionPolygon = (slot: Pick<FreeSlot, "x" | "y" | "width" | "height" | "rotation">) => {
      const margin = spacing / 2 + getSlotTolerance(slot.width) / 2;
      return getEllipsePolygon(
        slot.x,
        slot.y,
        slot.width,
        slot.height,
        slot.rotation,
        margin,
        12,
      );
    };

    const isSameGeometry = (
      left: Pick<FreeSlot, "x" | "y" | "width" | "height" | "rotation" | "shape">,
      right: Pick<FreeSlot, "x" | "y" | "width" | "height" | "rotation" | "shape">,
    ) => {
      const within = (a: number, b: number) => Math.abs(a - b) < 0.05;
      return (
        left.shape === right.shape &&
        within(left.x, right.x) &&
        within(left.y, right.y) &&
        within(left.width, right.width) &&
        within(left.height, right.height) &&
        within(left.rotation, right.rotation)
      );
    };

    const hasSpacingCollision = (
      candidate: SymmetryInsertSlot,
      others: Array<FreeSlot | SteppedSlot | SymmetryInsertSlot>,
    ) => {
      const candidatePolygon = buildCollisionPolygon(candidate);
      return others.some((other) => {
        const otherPolygon = buildCollisionPolygon(other);
        return polygonsIntersect(candidatePolygon, otherPolygon);
      });
    };

    const acceptedInserts: SymmetryInsertSlot[] = [];
    let skippedDuplicateCount = 0;
    let skippedCollisionCount = 0;

    inserts.forEach((insertSlot) => {
      const isDuplicate =
        slots.some((existing) => isSameGeometry(insertSlot, existing)) ||
        acceptedInserts.some((existing) => isSameGeometry(insertSlot, existing));

      if (isDuplicate) {
        skippedDuplicateCount += 1;
        return;
      }

      if (hasSpacingCollision(insertSlot, [...slots, ...acceptedInserts])) {
        skippedCollisionCount += 1;
        return;
      }

      acceptedInserts.push(insertSlot);
    });

    if (acceptedInserts.length === 0) {
      toast("info", "镜像复制没有生成新的有效槽位。");
      return;
    }

    onInsertSlots(acceptedInserts);

    if (skippedDuplicateCount > 0 || skippedCollisionCount > 0) {
      const parts = [];
      if (skippedDuplicateCount > 0) {
        parts.push(`${skippedDuplicateCount} 个副本与现有槽位重合`);
      }
      if (skippedCollisionCount > 0) {
        parts.push(`${skippedCollisionCount} 个副本会产生间距冲突`);
      }
      toast("info", `镜像复制已自动跳过：${parts.join("，")}。`);
    }

    const outOfBoundsCount = countOutOfBoundsSlots(
      acceptedInserts,
      trayWidth,
      trayDepth,
    );

    if (outOfBoundsCount > 0) {
      toast(
        "info",
        `镜像副本中有 ${outOfBoundsCount} 个槽位超出托盘边界，请继续调整。`,
      );
    }
  };

  // ── UI ──────────

  const btnClass = "h-8 px-2 lg:px-2.5 hover:bg-neutral-700/50 rounded text-neutral-300 hover:text-white transition-colors cursor-pointer group relative disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-300 shrink-0 inline-flex items-center gap-1";
  const tooltipClass = "absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50 hidden lg:block";

  const axisBtnClass = "h-7 px-2 rounded text-[10px] text-neutral-300 transition-colors border border-neutral-700 hover:border-neutral-500 hover:text-white";

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

      <div className="flex items-center gap-1 mr-1 lg:mr-2 pr-1 lg:pr-2 border-r border-neutral-700 shrink-0">
        <button
          className={`${axisBtnClass} ${axisSource === 'selection' ? 'bg-neutral-700 text-white border-neutral-500' : ''}`}
          onClick={() => setAxisSource('selection')}
          disabled={!hasSelection}
        >
          选区轴
        </button>
        <button
          className={`${axisBtnClass} ${axisSource === 'tray' ? 'bg-neutral-700 text-white border-neutral-500' : ''}`}
          onClick={() => setAxisSource('tray')}
        >
          托盘轴
        </button>
      </div>

      <div className="flex items-center gap-0.5 mr-1 lg:mr-2 pr-1 lg:pr-2 border-r border-neutral-700 shrink-0">
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleMirrorMove('mirror-x')}>
          <FlipHorizontal size={16} />
          <span className="hidden lg:inline text-[10px]">左右镜</span>
          <span className={tooltipClass}>围绕当前轴做左右镜像移动</span>
        </button>
        <button className={btnClass} disabled={!hasSelection || !onInsertSlots} onClick={() => handleMirrorCopy('mirror-x')}>
          <Copy size={16} />
          <span className="hidden lg:inline text-[10px]">左右复</span>
          <span className={tooltipClass}>围绕当前轴复制一组左右镜像槽位</span>
        </button>
        <button className={btnClass} disabled={!hasSelection} onClick={() => handleMirrorMove('mirror-y')}>
          <FlipVertical size={16} />
          <span className="hidden lg:inline text-[10px]">上下镜</span>
          <span className={tooltipClass}>围绕当前轴做上下镜像移动</span>
        </button>
        <button className={btnClass} disabled={!hasSelection || !onInsertSlots} onClick={() => handleMirrorCopy('mirror-y')}>
          <Copy size={16} />
          <span className="hidden lg:inline text-[10px]">上下复</span>
          <span className={tooltipClass}>围绕当前轴复制一组上下镜像槽位</span>
        </button>
      </div>

      <div className="ml-1 lg:ml-2 text-[10px] lg:text-xs text-neutral-500 font-mono shrink-0">
        {selectedIds.size > 0 ? `${selectedIds.size} 选中` : '未选择'}
      </div>
    </div>
  );
}
