import type { CustomLayoutParams } from "@/types/custom-tray";
import type { BasePreset } from "@/types/tray";
import { MAX_TRAY_SIZE, SHARED_LAYOUT_LIMITS } from "@/lib/config";
import {
  CIRCLE_SLOT_DEFINITIONS,
  ELLIPSE_SLOT_DEFINITIONS,
  type EllipseSlotDefinition,
} from "@/lib/slot-definitions";
import { BASE_HOLE_PARAM_DEFAULTS } from "@/lib/base-hole-config";
import { createDefaultStackableBoxParams } from "@/lib/stackable-box";

export const CUSTOM_BASE_PRESETS: BasePreset[] = CIRCLE_SLOT_DEFINITIONS.map(
  (definition) => ({
    name: definition.name,
    diameter: definition.baseDiameter,
  }),
).filter((preset) => preset.diameter !== 10);

export type EllipsePreset = EllipseSlotDefinition;

export const ELLIPSE_PRESETS: EllipsePreset[] = ELLIPSE_SLOT_DEFINITIONS;

export const CUSTOM_LAYOUT_DEFAULTS: CustomLayoutParams = {
  footprintStyle: "rectangular",
  traySizingMode: "auto",
  trayWidth: 260,
  trayDepth: 260,
  slots: [],
  spacing: 5,
  boundarySpacing: 5,
  boundarySpacingIndependent: false,
  baseThickness: 3,
  holeDepth: 3,
  cornerRadius: 4,
  sideBevelWidth: 0,
  smoothingRadius: 60,
  disconnectDistance: 0,
  ...BASE_HOLE_PARAM_DEFAULTS,
  baseHoleStructure: "none",
  stackableBox: createDefaultStackableBoxParams(),
};

export const CUSTOM_LIMITS = {
  trayWidth: { label: "长度", min: 10, max: MAX_TRAY_SIZE, step: 0.1, unit: "mm" },
  trayDepth: { label: "宽度", min: 10, max: MAX_TRAY_SIZE, step: 0.1, unit: "mm" },
  spacing: { label: "凹槽间距", min: 0, max: 20, step: 1, unit: "mm" },
  boundarySpacing: { label: "边界间距", min: 0, max: 20, step: 1, unit: "mm" },
  baseThickness: SHARED_LAYOUT_LIMITS.baseThickness,
  holeDepth: SHARED_LAYOUT_LIMITS.holeDepth,
  cornerRadius: SHARED_LAYOUT_LIMITS.cornerRadius,
  sideBevelWidth: SHARED_LAYOUT_LIMITS.sideBevelWidth,
  smoothingRadius: { label: "平滑半径", min: 1, max: 150, step: 1, unit: "mm" },
  disconnectDistance: {
    label: "槽群断连距离",
    min: 0,
    max: 60,
    step: 1,
    unit: "mm",
  },
} as const;
