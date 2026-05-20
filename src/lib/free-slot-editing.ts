import type { IdFactory } from "@/lib/model-ports";

export interface EditableFreeSlot {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

export interface FreeSlotParams<S extends EditableFreeSlot> {
  trayWidth: number;
  trayDepth: number;
  slots: S[];
}

export interface FreeSlotUpdate {
  id: string;
  x: number;
  y: number;
  rotation?: number;
}

export interface FreeSlotLayoutExtents {
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function removeFreeSlot<
  S extends EditableFreeSlot,
  P extends FreeSlotParams<S>,
>(params: P, id: string): P {
  return {
    ...params,
    slots: params.slots.filter((slot) => slot.id !== id),
  };
}

export function updateFreeSlotPosition<
  S extends EditableFreeSlot,
  P extends FreeSlotParams<S>,
>(params: P, id: string, x: number, y: number): P {
  return {
    ...params,
    slots: params.slots.map((slot) =>
      slot.id === id ? { ...slot, x, y } : slot,
    ),
  };
}

export function applyFreeSlotUpdates<
  S extends EditableFreeSlot,
  P extends FreeSlotParams<S>,
>(params: P, updates: FreeSlotUpdate[]): P {
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

export function updateFreeSlotRotation<
  S extends EditableFreeSlot,
  P extends FreeSlotParams<S>,
>(params: P, id: string, rotation: number): P {
  return {
    ...params,
    slots: params.slots.map((slot) =>
      slot.id === id ? { ...slot, rotation } : slot,
    ),
  };
}

export function insertFreeSlots<
  S extends EditableFreeSlot,
  P extends FreeSlotParams<S>,
  SourceSlot,
>(
  params: P,
  idFactory: IdFactory,
  slotsToInsert: SourceSlot[],
  createSlot: (source: SourceSlot, id: string) => S,
): P {
  if (slotsToInsert.length === 0) {
    return params;
  }

  const newSlots = slotsToInsert.map((slot) =>
    createSlot(slot, idFactory.createId()),
  );

  return {
    ...params,
    slots: [...params.slots, ...newSlots],
  };
}

export function duplicateFreeSlots<
  S extends EditableFreeSlot,
  P extends FreeSlotParams<S>,
>(
  params: P,
  idFactory: IdFactory,
  ids: string[],
): { params: P; newIds: string[] } {
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

export function trimFreeSlotBaseplate<
  S extends EditableFreeSlot,
  P extends FreeSlotParams<S>,
>(params: P, effectiveDimensions: FreeSlotLayoutExtents): P {
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
