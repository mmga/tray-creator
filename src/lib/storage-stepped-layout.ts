import type { FreeSlot } from "@/types/custom-tray";
import type { BaseHoleStructure } from "@/types/tray";
import type { IdFactory } from "@/lib/model-ports";
import {
  cloneStorageSteppedTrayConfig,
  getStorageSteppedTray,
  replaceStorageSteppedTray,
} from "@/lib/storage-stepped-config";
import { STORAGE_STEPPED_CUSTOM_PRESET_ID } from "@/lib/storage-stepped-presets";
import type {
  StorageSteppedParams,
  StorageSteppedTrayConfig,
} from "@/types/storage-stepped";

export interface StorageTraySlotUpdate {
  id: string;
  x: number;
  y: number;
  rotation?: number;
}

function requireTray(
  params: StorageSteppedParams,
  stepIndex: number,
): StorageSteppedTrayConfig {
  const tray = getStorageSteppedTray(params, stepIndex);
  if (!tray) throw new Error(`找不到第 ${stepIndex + 1} 阶托盘配置`);
  return tray;
}

/**
 * 修改某一阶托盘；只影响该阶配置，其他阶保持各自参数。
 * `markCustom` 表示槽位布局被手工修改，预设名称不再代表几何。
 */
export function updateStorageSteppedTray(
  params: StorageSteppedParams,
  stepIndex: number,
  mutate: (tray: StorageSteppedTrayConfig) => StorageSteppedTrayConfig,
  markCustom = false,
): StorageSteppedParams {
  const tray = cloneStorageSteppedTrayConfig(requireTray(params, stepIndex));
  const next = mutate(tray);
  return replaceStorageSteppedTray(params, {
    ...next,
    stepIndex,
    ...(markCustom ? { presetId: STORAGE_STEPPED_CUSTOM_PRESET_ID } : {}),
  });
}

export function addStorageSteppedTraySlot(
  params: StorageSteppedParams,
  stepIndex: number,
  slot: FreeSlot,
): StorageSteppedParams {
  return updateStorageSteppedTray(
    params,
    stepIndex,
    (tray) => ({ ...tray, slots: [...tray.slots, slot] }),
    true,
  );
}

export function removeStorageSteppedTraySlots(
  params: StorageSteppedParams,
  stepIndex: number,
  ids: string[],
): StorageSteppedParams {
  if (ids.length === 0) return params;
  const removed = new Set(ids);
  return updateStorageSteppedTray(
    params,
    stepIndex,
    (tray) => ({
      ...tray,
      slots: tray.slots.filter((slot) => !removed.has(slot.id)),
    }),
    true,
  );
}

export function applyStorageSteppedTraySlotUpdates(
  params: StorageSteppedParams,
  stepIndex: number,
  updates: StorageTraySlotUpdate[],
): StorageSteppedParams {
  if (updates.length === 0) return params;
  const byId = new Map(updates.map((update) => [update.id, update]));
  return updateStorageSteppedTray(
    params,
    stepIndex,
    (tray) => ({
      ...tray,
      slots: tray.slots.map((slot) => {
        const update = byId.get(slot.id);
        if (!update) return slot;
        return {
          ...slot,
          x: update.x,
          y: update.y,
          rotation: update.rotation ?? slot.rotation,
        };
      }),
    }),
    true,
  );
}

export function updateStorageSteppedTraySlotRotation(
  params: StorageSteppedParams,
  stepIndex: number,
  id: string,
  rotation: number,
): StorageSteppedParams {
  return updateStorageSteppedTray(
    params,
    stepIndex,
    (tray) => ({
      ...tray,
      slots: tray.slots.map((slot) =>
        slot.id === id ? { ...slot, rotation } : slot,
      ),
    }),
    true,
  );
}

export function duplicateStorageSteppedTraySlots(
  params: StorageSteppedParams,
  stepIndex: number,
  ids: string[],
  idFactory: IdFactory,
): { params: StorageSteppedParams; newIds: string[] } {
  const tray = requireTray(params, stepIndex);
  const newIds: string[] = [];
  const additions: FreeSlot[] = [];
  for (const id of ids) {
    const source = tray.slots.find((slot) => slot.id === id);
    if (!source) continue;
    const newId = idFactory.createId();
    newIds.push(newId);
    additions.push({ ...source, id: newId, x: source.x + 10, y: source.y - 10 });
  }
  if (additions.length === 0) return { params, newIds };
  return {
    params: updateStorageSteppedTray(
      params,
      stepIndex,
      (current) => ({ ...current, slots: [...current.slots, ...additions] }),
      true,
    ),
    newIds,
  };
}

/** 对称工具插入的槽位；保留来源槽形的尺寸快照。 */
export function insertStorageSteppedTraySlots(
  params: StorageSteppedParams,
  stepIndex: number,
  sources: Array<Omit<FreeSlot, "id">>,
  idFactory: IdFactory,
): StorageSteppedParams {
  if (sources.length === 0) return params;
  return updateStorageSteppedTray(
    params,
    stepIndex,
    (tray) => ({
      ...tray,
      slots: [
        ...tray.slots,
        ...sources.map((source) => ({ ...source, id: idFactory.createId() })),
      ],
    }),
    true,
  );
}

/** 槽深只影响所属托盘；固定总厚度不变。 */
export function updateStorageSteppedTrayHoleDepth(
  params: StorageSteppedParams,
  stepIndex: number,
  holeDepth: number,
): StorageSteppedParams {
  return updateStorageSteppedTray(params, stepIndex, (tray) => ({
    ...tray,
    holeDepth,
  }));
}

export interface StorageTrayBaseHolePatch {
  baseHoleStructure?: BaseHoleStructure;
  magnetPostHoleDiameter?: number;
  magnetPostHoleDepth?: number;
  smallBaseHoleSize?: StorageSteppedTrayConfig["smallBaseHoleSize"];
  baseHoleSize?: StorageSteppedTrayConfig["baseHoleSize"];
}

export function updateStorageSteppedTrayBaseHole(
  params: StorageSteppedParams,
  stepIndex: number,
  patch: StorageTrayBaseHolePatch,
): StorageSteppedParams {
  return updateStorageSteppedTray(params, stepIndex, (tray) => ({
    ...tray,
    ...patch,
  }));
}
