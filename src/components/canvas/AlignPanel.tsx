import type { FreeSlot, SteppedSlot } from "@/types/custom-tray";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  Columns2,
  Rows2,
} from "lucide-react";
import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import {
  isCustomSlotWithinFixedTrayUsableArea,
  type FixedCustomTrayUsableArea,
} from "@/lib/custom-layout-math";
import type { CanvasCollisionSpacingOptions } from "@/lib/canvas-collision-model";

const STEP = 0.2;
const roundToStep = (value: number) => Math.round(value / STEP) * STEP;

type AlignType = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";
type ArrangeType = "row" | "column";
type SlotUpdate = { id: string; x: number; y: number; rotation?: number };
type PairSpacing = CanvasCollisionSpacingOptions<FreeSlot>["getPairSpacing"];

interface AlignPanelProps {
  selectedSlots: Array<FreeSlot | SteppedSlot>;
  onUpdateSlots: (updates: SlotUpdate[]) => void;
  spacing: number;
  distributionArea?: FixedCustomTrayUsableArea;
  getPairSpacing?: PairSpacing;
  ellipseProfileExponent?: number;
}

function getSlotBounds(
  slot: Pick<
    FreeSlot,
    | "width"
    | "height"
    | "slotWidth"
    | "slotHeight"
    | "rotation"
    | "shape"
    | "outerOffset"
    | "profileExponent"
  >,
  ellipseProfileExponent?: number,
) {
  const profile = getFreeSlotProfileGeometry(slot);
  return getEllipseBoundingBox(
    profile.width,
    profile.height,
    slot.rotation,
    slot.shape,
    profile.profileExponent ?? ellipseProfileExponent,
    profile.outerOffset,
  );
}

function getSelectionBounds(
  selectedSlots: Array<FreeSlot | SteppedSlot>,
  ellipseProfileExponent?: number,
) {
  if (selectedSlots.length === 0) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  selectedSlots.forEach((slot) => {
    const { halfW, halfH } = getSlotBounds(slot, ellipseProfileExponent);
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  });

  return { minX, maxX, minY, maxY };
}

function getSelectionCenter(
  selectedSlots: Array<FreeSlot | SteppedSlot>,
  ellipseProfileExponent?: number,
) {
  const bounds = getSelectionBounds(selectedSlots, ellipseProfileExponent);
  if (!bounds) {
    return null;
  }

  return {
    cx: (bounds.minX + bounds.maxX) / 2,
    cy: (bounds.minY + bounds.maxY) / 2,
  };
}

function getDistributionUpdates(
  axis: "x" | "y",
  slots: FreeSlot[],
  area: FixedCustomTrayUsableArea | undefined,
  spacing: number,
  getPairSpacing: PairSpacing,
  ellipseProfileExponent?: number,
): SlotUpdate[] | null {
  if (!area || slots.length < 2) return null;
  const horizontal = axis === "x";
  const span = horizontal ? area.width : area.depth;
  const sorted = [...slots].sort((left, right) => left[axis] - right[axis]);
  const halfSpans = sorted.map((slot) => {
    const { halfW, halfH } = getSlotBounds(slot, ellipseProfileExponent);
    return horizontal ? halfW : halfH;
  });
  const remaining = span - halfSpans.reduce((sum, half) => sum + half * 2, 0);
  let minimumGap = spacing;
  for (let index = 1; index < sorted.length; index += 1) {
    minimumGap = Math.max(minimumGap, getPairSpacing?.(sorted[index - 1], sorted[index], spacing) ?? spacing);
  }
  if (!Number.isFinite(remaining) || remaining < minimumGap * (sorted.length - 1) - 1e-6) {
    return null;
  }

  const gap = Math.max(minimumGap, remaining / (sorted.length + 1));
  const inset = Math.max(0, (remaining - gap * (sorted.length - 1)) / 2);
  let cursor = area[axis] + inset;
  const updates = sorted.map((slot, index) => {
    const half = halfSpans[index];
    const next = { id: slot.id, x: slot.x, y: slot.y, [axis]: cursor + half };
    cursor += half * 2 + gap;
    return next;
  });
  return updates.every((update, index) =>
    isCustomSlotWithinFixedTrayUsableArea({ ...sorted[index], ...update }, area),
  ) ? updates : null;
}

