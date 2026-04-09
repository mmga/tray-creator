import { getSlotTolerance } from "@/lib/config";
import {
  calculateSteppedEffectiveDimensions,
  getSteppedSlotBoundingHalfSize,
  type SteppedLayoutExtents,
} from "@/lib/stepped-layout-math";
import type { IdFactory } from "@/lib/model-ports";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";

export interface SteppedSlotUpdate {
  id: string;
  x: number;
  y: number;
  rotation?: number;
}

export function updateSteppedLayoutParam<K extends keyof SteppedLayoutParams>(
  params: SteppedLayoutParams,
  key: K,
  value: SteppedLayoutParams[K],
): SteppedLayoutParams {
  if (key === "spacing") {
    return {
      ...params,
      spacing: value as SteppedLayoutParams["spacing"],
    };
  }

  return {
    ...params,
    [key]: value,
  };
}

export function addSteppedSlot(
  params: SteppedLayoutParams,
  idFactory: IdFactory,
  width: number,
): SteppedLayoutParams {
  const newSlotHalfW = (width + getSlotTolerance(width)) / 2;

  let nextX = params.trayWidth / 2;
  let nextY = params.trayDepth / 2;

  if (params.slots.length > 0) {
    const lastSlot = params.slots[params.slots.length - 1];
    const lastHalf = getSteppedSlotBoundingHalfSize(lastSlot);
    nextX = lastSlot.x + lastHalf.halfW + params.spacing + newSlotHalfW;
    nextY = lastSlot.y;
  }

  const newSlot: SteppedSlot = {
    id: idFactory.createId(),
    x: nextX,
    y: nextY,
    shape: "circle",
    width,
    height: width,
    rotation: 0,
    groupId: params.activeGroupId,
  };

  return {
    ...params,
    slots: [...params.slots, newSlot],
  };
}

export function removeSteppedSlot(
  params: SteppedLayoutParams,
  id: string,
): SteppedLayoutParams {
  return {
    ...params,
    slots: params.slots.filter((slot) => slot.id !== id),
  };
}

export function updateSteppedSlotPosition(
  params: SteppedLayoutParams,
  id: string,
  x: number,
  y: number,
): SteppedLayoutParams {
  return {
    ...params,
    slots: params.slots.map((slot) =>
      slot.id === id ? { ...slot, x, y } : slot,
    ),
  };
}

export function applySteppedSlotUpdates(
  params: SteppedLayoutParams,
  updates: SteppedSlotUpdate[],
): SteppedLayoutParams {
  const updatesMap = new Map(updates.map((update) => [update.id, update]));
  return {
    ...params,
    slots: params.slots.map((slot) => {
      const update = updatesMap.get(slot.id);
      return update
        ? {
            ...slot,
            x: update.x,
            y: update.y,
            rotation: update.rotation ?? slot.rotation,
          }
        : slot;
    }),
  };
}

export function updateSteppedSlotRotation(
  params: SteppedLayoutParams,
  id: string,
  rotation: number,
): SteppedLayoutParams {
  return {
    ...params,
    slots: params.slots.map((slot) =>
      slot.id === id ? { ...slot, rotation } : slot,
    ),
  };
}

export function insertSteppedSlots(
  params: SteppedLayoutParams,
  idFactory: IdFactory,
  slotsToInsert: SymmetryInsertSlot[],
): SteppedLayoutParams {
  if (slotsToInsert.length === 0) {
    return params;
  }

  const newSlots: SteppedSlot[] = slotsToInsert.map((slot) => ({
    id: idFactory.createId(),
    x: slot.x,
    y: slot.y,
    shape: slot.shape,
    width: slot.width,
    height: slot.height,
    rotation: slot.rotation,
    groupId: slot.groupId ?? params.activeGroupId,
  }));

  return {
    ...params,
    slots: [...params.slots, ...newSlots],
  };
}

export function duplicateSteppedSlots(
  params: SteppedLayoutParams,
  idFactory: IdFactory,
  ids: string[],
): { params: SteppedLayoutParams; newIds: string[] } {
  const newIds = ids.map(() => idFactory.createId());
  const newSlots = [...params.slots];

  ids.forEach((id, index) => {
    const slotToCopy = params.slots.find((slot) => slot.id === id);
    if (!slotToCopy) {
      return;
    }

    newSlots.push({
      ...slotToCopy,
      id: newIds[index],
      x: slotToCopy.x + 10,
      y: slotToCopy.y - 10,
    });
  });

  return {
    params: {
      ...params,
      slots: newSlots,
    },
    newIds,
  };
}

export function trimSteppedBaseplate(
  params: SteppedLayoutParams,
  effectiveDimensions: SteppedLayoutExtents = calculateSteppedEffectiveDimensions(
    params,
  ),
): SteppedLayoutParams {
  if (
    params.slots.length === 0 ||
    effectiveDimensions.width <= 0 ||
    effectiveDimensions.depth <= 0
  ) {
    return params;
  }

  const newTrayWidth = effectiveDimensions.width;
  const newTrayDepth = effectiveDimensions.depth;
  const oldCx = (effectiveDimensions.minX + effectiveDimensions.maxX) / 2;
  const oldCy = (effectiveDimensions.minY + effectiveDimensions.maxY) / 2;
  const newCx = newTrayWidth / 2;
  const newCy = newTrayDepth / 2;
  const dx = newCx - oldCx;
  const dy = newCy - oldCy;

  return {
    ...params,
    trayWidth: newTrayWidth,
    trayDepth: newTrayDepth,
    slots: params.slots.map((slot) => ({
      ...slot,
      x: slot.x + dx,
      y: slot.y + dy,
    })),
  };
}
