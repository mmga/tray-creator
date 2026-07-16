import type {
  BaseHoleParams,
  BaseHoleStructure,
} from "@/types/tray";

export const BASE_HOLE_PARAM_DEFAULTS = {
  magnetPostHoleDiameter: 5,
  magnetPostHoleDepth: 2,
  baseHoleSize: "25",
} as const satisfies Omit<BaseHoleParams, "baseHoleStructure">;

export const MAGNET_POST_HOLE_BOTTOM_WALL = 1;

export const MAGNET_POST_HOLE_LIMITS = {
  diameter: { label: "磁铁桩孔直径", min: 1, max: 15, step: 0.1, unit: "mm" },
  depth: { label: "磁铁桩孔深度", min: 0.5, max: 3, step: 0.1, unit: "mm" },
} as const;

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

export function isBaseHoleStructure(value: unknown): value is BaseHoleStructure {
  return value === "none" ||
    value === "magnetic-base-hole" ||
    value === "magnet-post-hole";
}

export function resolveMagneticBaseHolePreset(
  shape: "circle" | "ellipse" | "rectangle",
  nominalWidth: number,
  nominalHeight: number,
): "25" | "40" {
  if (shape === "circle") {
    return nominalWidth >= 60 ? "40" : "25";
  }
  return Math.min(nominalWidth, nominalHeight) > 40 ? "40" : "25";
}

export function normalizeBaseHoleParams(
  value: Record<string, unknown>,
  defaultStructure: BaseHoleStructure,
): BaseHoleParams {
  const legacyStructure = value.enableBaseHole === true
    ? "magnetic-base-hole"
    : value.enableBaseHole === false
      ? "none"
      : defaultStructure;

  return {
    baseHoleStructure: isBaseHoleStructure(value.baseHoleStructure)
      ? value.baseHoleStructure
      : legacyStructure,
    magnetPostHoleDiameter: clamp(
      value.magnetPostHoleDiameter,
      MAGNET_POST_HOLE_LIMITS.diameter.min,
      MAGNET_POST_HOLE_LIMITS.diameter.max,
      BASE_HOLE_PARAM_DEFAULTS.magnetPostHoleDiameter,
    ),
    magnetPostHoleDepth: clamp(
      value.magnetPostHoleDepth,
      MAGNET_POST_HOLE_LIMITS.depth.min,
      MAGNET_POST_HOLE_LIMITS.depth.max,
      BASE_HOLE_PARAM_DEFAULTS.magnetPostHoleDepth,
    ),
    baseHoleSize: value.baseHoleSize === "40" ? "40" : "25",
  };
}
