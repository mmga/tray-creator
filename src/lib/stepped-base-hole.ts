import {
  getBaseHoleMinBaseThickness,
} from "@/lib/config";
import {
  STEPPED_LAYOUT_DEFAULTS,
  STEPPED_LIMITS,
} from "@/lib/stepped-config";
import {
  MAGNET_POST_HOLE_BOTTOM_WALL,
  normalizeBaseHoleParams,
  resolveLargestMagneticBaseHolePreset,
} from "@/lib/base-hole-config";
import type {
  BaseHoleStructure,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { BaseHolePresetKey } from "@/types/tray";

function resolveLargestPresetForSlots(
  slots: SteppedLayoutParams["slots"],
): BaseHolePresetKey {
  return resolveLargestMagneticBaseHolePreset(slots);
}

function getSlotsForGroup(
  params: SteppedLayoutParams,
  groupId: string,
): SteppedLayoutParams["slots"] {
  return params.slots.filter((slot) => slot.groupId === groupId);
}

export function getSteppedResolvedBaseHoleSize(
  params: SteppedLayoutParams,
): BaseHolePresetKey {
  return resolveLargestPresetForSlots(params.slots);
}

export function getSteppedGroupResolvedBaseHoleSize(
  params: SteppedLayoutParams,
  groupId: string,
): BaseHolePresetKey {
  return resolveLargestPresetForSlots(getSlotsForGroup(params, groupId));
}

export function getSteppedGroupMinBottomHeight(
  params: SteppedLayoutParams,
  groupId: string,
): number {
  const slots = getSlotsForGroup(params, groupId);
  if (slots.length === 0) {
    return STEPPED_LIMITS.bottomHeight.min;
  }

  const structure = resolveSteppedBaseHoleStructure(params);
  if (structure === "magnet-post-hole") {
    return Math.max(
      STEPPED_LIMITS.bottomHeight.min,
      params.holeDepth +
        resolveMagnetPostHoleDepth(params) +
        MAGNET_POST_HOLE_BOTTOM_WALL,
    );
  }

  if (structure !== "magnetic-base-hole") {
    return STEPPED_LIMITS.bottomHeight.min;
  }

  const baseHoleSize = resolveLargestPresetForSlots(slots);
  return Math.max(
    STEPPED_LIMITS.bottomHeight.min,
    params.holeDepth + getBaseHoleMinBaseThickness(baseHoleSize),
  );
}

export function resolveSteppedBaseHoleStructure(
  params: SteppedLayoutParams,
): BaseHoleStructure {
  return normalizeBaseHoleParams(
    params as unknown as Record<string, unknown>,
    "none",
  ).baseHoleStructure;
}

export function resolveMagnetPostHoleDiameter(params: SteppedLayoutParams) {
  const value = params.magnetPostHoleDiameter;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return STEPPED_LAYOUT_DEFAULTS.magnetPostHoleDiameter;
  }
  return Math.max(
    STEPPED_LIMITS.magnetPostHoleDiameter.min,
    Math.min(STEPPED_LIMITS.magnetPostHoleDiameter.max, value),
  );
}

export function resolveMagnetPostHoleDepth(params: SteppedLayoutParams) {
  const value = params.magnetPostHoleDepth;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return STEPPED_LAYOUT_DEFAULTS.magnetPostHoleDepth;
  }
  return Math.max(
    STEPPED_LIMITS.magnetPostHoleDepth.min,
    Math.min(STEPPED_LIMITS.magnetPostHoleDepth.max, value),
  );
}

export function applySteppedBaseHoleDerivedFields(
  params: SteppedLayoutParams,
): SteppedLayoutParams {
  const resolvedBaseHoleSize = getSteppedResolvedBaseHoleSize(params);
  const baseHoleStructure = resolveSteppedBaseHoleStructure(params);
  const magnetPostHoleDiameter = resolveMagnetPostHoleDiameter(params);
  const magnetPostHoleDepth = resolveMagnetPostHoleDepth(params);
  let nextParams = params;

  if (
    params.baseHoleSize !== resolvedBaseHoleSize ||
    params.baseHoleStructure !== baseHoleStructure ||
    params.magnetPostHoleDiameter !== magnetPostHoleDiameter ||
    params.magnetPostHoleDepth !== magnetPostHoleDepth ||
    "enableBaseHole" in params
  ) {
    const currentParams = { ...nextParams } as SteppedLayoutParams & {
      enableBaseHole?: boolean;
    };
    delete currentParams.enableBaseHole;
    nextParams = {
      ...currentParams,
      baseHoleStructure,
      magnetPostHoleDiameter,
      magnetPostHoleDepth,
      baseHoleSize: resolvedBaseHoleSize,
    };
  }

  if (baseHoleStructure === "none") {
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
