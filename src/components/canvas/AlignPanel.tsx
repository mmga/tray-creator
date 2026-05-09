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

const STEP = 0.2;
const roundToStep = (value: number) => Math.round(value / STEP) * STEP;

type AlignType = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";
type ArrangeType = "row" | "column";
type SlotUpdate = { id: string; x: number; y: number; rotation?: number };

interface AlignPanelProps {
  selectedSlots: Array<FreeSlot | SteppedSlot>;
  onUpdateSlots: (updates: SlotUpdate[]) => void;
  spacing: number;
  ellipseProfileExponent?: number;
}

function getSlotBounds(
  slot: Pick<
    FreeSlot,
    "width" | "height" | "rotation" | "shape" | "outerOffset" | "profileExponent"
  >,
  ellipseProfileExponent?: number,
) {
  return getEllipseBoundingBox(
    slot.width,
    slot.height,
    slot.rotation,
    slot.shape,
    slot.profileExponent ?? ellipseProfileExponent,
    slot.outerOffset,
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

export default function AlignPanel({
  selectedSlots,
  onUpdateSlots,
  spacing,
  ellipseProfileExponent,
}: AlignPanelProps) {
  const hasMultiple = selectedSlots.length > 1;
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
          <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("left")}>
            <AlignLeft size={15} /> 左
          </button>
          <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("center-x")}>
            <AlignCenterHorizontal size={15} /> 中
          </button>
          <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("right")}>
            <AlignRight size={15} /> 右
          </button>
          <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("top")}>
            <AlignStartVertical size={15} /> 上
          </button>
          <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("center-y")}>
            <AlignCenterVertical size={15} /> 中
          </button>
          <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("bottom")}>
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
          <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleArrange("row")}>
            <Rows2 size={15} /> 一排
          </button>
          <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleArrange("column")}>
            <Columns2 size={15} /> 一列
          </button>
        </div>
        <div className="mt-3 rounded-sm border border-[#312a21] bg-[#14110d] px-3 py-2 text-[10px] text-muted-foreground/70">
          排布间距自动使用当前槽距 {spacing} mm。
        </div>
      </section>
    </div>
  );
}
