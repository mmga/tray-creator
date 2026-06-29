import {
  getBaseHoleMinBaseThickness,
  resolveBaseHolePresetKey,
} from "@/lib/config";
import { STEPPED_LIMITS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import type { BaseHolePresetKey } from "@/types/tray";

function getLargestSlotSizeForGroup(
  params: SteppedLayoutParams,
  groupId: string,
): number {
  return params.slots.reduce((maxSize, slot) => {
    if (slot.groupId !== groupId) {
      return maxSize;
    }

    return Math.max(maxSize, slot.width, slot.height);
  }, 0);
}

export function getSteppedResolvedBaseHoleSize(
  params: SteppedLayoutParams,
): BaseHolePresetKey {
  const largestSlotSize = params.slots.reduce(
    (maxSize, slot) => Math.max(maxSize, slot.width, slot.height),
    0,
  );

  return resolveBaseHolePresetKey(largestSlotSize);
}

export function getSteppedGroupResolvedBaseHoleSize(
  params: SteppedLayoutParams,
  groupId: string,
): BaseHolePresetKey {
  return resolveBaseHolePresetKey(getLargestSlotSizeForGroup(params, groupId));
}

export function getSteppedGroupMinBottomHeight(
  params: SteppedLayoutParams,
  groupId: string,
): number {
  const largestSlotSize = getLargestSlotSizeForGroup(params, groupId);
  if (largestSlotSize <= 0) {
    return STEPPED_LIMITS.bottomHeight.min;
  }

  const baseHoleSize = resolveBaseHolePresetKey(largestSlotSize);
  return Math.max(
    STEPPED_LIMITS.bottomHeight.min,
    params.holeDepth + getBaseHoleMinBaseThickness(baseHoleSize),
  );
}

export function applySteppedBaseHoleDerivedFields(
  params: SteppedLayoutParams,
): SteppedLayoutParams {
  const resolvedBaseHoleSize = getSteppedResolvedBaseHoleSize(params);
  const enableBaseHole =
    typeof params.enableBaseHole === "boolean" ? params.enableBaseHole : false;
  let nextParams = params;

  if (
    params.baseHoleSize !== resolvedBaseHoleSize ||
    params.enableBaseHole !== enableBaseHole
  ) {
    nextParams = {
      ...nextParams,
      enableBaseHole,
      baseHoleSize: resolvedBaseHoleSize,
    };
  }

  if (!enableBaseHole) {
    return nextParams;
  }

  let groupsChanged = false;
  const nextGroups = nextParams.groups.map((group) => {
    const minBottomHeight = getSteppedGroupMinBottomHeight(nextParams, group.id);
    if (group.bottomHeight >= minBottomHeight) {
      return group;
    }

    groupsChanged = true;
    return {
      ...group,
      bottomHeight: minBottomHeight,
    };
  });

  if (!groupsChanged) {
    return nextParams;
  }

  return {
    ...nextParams,
    groups: nextGroups,
  };
}
