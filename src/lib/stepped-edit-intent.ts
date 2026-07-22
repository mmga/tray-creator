import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import type { IdFactory } from "@/lib/model-ports";
import type { EllipseSlotInstanceConfig } from "@/lib/slot-instance-factory";
import {
  addSteppedGroup,
  moveSteppedSlotsToGroup,
  removeSteppedGroup,
  reorderSteppedGroups,
  updateSteppedGroupDisconnectDistance,
  updateSteppedGroupDisconnectOverride,
  updateSteppedGroupHeight,
  updateSteppedGroupSplitPartTarget,
  updateSteppedGroupSmoothingOverride,
  updateSteppedGroupSmoothingRadius,
} from "@/lib/stepped-layout-group-actions";
import {
  addSteppedSlot,
  applySteppedSlotUpdates,
  duplicateSteppedSlots,
  insertSteppedSlots,
  removeSteppedSlot,
  trimSteppedBaseplate,
  updateSteppedLayoutParam,
  updateSteppedSlotPosition,
  updateSteppedSlotRotation,
  type SteppedSlotUpdate,
} from "@/lib/stepped-layout-slot-actions";
import type { SteppedLayoutParams } from "@/types/custom-tray";

type SteppedParamUpdateIntent = {
  [K in keyof SteppedLayoutParams]-?: {
    type: "param.update";
    key: K;
    value: SteppedLayoutParams[K];
  };
}[keyof SteppedLayoutParams];

export type { SteppedSlotUpdate };

export type SteppedEditIntent =
  | SteppedParamUpdateIntent
  | { type: "slot.add"; width: number; height?: number; ellipseConfig?: EllipseSlotInstanceConfig; targetGroupId?: string }
  | { type: "slot.remove"; id: string }
  | { type: "slots.remove"; ids: string[] }
  | { type: "slot.position"; id: string; x: number; y: number }
  | { type: "slot.rotation"; id: string; rotation: number }
  | { type: "slots.update"; updates: SteppedSlotUpdate[] }
  | { type: "slots.insert"; slots: SymmetryInsertSlot[]; targetGroupId?: string }
  | { type: "slots.duplicate"; ids: string[] }
  | { type: "slots.move-to-group"; ids: string[]; targetGroupId: string }
  | { type: "baseplate.trim" }
  | { type: "group.add" }
  | { type: "group.remove"; groupId: string }
  | { type: "group.height"; groupId: string; height: number }
  | { type: "group.smoothing-override"; groupId: string; enabled: boolean }
  | { type: "group.smoothing-radius"; groupId: string; radius: number }
  | { type: "group.disconnect-override"; groupId: string; enabled: boolean }
  | { type: "group.disconnect-distance"; groupId: string; distance: number }
  | { type: "group.split-target"; groupId: string; targetGroupId: string | null }
  | { type: "group.reorder"; fromIndex: number; toIndex: number }
  | { type: "params.patch"; patch: Partial<SteppedLayoutParams> }
  | { type: "params.replace"; params: SteppedLayoutParams };

export type SteppedContinuousEditIntent = Extract<
  SteppedEditIntent,
  | { type: "param.update" }
  | { type: "slots.update" }
  | { type: "group.height" }
  | { type: "group.smoothing-radius" }
  | { type: "group.disconnect-distance" }
>;

export interface SteppedEditApplication {
  params: SteppedLayoutParams;
  createdIds: string[];
}

/**
 * 将一个完整的用户编辑意图映射为一次纯参数变换。
 * 事务历史、规范化及派生结果失效由调用它的 Stepped Layout Core 统一处理。
 */
export function applySteppedEditIntent(
  params: SteppedLayoutParams,
  intent: SteppedEditIntent,
  idFactory: IdFactory,
): SteppedEditApplication {
  let next = params;
  let createdIds: string[] = [];

  switch (intent.type) {
    case "param.update":
      next = updateSteppedLayoutParam(params, intent.key, intent.value);
      break;
    case "slot.add":
      next = addSteppedSlot(params, idFactory, intent.width, intent.height, intent.ellipseConfig, intent.targetGroupId);
      createdIds = next.slots.slice(params.slots.length).map((slot) => slot.id);
      break;
    case "slot.remove":
      next = removeSteppedSlot(params, intent.id);
      break;
    case "slots.remove": {
      const ids = new Set(intent.ids);
      next = { ...params, slots: params.slots.filter((slot) => !ids.has(slot.id)) };
      break;
    }
    case "slot.position":
      next = updateSteppedSlotPosition(params, intent.id, intent.x, intent.y);
      break;
    case "slot.rotation":
      next = updateSteppedSlotRotation(params, intent.id, intent.rotation);
      break;
    case "slots.update":
      next = applySteppedSlotUpdates(params, intent.updates);
      break;
    case "slots.insert":
      next = insertSteppedSlots(params, idFactory, intent.slots, intent.targetGroupId);
      createdIds = next.slots.slice(params.slots.length).map((slot) => slot.id);
      break;
    case "slots.duplicate": {
      const result = duplicateSteppedSlots(params, idFactory, intent.ids);
      next = result.params;
      createdIds = result.newIds;
      break;
    }
    case "slots.move-to-group":
      next = moveSteppedSlotsToGroup(params, intent.ids, intent.targetGroupId);
      break;
    case "baseplate.trim":
      next = trimSteppedBaseplate(params);
      break;
    case "group.add":
      next = addSteppedGroup(params, idFactory);
      createdIds = next.groups.slice(params.groups.length).map((group) => group.id);
      break;
    case "group.remove":
      next = removeSteppedGroup(params, intent.groupId);
      break;
    case "group.height":
      next = updateSteppedGroupHeight(params, intent.groupId, intent.height);
      break;
    case "group.smoothing-override":
      next = updateSteppedGroupSmoothingOverride(params, intent.groupId, intent.enabled);
      break;
    case "group.smoothing-radius":
      next = updateSteppedGroupSmoothingRadius(params, intent.groupId, intent.radius);
      break;
    case "group.disconnect-override":
      next = updateSteppedGroupDisconnectOverride(params, intent.groupId, intent.enabled);
      break;
    case "group.disconnect-distance":
      next = updateSteppedGroupDisconnectDistance(params, intent.groupId, intent.distance);
      break;
    case "group.split-target":
      next = updateSteppedGroupSplitPartTarget(params, intent.groupId, intent.targetGroupId);
      break;
    case "group.reorder":
      next = reorderSteppedGroups(params, intent.fromIndex, intent.toIndex);
      break;
    case "params.patch":
      next = { ...params, ...intent.patch };
      break;
    case "params.replace":
      next = intent.params;
      break;
    default: {
      const exhaustive: never = intent;
      return exhaustive;
    }
  }

  return { params: next, createdIds };
}
