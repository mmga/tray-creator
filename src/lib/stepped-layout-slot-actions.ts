import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import {
  applyFreeSlotUpdates,
  duplicateFreeSlots,
  insertFreeSlots,
  removeFreeSlot,
  trimFreeSlotBaseplate,
  updateFreeSlotPosition,
  updateFreeSlotRotation,
  type FreeSlotUpdate,
} from "@/lib/free-slot-editing";
import {
  createSteppedSlotInstance,
  type EllipseSlotInstanceConfig,
} from "@/lib/slot-instance-factory";
import {
  getFreeSlotProfileGeometry,
} from "@/lib/slot-definitions";
import {
  calculateSteppedEffectiveDimensions,
  type SteppedLayoutExtents,
} from "@/lib/stepped-layout-math";
import type { IdFactory } from "@/lib/model-ports";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";

export type SteppedSlotUpdate = FreeSlotUpdate;

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
  height?: number,
  ellipseConfig?: EllipseSlotInstanceConfig,
): SteppedLayoutParams {
  const newSlot = createSteppedSlotInstance({
    id: idFactory.createId(),
    x: 0,
    y: 0,
    width,
    height,
    ellipseConfig,
    groupId: params.activeGroupId,
  });
  const newProfile = getFreeSlotProfileGeometry(newSlot);
  const newHalf = getEllipseBoundingBox(
    newProfile.width,
    newProfile.height,
    newSlot.rotation,
    newSlot.shape,
    newProfile.profileExponent,
    newProfile.outerOffset,
  );

  let nextX = params.trayWidth / 2;
  let nextY = params.trayDepth / 2;

  if (params.slots.length > 0) {
    const lastSlot = params.slots[params.slots.length - 1];
    const lastProfile = getFreeSlotProfileGeometry(lastSlot);
    const lastHalf = getEllipseBoundingBox(
      lastProfile.width,
      lastProfile.height,
      lastSlot.rotation,
      lastSlot.shape,
      lastProfile.profileExponent,
      lastProfile.outerOffset,
    );
    nextX = lastSlot.x + lastHalf.halfW + params.spacing + newHalf.halfW;
    nextY = lastSlot.y;
  }

  return {
    ...params,
    slots: [...params.slots, { ...newSlot, x: nextX, y: nextY }],
  };
}

export function removeSteppedSlot(
  params: SteppedLayoutParams,
  id: string,
): SteppedLayoutParams {
  return removeFreeSlot(params, id);
}

export function updateSteppedSlotPosition(
  params: SteppedLayoutParams,
  id: string,
  x: number,
  y: number,
): SteppedLayoutParams {
  return updateFreeSlotPosition(params, id, x, y);
}

export function applySteppedSlotUpdates(
  params: SteppedLayoutParams,
  updates: SteppedSlotUpdate[],
): SteppedLayoutParams {
  return applyFreeSlotUpdates(params, updates);
}

export function updateSteppedSlotRotation(
  params: SteppedLayoutParams,
  id: string,
  rotation: number,
): SteppedLayoutParams {
  return updateFreeSlotRotation(params, id, rotation);
}

export function insertSteppedSlots(
  params: SteppedLayoutParams,
  idFactory: IdFactory,
  slotsToInsert: SymmetryInsertSlot[],
): SteppedLayoutParams {
  return insertFreeSlots<SteppedSlot, SteppedLayoutParams, SymmetryInsertSlot>(
    params,
    idFactory,
    slotsToInsert,
    (slot, id) => ({
      id,
      x: slot.x,
      y: slot.y,
      shape: slot.shape,
      width: slot.width,
      height: slot.height,
      slotDefinitionId: slot.slotDefinitionId,
      slotWidth: slot.slotWidth,
      slotHeight: slot.slotHeight,
      rotation: slot.rotation,
      ...(slot.shape === "ellipse"
        ? {
            outerOffset: slot.outerOffset,
            profileExponent: slot.profileExponent,
          }
        : {}),
      groupId: slot.groupId ?? params.activeGroupId,
    }),
  );
}

export function duplicateSteppedSlots(
  params: SteppedLayoutParams,
  idFactory: IdFactory,
  ids: string[],
): { params: SteppedLayoutParams; newIds: string[] } {
  return duplicateFreeSlots(params, idFactory, ids);
}

export function trimSteppedBaseplate(
  params: SteppedLayoutParams,
  effectiveDimensions: SteppedLayoutExtents = calculateSteppedEffectiveDimensions(
    params,
  ),
): SteppedLayoutParams {
  return trimFreeSlotBaseplate(params, effectiveDimensions);
}
