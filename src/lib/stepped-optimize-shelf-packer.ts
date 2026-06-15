/**
 * 阶梯式布局优化的行装箱引擎。
 *
 * 从 stepped-global-optimize.ts 提取，负责把槽位序列按目标宽度装箱成行，
 * 并在行内做对称排列（左右配平）。
 */
import type { SteppedSlot } from "@/types/custom-tray";
import {
  getSlotGeometry,
  roundPosition,
  type SlotGeometry,
} from "@/lib/stepped-optimize-slot-geometry";

export interface RowSlotEntry {
  slot: SteppedSlot;
  geometry: SlotGeometry;
  effectiveWidth: number;
  effectiveHeight: number;
}

export interface RowLayout {
  entries: RowSlotEntry[];
  width: number;
  height: number;
  symmetryPenalty: number;
}

export interface PackedLayout {
  slots: SteppedSlot[];
  symmetryPenalty: number;
  rowCount: number;
}

function toRowSlotEntry(slot: SteppedSlot, spacing: number): RowSlotEntry {
  const geometry = getSlotGeometry(slot, spacing);

  return {
    slot,
    geometry,
    effectiveWidth: geometry.effectiveHalfW * 2,
    effectiveHeight: geometry.effectiveHalfH * 2,
  };
}

/** 在行内对称排列：把条目左右配平分布，中心条目居中 */
export function arrangeRowSymmetrically(entries: RowSlotEntry[]): RowLayout {
  if (entries.length === 0) {
    return {
      entries: [],
      width: 0,
      height: 0,
      symmetryPenalty: 0,
    };
  }

  const ordered = [...entries];
  const hasCenterEntry = ordered.length % 2 === 1;
  const centerEntry = hasCenterEntry ? ordered.shift() ?? null : null;
  const leftEntries: RowSlotEntry[] = [];
  const rightEntries: RowSlotEntry[] = [];
  let leftWidth = 0;
  let rightWidth = 0;
  let pairMismatchPenalty = 0;

  for (let index = 0; index < ordered.length; index += 2) {
    const first = ordered[index];
    const second = ordered[index + 1];

    if (!first) {
      continue;
    }

    if (!second) {
      if (leftWidth <= rightWidth) {
        leftEntries.push(first);
        leftWidth += first.effectiveWidth;
      } else {
        rightEntries.push(first);
        rightWidth += first.effectiveWidth;
      }
      continue;
    }

    if (leftWidth <= rightWidth) {
      leftEntries.push(first);
      rightEntries.push(second);
      leftWidth += first.effectiveWidth;
      rightWidth += second.effectiveWidth;
    } else {
      leftEntries.push(second);
      rightEntries.push(first);
      leftWidth += second.effectiveWidth;
      rightWidth += first.effectiveWidth;
    }

    pairMismatchPenalty += Math.abs(first.effectiveWidth - second.effectiveWidth);
  }

  const rowEntries = centerEntry
    ? [...leftEntries].reverse().concat(centerEntry, rightEntries)
    : [...leftEntries].reverse().concat(rightEntries);

  return {
    entries: rowEntries,
    width: entries.reduce((sum, entry) => sum + entry.effectiveWidth, 0),
    height: Math.max(...entries.map((entry) => entry.effectiveHeight)),
    symmetryPenalty: roundPosition(
      Math.abs(leftWidth - rightWidth) + pairMismatchPenalty,
    ),
  };
}

/** 按目标宽度把槽位装箱成多行，每行对称排列并居中 */
export function packSlotsIntoShelves(
  slots: SteppedSlot[],
  spacing: number,
  targetWidth: number,
  startY: number = 0,
): PackedLayout {
  const rows: RowSlotEntry[][] = [];
  let currentRow: RowSlotEntry[] = [];
  let currentWidth = 0;

  slots.forEach((slot) => {
    const entry = toRowSlotEntry(slot, spacing);

    if (
      currentRow.length > 0 &&
      currentWidth + entry.effectiveWidth > targetWidth + 1e-6
    ) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }

    currentRow.push(entry);
    currentWidth += entry.effectiveWidth;
  });

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  const packed: SteppedSlot[] = [];
  let cursorY = startY;
  let symmetryPenalty = 0;

  rows.map(arrangeRowSymmetrically).forEach((row) => {
    let cursorX = (targetWidth - row.width) / 2;
    const rowCenterY = cursorY + row.height / 2;

    row.entries.forEach((entry) => {
      packed.push({
        ...entry.slot,
        x: roundPosition(cursorX + entry.effectiveWidth / 2),
        y: roundPosition(rowCenterY),
      });
      cursorX += entry.effectiveWidth;
    });

    cursorY += row.height;
    symmetryPenalty += row.symmetryPenalty;
  });

  return {
    slots: packed,
    symmetryPenalty: roundPosition(symmetryPenalty),
    rowCount: rows.length,
  };
}