export default function AlignPanel({
  selectedSlots,
  onUpdateSlots,
  spacing,
  distributionArea,
  getPairSpacing,
  ellipseProfileExponent,
}: AlignPanelProps) {
  const hasMultiple = selectedSlots.length > 1;
  const horizontalDistribution = getDistributionUpdates("x", selectedSlots, distributionArea, spacing, getPairSpacing, ellipseProfileExponent);
  const verticalDistribution = getDistributionUpdates("y", selectedSlots, distributionArea, spacing, getPairSpacing, ellipseProfileExponent);
  const actionBtnClass = "flex h-9 items-center justify-center gap-1.5 rounded-sm border border-[#3a352c] bg-[#1a1813] px-3 text-xs text-[#d8d1c5] transition-colors hover:border-[#5d5547] hover:bg-[#252119] hover:text-white disabled:cursor-not-allowed disabled:opacity-35";

  const handleAlign = (type: AlignType) => {
    if (selectedSlots.length < 2) {
      return;
    }

    const bounds = getSelectionBounds(selectedSlots, ellipseProfileExponent);
    if (!bounds) {
      return;
    }

    const { minX, maxX, minY, maxY } = bounds;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const updates: SlotUpdate[] = [];

    switch (type) {
      case "left":
        selectedSlots.forEach((slot) => {
          const { halfW } = getSlotBounds(slot, ellipseProfileExponent);
          updates.push({ id: slot.id, x: roundToStep(minX + halfW), y: slot.y });
        });
        break;
      case "center-x":
        selectedSlots.forEach((slot) => {
          updates.push({ id: slot.id, x: roundToStep(centerX), y: slot.y });
        });
        break;
      case "right":
        selectedSlots.forEach((slot) => {
          const { halfW } = getSlotBounds(slot, ellipseProfileExponent);
          updates.push({ id: slot.id, x: roundToStep(maxX - halfW), y: slot.y });
        });
        break;
      case "top":
        selectedSlots.forEach((slot) => {
          const { halfH } = getSlotBounds(slot, ellipseProfileExponent);
          updates.push({ id: slot.id, x: slot.x, y: roundToStep(maxY - halfH) });
        });
        break;
      case "center-y":
        selectedSlots.forEach((slot) => {
          updates.push({ id: slot.id, x: slot.x, y: roundToStep(centerY) });
        });
        break;
      case "bottom":
        selectedSlots.forEach((slot) => {
          const { halfH } = getSlotBounds(slot, ellipseProfileExponent);
          updates.push({ id: slot.id, x: slot.x, y: roundToStep(minY + halfH) });
        });
        break;
    }

    if (updates.length > 0) {
      onUpdateSlots(updates);
    }
  };

  const handleArrange = (type: ArrangeType) => {
    if (selectedSlots.length < 2) {
      return;
    }

    const center = getSelectionCenter(selectedSlots, ellipseProfileExponent);
    if (!center) {
      return;
    }

    const updates: SlotUpdate[] = [];

    if (type === "row") {
      const sorted = [...selectedSlots].sort((left, right) => left.x - right.x);
      const totalWidth = sorted.reduce(
        (sum, slot) =>
          sum + getSlotBounds(slot, ellipseProfileExponent).halfW * 2,
        0,
      );
      const totalGap = spacing * (sorted.length - 1);
      const totalSpan = totalWidth + totalGap;

      let cursor = center.cx - totalSpan / 2;
      sorted.forEach((slot) => {
        const { halfW } = getSlotBounds(slot, ellipseProfileExponent);
        const nextX = cursor + halfW;
        updates.push({ id: slot.id, x: roundToStep(nextX), y: roundToStep(center.cy) });
        cursor += halfW * 2 + spacing;
      });
    } else {
      const sorted = [...selectedSlots].sort((left, right) => left.y - right.y);
      const totalHeight = sorted.reduce(
        (sum, slot) =>
          sum + getSlotBounds(slot, ellipseProfileExponent).halfH * 2,
        0,
      );
      const totalGap = spacing * (sorted.length - 1);
      const totalSpan = totalHeight + totalGap;

      let cursor = center.cy - totalSpan / 2;
      sorted.forEach((slot) => {
        const { halfH } = getSlotBounds(slot, ellipseProfileExponent);
        const nextY = cursor + halfH;
        updates.push({ id: slot.id, x: roundToStep(center.cx), y: roundToStep(nextY) });
        cursor += halfH * 2 + spacing;
      });
    }

    if (updates.length > 0) {
      onUpdateSlots(updates);
    }
  };

  return (
    <div className="space-y-4">
      <section className="border border-[#312a21] bg-[#17130f] p-3">
        <div className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6c6a5]">边缘对齐</div>
          <div className="mt-1 text-[10px] text-muted-foreground/70">按所选凹槽的外接边界快速归整。</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" aria-label="左对齐" className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("left")}>
            <AlignLeft size={15} /> 左
          </button>
          <button type="button" aria-label="水平居中对齐" className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("center-x")}>
            <AlignCenterHorizontal size={15} /> 中
          </button>
          <button type="button" aria-label="右对齐" className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("right")}>
            <AlignRight size={15} /> 右
          </button>
          <button type="button" aria-label="顶部对齐" className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("top")}>
            <AlignStartVertical size={15} /> 上
          </button>
          <button type="button" aria-label="垂直居中对齐" className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("center-y")}>
            <AlignCenterVertical size={15} /> 中
          </button>
          <button type="button" aria-label="底部对齐" className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("bottom")}>
            <AlignEndVertical size={15} /> 下
          </button>
        </div>
      </section>

      <section className="border border-[#312a21] bg-[#17130f] p-3">
        <div className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6c6a5]">自动排布</div>
          <div className="mt-1 text-[10px] text-muted-foreground/70">保持当前选区中心，按槽距重新铺开。</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-label="排成一排" className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleArrange("row")}>
            <Rows2 size={15} /> 一排
          </button>
          <button type="button" aria-label="排成一列" className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleArrange("column")}>
            <Columns2 size={15} /> 一列
          </button>
        </div>
        <div className="mt-3 rounded-sm border border-[#312a21] bg-[#14110d] px-3 py-2 text-[10px] text-muted-foreground/70">
          排布间距自动使用当前槽距 {spacing} mm。
        </div>
      </section>

      {distributionArea && (
        <section className="border border-[#312a21] bg-[#17130f] p-3">
          <div className="mb-3">
            <div className="text-[11px] font-semibold text-[#d6c6a5]">容器内均匀分布</div>
            <div className="mt-1 text-[10px] text-muted-foreground/70">按槽的外缘分配留白，保留另一方向的位置。</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-label="容器内水平均布" className={actionBtnClass}
              disabled={!horizontalDistribution} onClick={() => horizontalDistribution && onUpdateSlots(horizontalDistribution)}>
              <Columns2 size={15} /> 水平均布
            </button>
            <button type="button" aria-label="容器内竖直均布" className={actionBtnClass}
              disabled={!verticalDistribution} onClick={() => verticalDistribution && onUpdateSlots(verticalDistribution)}>
              <Rows2 size={15} /> 竖直均布
            </button>
          </div>
          {hasMultiple && (!horizontalDistribution || !verticalDistribution) && (
            <p className="mt-2 text-[10px] text-muted-foreground/70">空间或边距不足的方向不可用。</p>
          )}
        </section>
      )}
    </div>
  );
}
