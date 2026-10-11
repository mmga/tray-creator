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
  createFreeSlotInstance,
  type CircleSlotInstanceConfig,
} from "@/lib/slot-instance-factory";
import {
  getFreeSlotProfileGeometry,
} from "@/lib/slot-definitions";
import type { LayoutExtents } from "@/lib/custom-layout-math";
import {
  calculateCustomBoxRequiredOuterSize,
  calculateCustomEffectiveDimensions,
  resolveCustomFootprintStyle,
} from "@/lib/custom-layout-math";
import { resolveStackableBoxParams } from "@/lib/stackable-box";
import type { IdFactory } from "@/lib/model-ports";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";

export interface EllipseSlotConfig {
  outerOffset?: number;
  profileExponent?: number;
  slotDefinitionId?: string;
}

export type CircleSlotConfig = CircleSlotInstanceConfig;

export type CustomSlotUpdate = FreeSlotUpdate;

export function updateCustomLayoutParam<K extends keyof CustomLayoutParams>(
  params: CustomLayoutParams,
  key: K,
  value: CustomLayoutParams[K],
): CustomLayoutParams {
  if (key === "stackableBox") {
    const currentBox = resolveStackableBoxParams(params.stackableBox);
    const nextBox = resolveStackableBoxParams(
      value as CustomLayoutParams["stackableBox"],
    );
    if (nextBox.enabled && resolveCustomFootprintStyle(params) !== "rectangular") {
      return {
        ...params,
        stackableBox: { ...nextBox, enabled: false },
      };
    }
    if (!currentBox.enabled && nextBox.enabled && params.slots.length > 0) {
      return expandCustomBoxToFit({
        ...params,
        stackableBox: nextBox,
      });
    }
    return { ...params, stackableBox: nextBox };
  }

  if (key === "footprintStyle" && (value === "contoured" || value === "polygonal")) {
    const box = resolveStackableBoxParams(params.stackableBox);
    return {
      ...params,
      footprintStyle: value,
      stackableBox: box.enabled ? { ...box, enabled: false } : box,
    };
  }

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
  ellipseConfig?: EllipseSlotConfig,
  circleConfig?: CircleSlotConfig,
): CustomLayoutParams {
  const isCircle = !height || width === height;
  const shape = isCircle ? "circle" : "ellipse";
  const slotHeight = height || width;
  const box = resolveStackableBoxParams(params.stackableBox);
  const placementWidth = box.enabled ? box.outerWidth : params.trayWidth;
  const placementDepth = box.enabled ? box.outerDepth : params.trayDepth;
  const { halfW: newSlotHalfW } = getEllipseBoundingBox(
    width,
    slotHeight,
    0,
    shape,
    ellipseConfig?.profileExponent,
    ellipseConfig?.outerOffset,
  );

  let nextX = placementWidth / 2;
  let nextY = placementDepth / 2;

  if (params.slots.length > 0) {
    const lastSlot = params.slots[params.slots.length - 1];
    const lastProfile = getFreeSlotProfileGeometry(lastSlot);
    const { halfW: lastHalfW } = getEllipseBoundingBox(
      lastProfile.width,
      lastProfile.height,
      lastSlot.rotation,
      lastSlot.shape,
      lastProfile.profileExponent,
      lastProfile.outerOffset,
    );
    nextX = lastSlot.x + lastHalfW + params.spacing + newSlotHalfW;
    nextY = lastSlot.y;
  }

  const newSlot: FreeSlot = createFreeSlotInstance({
    id: idFactory.createId(),
    x: nextX,
    y: nextY,
    width,
    height: slotHeight,
    circleConfig: shape === "circle" ? circleConfig : undefined,
    ellipseConfig: shape === "ellipse" ? ellipseConfig : undefined,
  });

  return {
    ...params,
    slots: [...params.slots, newSlot],
  };
}

export function removeCustomSlot(
  params: CustomLayoutParams,
  id: string,
): CustomLayoutParams {
  return removeFreeSlot(params, id);
}

export function updateCustomSlotPosition(
  params: CustomLayoutParams,
  id: string,
  x: number,
  y: number,
): CustomLayoutParams {
  return updateFreeSlotPosition(params, id, x, y);
}

export function applyCustomSlotUpdates(
  params: CustomLayoutParams,
  updates: CustomSlotUpdate[],
): CustomLayoutParams {
  return applyFreeSlotUpdates(params, updates);
}

export function updateCustomSlotRotation(
  params: CustomLayoutParams,
  id: string,
  rotation: number,
): CustomLayoutParams {
  return updateFreeSlotRotation(params, id, rotation);
}

export function insertCustomSlots(
  params: CustomLayoutParams,
  idFactory: IdFactory,
  slotsToInsert: SymmetryInsertSlot[],
): CustomLayoutParams {
  return insertFreeSlots<FreeSlot, CustomLayoutParams, SymmetryInsertSlot>(
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
    }),
  );
}

export function duplicateCustomSlots(
  params: CustomLayoutParams,
  idFactory: IdFactory,
  ids: string[],
): { params: CustomLayoutParams; newIds: string[] } {
  return duplicateFreeSlots(params, idFactory, ids);
}

export function trimCustomBaseplate(
  params: CustomLayoutParams,
  effectiveDimensions: LayoutExtents,
): CustomLayoutParams {
  return trimFreeSlotBaseplate(params, effectiveDimensions);
}

/**
 * 盒体开启时，"扩展盒体至刚好容纳"：按最终槽位轮廓外接范围设置新外尺寸，
 * 并把整组槽位居中（离散事务，只产生一个 Undo 步骤）。空盒不执行。
 */
export function expandCustomBoxToFit(
  params: CustomLayoutParams,
): CustomLayoutParams {
  const box = resolveStackableBoxParams(params.stackableBox);
  if (!box.enabled || params.slots.length === 0) return params;

  const required = calculateCustomBoxRequiredOuterSize(params);
  const extents = calculateCustomEffectiveDimensions(params);
  const newOuterWidth = required.outerWidth;
  const newOuterDepth = required.outerDepth;
  const oldCx = (extents.minX + extents.maxX) / 2;
  const oldCy = (extents.minY + extents.maxY) / 2;
  const dx = newOuterWidth / 2 - oldCx;
  const dy = newOuterDepth / 2 - oldCy;

  return {
    ...params,
    stackableBox: {
      ...box,
      outerWidth: newOuterWidth,
      outerDepth: newOuterDepth,
    },
    slots: params.slots.map((slot) => ({
      ...slot,
      x: slot.x + dx,
      y: slot.y + dy,
    })),
  };
}
