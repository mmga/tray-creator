import type { SlotGroup, SteppedLayoutParams } from "@/types/custom-tray";

type StructureParamDefaults = Pick<
  SteppedLayoutParams,
  "smoothingRadius" | "disconnectDistance"
>;

export type GroupStructureOverrides = Pick<
  SlotGroup,
  | "useGroupSmoothingRadius"
  | "groupSmoothingRadius"
  | "useGroupDisconnectDistance"
  | "groupDisconnectDistance"
>;

export function createGroupStructureOverrides(
  defaults: StructureParamDefaults,
): GroupStructureOverrides {
  return {
    useGroupSmoothingRadius: false,
    groupSmoothingRadius: defaults.smoothingRadius,
    useGroupDisconnectDistance: false,
    groupDisconnectDistance: defaults.disconnectDistance,
  };
}

export function getEffectiveGroupStructureParams(
  group: GroupStructureOverrides,
  params: StructureParamDefaults,
): StructureParamDefaults {
  return {
    smoothingRadius: group.useGroupSmoothingRadius
      ? group.groupSmoothingRadius
      : params.smoothingRadius,
    disconnectDistance: group.useGroupDisconnectDistance
      ? group.groupDisconnectDistance
      : params.disconnectDistance,
  };
}
