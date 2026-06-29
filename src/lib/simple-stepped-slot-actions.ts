/**
 * 简易阶梯式布局的槽位操作纯函数。
 *
 * 仿 stepped-layout-slot-actions.ts 模式，从 useSimpleSteppedLayout hook
 * 提取。核心是 applySimpleSteppedSlotUpdates——它合并了原先在 hook 里
 * updateSlotPosition / updateMultipleSlots / updateMultipleSlotsLive
 * 三处逐字复制的同一 clamp+map+组装 逻辑。
 */
import type {
  SimpleSteppedLayoutParams,
  SimpleSteppedSlot,
} from "@/types/custom-tray";
import type { CanvasSlotUpdate } from "@/lib/canvas-types";
import { createSimpleSteppedSlotInstance } from "@/lib/slot-instance-factory";
import {
  calculateSimpleSteppedMinimumTraySize,
  clampSimpleSteppedSlotUpdates,
  getSimpleSteppedEffectiveDiameter,
  mapSimpleSteppedCanvasUpdatesToLocal,
} from "@/lib/simple-stepped-projection";

export function addSimpleSteppedSlotToRow(
  params: SimpleSteppedLayoutParams,
  slotId: string,
  rowId: string,
  diameter: number,
): SimpleSteppedLayoutParams {
  const rowExists = params.rows.some((row) => row.id === rowId);
  if (!rowExists) {
    return params;
  }

  const rowSlots = params.slots.filter((slot) => slot.rowId === rowId);
  const effectiveDiameter = getSimpleSteppedEffectiveDiameter({ diameter });
  const x =
    rowSlots.length === 0
      ? 0
      : Math.max(
          ...rowSlots.map(
            (slot) => slot.x + getSimpleSteppedEffectiveDiameter(slot) / 2,
          ),
        ) +
        params.spacing +
        effectiveDiameter / 2;

  const newSlot = createSimpleSteppedSlotInstance({
    id: slotId,
    rowId,
    diameter,
    x,
  });

  return { ...params, slots: [...params.slots, newSlot] };
}

export function removeSimpleSteppedSlot(
  params: SimpleSteppedLayoutParams,
  id: string,
): SimpleSteppedLayoutParams {
  return {
    ...params,
    slots: params.slots.filter((slot) => slot.id !== id),
  };
}

/**
 * 应用 canvas 槽位更新到 simple-stepped params。
 *
 * 这是 updateSlotPosition / updateMultipleSlots / updateMultipleSlotsLive
 * 三处逐字复制逻辑的单一来源：
 * 1. 把 canvas 坐标更新映射到行局部坐标
 * 2. 按 build size clamp
 * 3. 组装到 slots 数组
 */
export function applySimpleSteppedSlotUpdates(
  params: SimpleSteppedLayoutParams,
  updates: CanvasSlotUpdate[],
): SimpleSteppedLayoutParams {
  const localUpdates = clampSimpleSteppedSlotUpdates(
    params,
    mapSimpleSteppedCanvasUpdatesToLocal(params, updates),
  );
  const updatesMap = new Map(
    localUpdates.map((update) => [update.id, update] as const),
  );

  return {
    ...params,
    slots: params.slots.map((slot) =>
      updatesMap.has(slot.id)
        ? {
            ...slot,
            x: updatesMap.get(slot.id)?.x ?? slot.x,
            y: updatesMap.get(slot.id)?.y ?? slot.y,
          }
        : slot,
    ),
  };
}

export function duplicateSimpleSteppedSlots(
  params: SimpleSteppedLayoutParams,
  slotIds: string[],
  newIds: string[],
): SimpleSteppedLayoutParams {
  const idSet = new Set(slotIds);
  const targets = params.slots.filter((slot) => idSet.has(slot.id));
  if (targets.length === 0) {
    return params;
  }

  const nextSlots = [...params.slots];
  targets.forEach((slot, index) => {
    nextSlots.push({
      ...slot,
      id: newIds[index],
      x: slot.x + getSimpleSteppedEffectiveDiameter(slot) + params.spacing,
    });
  });

  return { ...params, slots: nextSlots };
}

export function trimSimpleSteppedBaseplate(
  params: SimpleSteppedLayoutParams,
): SimpleSteppedLayoutParams {
  const minimumDims = calculateSimpleSteppedMinimumTraySize(params);
  if (minimumDims.width <= 0 || minimumDims.depth <= 0) {
    return params;
  }
  if (
    Math.abs(params.trayWidth - minimumDims.width) < 0.001 &&
    Math.abs(params.trayDepth - minimumDims.depth) < 0.001
  ) {
    return params;
  }

  return {
    ...params,
    trayWidth: minimumDims.width,
    trayDepth: minimumDims.depth,
  };
}

export type { SimpleSteppedSlot };
