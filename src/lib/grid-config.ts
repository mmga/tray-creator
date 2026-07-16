import type { BaseHolePresetKey, TrayParams } from "@/types/tray";
import {
  BASE_PRESETS,
  SHARED_LAYOUT_LIMITS,
} from "@/lib/config";
import { createGridSlotSnapshotFromDefinition } from "@/lib/slot-instance-factory";
import {
  BASE_HOLE_PARAM_DEFAULTS,
  resolveMagneticBaseHolePreset,
} from "@/lib/base-hole-config";

export const DEFAULT_PRESET_INDEX = 2;
const DEFAULT_SLOT_SNAPSHOT = createGridSlotSnapshotFromDefinition(
  BASE_PRESETS[DEFAULT_PRESET_INDEX].diameter,
);

export const DEFAULT_TRAY_PARAMS: TrayParams = {
  rows: 5,
  columns: 2,
  holeDiameter: BASE_PRESETS[DEFAULT_PRESET_INDEX].diameter,
  ...DEFAULT_SLOT_SNAPSHOT,
  slotShape: "circle",
  spacing: 5,
  spacingIndependent: false,
  spacingX: 5,
  spacingY: 5,
  boundarySpacing: 5,
  boundarySpacingIndependent: false,
  halfCircleSlots: false,
  basePlateOnly: false,
  baseThickness: 3,
  holeDepth: 3,
  cornerRadius: 4,
  sideBevelWidth: 0,
  ...BASE_HOLE_PARAM_DEFAULTS,
  baseHoleStructure: "magnetic-base-hole",
};

export interface OldWorldRectangularPreset {
  id: string;
  name: string;
  width: number;
  height: number;
}

export const OLD_WORLD_RECTANGULAR_PRESETS = [
  { id: "old-world-25x25", name: "旧世界 25×25mm", width: 25, height: 25 },
  { id: "old-world-30x30", name: "旧世界 30×30mm", width: 30, height: 30 },
  { id: "old-world-30x60", name: "旧世界 30×60mm", width: 30, height: 60 },
  { id: "old-world-40x40", name: "旧世界 40×40mm", width: 40, height: 40 },
  { id: "old-world-50x50", name: "旧世界 50×50mm", width: 50, height: 50 },
  { id: "old-world-50x75", name: "旧世界 50×75mm", width: 50, height: 75 },
  { id: "old-world-60x100", name: "旧世界 60×100mm", width: 60, height: 100 },
] as const satisfies readonly OldWorldRectangularPreset[];

const OLD_WORLD_SLOT_TOLERANCE = 0.4;

export function findOldWorldRectangularPreset(id: string | undefined) {
  return OLD_WORLD_RECTANGULAR_PRESETS.find((preset) => preset.id === id);
}

function getFiniteOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function isRectangularGridSlot(params: TrayParams) {
  return params.slotShape === "rectangle";
}

export function getGridSlotGeometry(params: TrayParams) {
  if (isRectangularGridSlot(params)) {
    const preset = findOldWorldRectangularPreset(params.slotDefinitionId);
    const baseWidth = getFiniteOr(params.slotBaseWidth, preset?.width ?? params.holeDiameter);
    const baseHeight = getFiniteOr(params.slotBaseHeight, preset?.height ?? params.holeDiameter);
    return {
      shape: "rectangle" as const,
      baseWidth,
      baseHeight,
      slotWidth: getFiniteOr(params.slotWidth, baseWidth + OLD_WORLD_SLOT_TOLERANCE),
      slotHeight: getFiniteOr(params.slotHeight, baseHeight + OLD_WORLD_SLOT_TOLERANCE),
    };
  }

  const defaultSnapshot = createGridSlotSnapshotFromDefinition(
    params.holeDiameter,
  );
  const slotDiameter = getFiniteOr(
    params.slotDiameter,
    defaultSnapshot.slotDiameter,
  );
  return {
    shape: "circle" as const,
    baseWidth: params.holeDiameter,
    baseHeight: params.holeDiameter,
    slotWidth: slotDiameter,
    slotHeight: slotDiameter,
  };
}

export function createOldWorldGridSlotSnapshot(
  preset: OldWorldRectangularPreset,
): Pick<
  TrayParams,
  | "holeDiameter"
  | "slotDefinitionId"
  | "slotShape"
  | "slotBaseWidth"
  | "slotBaseHeight"
  | "slotWidth"
  | "slotHeight"
> {
  return {
    holeDiameter: Math.min(preset.width, preset.height),
    slotDefinitionId: preset.id,
    slotShape: "rectangle",
    slotBaseWidth: preset.width,
    slotBaseHeight: preset.height,
    slotWidth: preset.width + OLD_WORLD_SLOT_TOLERANCE,
    slotHeight: preset.height + OLD_WORLD_SLOT_TOLERANCE,
  };
}

export function resolveGridBaseHolePresetKey(
  params: TrayParams,
): BaseHolePresetKey {
  const slot = getGridSlotGeometry(params);
  return resolveMagneticBaseHolePreset(
    slot.shape,
    slot.baseWidth,
    slot.baseHeight,
  );
}

export const PARAM_CONFIG = {
  columns: { label: "列数", min: 1, max: 30, step: 1, unit: "个" },
  rows: { label: "行数", min: 1, max: 30, step: 1, unit: "个" },
  spacing: { label: "凹槽间距", min: 0, max: 10, step: 1, unit: "mm" },
  spacingX: { label: "X 轴凹槽间距", min: 0, max: 10, step: 0.1, unit: "mm" },
  spacingY: { label: "Y 轴凹槽间距", min: 0, max: 10, step: 0.1, unit: "mm" },
  boundarySpacing: { label: "边界间距", min: 0, max: 20, step: 1, unit: "mm" },
  baseThickness: SHARED_LAYOUT_LIMITS.baseThickness,
  holeDepth: SHARED_LAYOUT_LIMITS.holeDepth,
  cornerRadius: SHARED_LAYOUT_LIMITS.cornerRadius,
  sideBevelWidth: SHARED_LAYOUT_LIMITS.sideBevelWidth,
} as const;
