import type { CustomLayoutParams } from "@/types/custom-tray";
import { SHARED_LAYOUT_LIMITS } from "@/lib/config";
import {
  ELLIPSE_SLOT_DEFINITIONS,
  type EllipseSlotDefinition,
} from "@/lib/slot-definitions";

export type EllipsePreset = EllipseSlotDefinition;

export const ELLIPSE_PRESETS: EllipsePreset[] = ELLIPSE_SLOT_DEFINITIONS;

export const CUSTOM_LAYOUT_DEFAULTS: CustomLayoutParams = {
  trayWidth: 260,
  trayDepth: 260,
  slots: [],
  spacing: 5,
  boundarySpacing: 5,
  boundarySpacingIndependent: false,
  baseThickness: 3,
  holeDepth: 3,
  cornerRadius: 4,
  enableBaseHole: false,
  baseHoleSize: "25",
};

export const CUSTOM_LIMITS = {
  trayWidth: { label: "宽度", min: 50, max: 260, step: 1, unit: "mm" },
  trayDepth: { label: "深度", min: 50, max: 260, step: 1, unit: "mm" },
  spacing: { label: "凹槽间距", min: 2, max: 20, step: 1, unit: "mm" },
  boundarySpacing: { label: "边界间距", min: 2, max: 20, step: 1, unit: "mm" },
  baseThickness: SHARED_LAYOUT_LIMITS.baseThickness,
  holeDepth: SHARED_LAYOUT_LIMITS.holeDepth,
  cornerRadius: SHARED_LAYOUT_LIMITS.cornerRadius,
} as const;
