/**
 * 阶梯式布局优化的槽位几何与排序工具。
 *
 * 从 stepped-global-optimize.ts 提取，提供槽位包围盒计算、坐标量化、
 * 原点归一化、按尺寸排序、交替排序、目标货架宽度估算等纯函数。
 */
import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import { SEARCH_STEP, TARGET_WIDTH_TO_DEPTH_RATIO } from "@/lib/stepped-optimize-config";
import type { SteppedSlot } from "@/types/custom-tray";

export interface SlotGeometry {
  halfW: number;
  halfH: number;
  effectiveHalfW: number;
  effectiveHalfH: number;
}

/** 计算槽位的轴对齐半宽/半高（含 spacing margin） */
export function getSlotGeometry(slot: SteppedSlot, spacing: number): SlotGeometry {
  const profile = getFreeSlotProfileGeometry(slot);
  const margin = spacing / 2 + profile.outerOffset;
  const { halfW, halfH } = getEllipseBoundingBox(
    profile.width,
    profile.height,
    slot.rotation,
    slot.shape,
    profile.profileExponent,
    profile.outerOffset,
  );

  return {
    halfW,
    halfH,
    effectiveHalfW: halfW + margin,
    effectiveHalfH: halfH + margin,
  };
}

/** 按 SEARCH_STEP 量化坐标 */
export function roundToStep(value: number): number {
  return Number((Math.round(value / SEARCH_STEP) * SEARCH_STEP).toFixed(3));
}

/** 坐标保留 3 位小数 */
export function roundPosition(value: number): number {
  return Number(value.toFixed(3));
}

/** 把槽位平移到原点（最小 x/y 对齐到 0） */
export function normalizeSlotsToOrigin(
  slots: SteppedSlot[],
  spacing: number,
): SteppedSlot[] {
  if (slots.length === 0) {
    return slots;
  }

  let minLeft = Infinity;
  let minBottom = Infinity;
  const geometryById = new Map(
    slots.map((slot) => [slot.id, getSlotGeometry(slot, spacing)] as const),
  );

  slots.forEach((slot) => {
    const geometry = geometryById.get(slot.id);
    if (!geometry) {
      return;
    }

    minLeft = Math.min(minLeft, slot.x - geometry.halfW);
    minBottom = Math.min(minBottom, slot.y - geometry.halfH);
  });

  return slots.map((slot) => ({
    ...slot,
    x: roundPosition(slot.x - minLeft),
    y: roundPosition(slot.y - minBottom),
  }));
}

/** 按有效尺寸降序排序（大的在前），尺寸相同时保持原索引序 */
export function sortSlotsByEffectiveSize(
  slots: SteppedSlot[],
  spacing: number,
): SteppedSlot[] {
  const originalIndex = new Map(slots.map((slot, index) => [slot.id, index]));

  return [...slots].sort((left, right) => {
    const leftGeometry = getSlotGeometry(left, spacing);
    const rightGeometry = getSlotGeometry(right, spacing);
    const leftSize = Math.max(leftGeometry.effectiveHalfW, leftGeometry.effectiveHalfH);
    const rightSize = Math.max(
      rightGeometry.effectiveHalfW,
      rightGeometry.effectiveHalfH,
    );

    if (rightSize !== leftSize) {
      return rightSize - leftSize;
    }

    return (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0);
  });
}

/** 交替排序：大-小-次大-次小...（首尾交替取，利于行内对称） */
export function buildAlternatingOrder(slots: SteppedSlot[]): SteppedSlot[] {
  const alternating: SteppedSlot[] = [];
  let leftIndex = 0;
  let rightIndex = slots.length - 1;

  while (leftIndex <= rightIndex) {
    alternating.push(slots[leftIndex]!);
    leftIndex += 1;

    if (leftIndex <= rightIndex) {
      alternating.push(slots[rightIndex]!);
      rightIndex -= 1;
    }
  }

  return alternating;
}

/** 估算目标货架宽度（取最大槽宽与面积推算宽度的较大值） */
export function getTargetShelfWidth(slots: SteppedSlot[], spacing: number): number {
  if (slots.length === 0) {
    return 0;
  }

  let totalArea = 0;
  let maxWidth = 0;

  slots.forEach((slot) => {
    const geometry = getSlotGeometry(slot, spacing);
    const width = geometry.effectiveHalfW * 2;
    const height = geometry.effectiveHalfH * 2;
    totalArea += width * height;
    maxWidth = Math.max(maxWidth, width);
  });

  return roundToStep(
    Math.max(maxWidth, Math.sqrt(totalArea * TARGET_WIDTH_TO_DEPTH_RATIO)),
  );
}
