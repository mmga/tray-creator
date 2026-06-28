import { GROUP_COLORS } from "@/lib/stepped-config";
import { createGroupStructureOverrides } from "@/lib/stepped-group-params";
import type { IdFactory } from "@/lib/model-ports";
import type { SlotGroup, SteppedLayoutParams } from "@/types/custom-tray";

export function addSteppedGroup(
  params: SteppedLayoutParams,
  idFactory: IdFactory,
): SteppedLayoutParams {
  const usedColors = params.groups.map((group) => group.color);
  const nextColor =
    GROUP_COLORS.find((color) => !usedColors.includes(color)) ??
    GROUP_COLORS[params.groups.length % GROUP_COLORS.length];
  const newGroup: SlotGroup = {
    id: idFactory.createId(),
    name: `组 ${params.groups.length + 1}`,
    color: nextColor,
    bottomHeight: Math.max(...params.groups.map((group) => group.bottomHeight), 0) + 5,
    ...createGroupStructureOverrides({
      smoothingRadius: params.smoothingRadius,
      disconnectDistance: params.disconnectDistance,
    }),
  };

  return {
    ...params,
    groups: [...params.groups, newGroup],
    activeGroupId: newGroup.id,
  };
}

export function removeSteppedGroup(
  params: SteppedLayoutParams,
  groupId: string,
): SteppedLayoutParams {
  if (params.groups.length <= 1) {
    return params;
  }

  const nextGroups = params.groups.filter((group) => group.id !== groupId);
  const nextSlots = params.slots.filter((slot) => slot.groupId !== groupId);
  const nextActiveGroupId =
    params.activeGroupId === groupId
      ? (nextGroups[0]?.id ?? "")
      : params.activeGroupId;

  return {
    ...params,
    groups: nextGroups,
    slots: nextSlots,
    activeGroupId: nextActiveGroupId,
  };
}

export function updateSteppedGroupHeight(
  params: SteppedLayoutParams,
  groupId: string,
  height: number,
): SteppedLayoutParams {
  return {
    ...params,
    groups: params.groups.map((group) =>
      group.id === groupId ? { ...group, bottomHeight: height } : group,
    ),
  };
}

export function updateSteppedGroupSmoothingOverride(
  params: SteppedLayoutParams,
  groupId: string,
  enabled: boolean,
): SteppedLayoutParams {
  return {
    ...params,
    groups: params.groups.map((group) =>
      group.id === groupId
        ? { ...group, useGroupSmoothingRadius: enabled }
        : group,
    ),
  };
}

export function updateSteppedGroupSmoothingRadius(
  params: SteppedLayoutParams,
  groupId: string,
  radius: number,
): SteppedLayoutParams {
  return {
    ...params,
    groups: params.groups.map((group) =>
      group.id === groupId ? { ...group, groupSmoothingRadius: radius } : group,
    ),
  };
}

export function updateSteppedGroupDisconnectOverride(
  params: SteppedLayoutParams,
  groupId: string,
  enabled: boolean,
): SteppedLayoutParams {
  return {
    ...params,
    groups: params.groups.map((group) =>
      group.id === groupId
        ? { ...group, useGroupDisconnectDistance: enabled }
        : group,
    ),
  };
}

export function updateSteppedGroupDisconnectDistance(
  params: SteppedLayoutParams,
  groupId: string,
  distance: number,
): SteppedLayoutParams {
  return {
    ...params,
    groups: params.groups.map((group) =>
      group.id === groupId
        ? { ...group, groupDisconnectDistance: distance }
        : group,
    ),
  };
}

export function setSteppedActiveGroup(
  params: SteppedLayoutParams,
  groupId: string,
): SteppedLayoutParams {
  if (
    params.activeGroupId === groupId ||
    !params.groups.some((group) => group.id === groupId)
  ) {
    return params;
  }

  return {
    ...params,
    activeGroupId: groupId,
  };
}

export function moveSteppedSlotsToGroup(
  params: SteppedLayoutParams,
  ids: string[],
  targetGroupId: string,
): SteppedLayoutParams {
  const idSet = new Set(ids);

  return {
    ...params,
    slots: params.slots.map((slot) =>
      idSet.has(slot.id) ? { ...slot, groupId: targetGroupId } : slot,
    ),
  };
}

export function reorderSteppedGroups(
  params: SteppedLayoutParams,
  fromIndex: number,
  toIndex: number,
): SteppedLayoutParams {
  if (
    fromIndex < 0 ||
    fromIndex >= params.groups.length ||
    toIndex < 0 ||
    toIndex >= params.groups.length ||
    fromIndex === toIndex
  ) {
    return params;
  }

  const nextGroups = [...params.groups];
  const [moved] = nextGroups.splice(fromIndex, 1);
  nextGroups.splice(toIndex, 0, moved);

  return {
    ...params,
    groups: nextGroups,
  };
}
