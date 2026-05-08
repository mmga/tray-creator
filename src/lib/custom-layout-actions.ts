import { getSlotOuterOffset } from "@/lib/config";
import type { LayoutExtents } from "@/lib/custom-layout-math";
import type { IdFactory } from "@/lib/model-ports";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";

export interface CustomSlotUpdate {
  id: string;
  x: number;
  y: number;
  rotation?: number;
}

export function updateCustomLayoutParam<K extends keyof CustomLayoutParams>(
  params: CustomLayoutParams,
  key: K,
  value: CustomLayoutParams[K],
): CustomLayoutParams {
  if (key === "spacing") {
    const nextSpacing = value as CustomLayoutParams["spacing"];
    if (!params.boundarySpacingIndependent) {
      return {
        ...params,
        spacing: nextSpacing,
        boundarySpacing: nextSpacing,
      };
    }

    return { ...params, spacing: nextSpacing };
  }

  if (key === "boundarySpacingIndependent") {
    const independent =
      value as CustomLayoutParams["boundarySpacingIndependent"];
    if (!independent) {
      return {
        ...params,
        boundarySpacingIndependent: false,
        boundarySpacing: params.spacing,
      };
    }

    return {
      ...params,
      boundarySpacingIndependent: true,
      boundarySpacing: params.boundarySpacing ?? params.spacing,
    };
  }

  return {
    ...params,
    [key]: value,
  };
}

export function addCustomSlot(
  params: CustomLayoutParams,
  idFactory: IdFactory,
  width: number,
  height?: number,
): CustomLayoutParams {
  const isCircle = !height || width === height;
  const shape = isCircle ? "circle" : "ellipse";
  const slotHeight = height || width;
  const newSlotHalfW =
    width / 2 + getSlotOuterOffset(width, slotHeight, shape);

  let nextX = params.trayWidth / 2;
  let nextY = params.trayDepth / 2;

  if (params.slots.length > 0) {
    const lastSlot = params.slots[params.slots.length - 1];
    const rad = (lastSlot.rotation * Math.PI) / 180;
    const a = lastSlot.width / 2;
    const b = lastSlot.height / 2;
    const offset = getSlotOuterOffset(
      lastSlot.width,
      lastSlot.height,
      lastSlot.shape,
    );
    const lastHalfW = Math.sqrt(
      Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2),
    ) + offset;
    nextX = lastSlot.x + lastHalfW + params.spacing + newSlotHalfW;
    nextY = lastSlot.y;
  }

  const newSlot: FreeSlot = {
    id: idFactory.createId(),
    x: nextX,
    y: nextY,
    shape,
    width,
    height: slotHeight,
    rotation: 0,
  };

  return {
    ...params,
    slots: [...params.slots, newSlot],
  };
}

export function removeCustomSlot(
  params: CustomLayoutParams,
  id: string,
): CustomLayoutParams {
  return {
    ...params,
    slots: params.slots.filter((slot) => slot.id !== id),
  };
}

export function updateCustomSlotPosition(
  params: CustomLayoutParams,
  id: string,
  x: number,
  y: number,
): CustomLayoutParams {
  return {
    ...params,
    slots: params.slots.map((slot) =>
      slot.id === id ? { ...slot, x, y } : slot,
    ),
  };
}

export function applyCustomSlotUpdates(
  params: CustomLayoutParams,
  updates: CustomSlotUpdate[],
): CustomLayoutParams {
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

export function updateCustomSlotRotation(
  params: CustomLayoutParams,
  id: string,
  rotation: number,
): CustomLayoutParams {
  return {
    ...params,
    slots: params.slots.map((slot) =>
      slot.id === id ? { ...slot, rotation } : slot,
    ),
  };
}

export function insertCustomSlots(
  params: CustomLayoutParams,
  idFactory: IdFactory,
  slotsToInsert: SymmetryInsertSlot[],
): CustomLayoutParams {
  if (slotsToInsert.length === 0) {
    return params;
  }

  const newSlots: FreeSlot[] = slotsToInsert.map((slot) => ({
    id: idFactory.createId(),
    x: slot.x,
    y: slot.y,
    shape: slot.shape,
    width: slot.width,
    height: slot.height,
    rotation: slot.rotation,
  }));

  return {
    ...params,
    slots: [...params.slots, ...newSlots],
  };
}

export function duplicateCustomSlots(
  params: CustomLayoutParams,
  idFactory: IdFactory,
  ids: string[],
): { params: CustomLayoutParams; newIds: string[] } {
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

export function trimCustomBaseplate(
  params: CustomLayoutParams,
  effectiveDimensions: LayoutExtents,
): CustomLayoutParams {
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
