import type { CustomLayoutParams } from "@/types/custom-tray";
import { ELLIPSE_PROFILE_EXPONENT, SHARED_LAYOUT_LIMITS } from "@/lib/config";

const DEFAULT_ELLIPSE_OUTER_OFFSET = 0.4;

export interface EllipsePreset {
  name: string;
  width: number;
  height: number;
  outerOffset: number;
  profileExponent: number;
}

export const ELLIPSE_PRESETS: EllipsePreset[] = [
  {
    name: "60x35.5mm",
    width: 60,
    height: 35.5,
    outerOffset: 0.4,
    profileExponent: 2.05,
  },
  {
    name: "75x42mm",
    width: 75,
    height: 43.2,
    outerOffset: 0.6,
    profileExponent: 2.08,
  },
  {
    name: "90x52mm",
    width: 90,
    height: 52,
    outerOffset: DEFAULT_ELLIPSE_OUTER_OFFSET,
    profileExponent: ELLIPSE_PROFILE_EXPONENT,
  },
  {
    name: "105x70mm",
    width: 105,
    height: 70,
    outerOffset: DEFAULT_ELLIPSE_OUTER_OFFSET,
    profileExponent: ELLIPSE_PROFILE_EXPONENT,
  },
  {
    name: "120x92mm",
    width: 120,
    height: 92,
    outerOffset: DEFAULT_ELLIPSE_OUTER_OFFSET,
    profileExponent: ELLIPSE_PROFILE_EXPONENT,
  },
  {
    name: "150x95mm",
    width: 150,
    height: 95,
    outerOffset: DEFAULT_ELLIPSE_OUTER_OFFSET,
    profileExponent: ELLIPSE_PROFILE_EXPONENT,
  },
  {
    name: "170x105mm",
    width: 170,
    height: 105,
    outerOffset: DEFAULT_ELLIPSE_OUTER_OFFSET,
    profileExponent: ELLIPSE_PROFILE_EXPONENT,
  },
];

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
