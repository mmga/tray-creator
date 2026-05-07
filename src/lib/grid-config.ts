import type { TrayParams } from "@/types/tray";
import { BASE_PRESETS, SHARED_LAYOUT_LIMITS } from "@/lib/config";

export const DEFAULT_PRESET_INDEX = 2;

export const DEFAULT_TRAY_PARAMS: TrayParams = {
  rows: 5,
  columns: 2,
  holeDiameter: BASE_PRESETS[DEFAULT_PRESET_INDEX].diameter,
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
  enableBaseHole: true,
  baseHoleSize: "25",
};

export const PARAM_CONFIG = {
  columns: { label: "列数", min: 1, max: 6, step: 1, unit: "个" },
  rows: { label: "行数", min: 1, max: 6, step: 1, unit: "个" },
  spacing: { label: "凹槽间距", min: 0, max: 10, step: 1, unit: "mm" },
  spacingX: { label: "X 轴凹槽间距", min: 0, max: 10, step: 0.1, unit: "mm" },
  spacingY: { label: "Y 轴凹槽间距", min: 0, max: 10, step: 0.1, unit: "mm" },
  boundarySpacing: { label: "边界间距", min: 0, max: 20, step: 1, unit: "mm" },
  baseThickness: SHARED_LAYOUT_LIMITS.baseThickness,
  holeDepth: SHARED_LAYOUT_LIMITS.holeDepth,
  cornerRadius: SHARED_LAYOUT_LIMITS.cornerRadius,
} as const;
