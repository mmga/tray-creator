import type { BaseConverterParams } from "@/types/custom-tray";
import { SHARED_LAYOUT_LIMITS } from "@/lib/config";

export interface SourceBaseStandard {
  id: string;
  name: string;
  shape: "rectangle" | "circle";
  width: number;
  depth: number;
}

export interface TargetBaseStandard {
  id: string;
  name: string;
  shape: "circle" | "ellipse";
  width: number;
  depth: number;
}

export const CONVERSION_CLEARANCE_PER_SIDE = 0.2;

export const SOURCE_BASE_STANDARDS: SourceBaseStandard[] = [
  { id: "source-20x20", name: "20 × 20mm", shape: "rectangle", width: 20, depth: 20 },
  { id: "source-25x25", name: "25 × 25mm", shape: "rectangle", width: 25, depth: 25 },
  { id: "source-40x40", name: "40 × 40mm", shape: "rectangle", width: 40, depth: 40 },
  { id: "source-25x50", name: "25 × 50mm", shape: "rectangle", width: 25, depth: 50 },
  { id: "source-50x75", name: "50 × 75mm", shape: "rectangle", width: 50, depth: 75 },
  { id: "source-50x100", name: "50 × 100mm", shape: "rectangle", width: 50, depth: 100 },
  { id: "source-circle-20", name: "Ø20mm", shape: "circle", width: 20, depth: 20 },
  { id: "source-circle-25", name: "Ø25mm", shape: "circle", width: 25, depth: 25 },
  { id: "source-circle-32", name: "Ø32mm", shape: "circle", width: 32, depth: 32 },
  { id: "source-circle-40", name: "Ø40mm", shape: "circle", width: 40, depth: 40 },
];

export const TARGET_BASE_STANDARDS: TargetBaseStandard[] = [
  { id: "target-circle-25", name: "Ø25mm", shape: "circle", width: 25, depth: 25 },
  { id: "target-circle-32", name: "Ø32mm", shape: "circle", width: 32, depth: 32 },
  { id: "target-circle-40", name: "Ø40mm", shape: "circle", width: 40, depth: 40 },
  { id: "target-circle-50", name: "Ø50mm", shape: "circle", width: 50, depth: 50 },
  { id: "target-ellipse-35x60", name: "35 × 60mm", shape: "ellipse", width: 35, depth: 60 },
  { id: "target-ellipse-42x75", name: "42 × 75mm", shape: "ellipse", width: 42, depth: 75 },
  { id: "target-ellipse-70x105", name: "70 × 105mm", shape: "ellipse", width: 70, depth: 105 },
];

export const BASE_CONVERTER_LIMITS = {
  floorThickness: { min: 0.8, max: 5, step: 0.1, label: "底部保留厚度", unit: "mm" },
  recessDepth: { min: 0.5, max: 5, step: 0.1, label: "凹槽深度 / 挡边高度", unit: "mm" },
  sideBevelWidth: SHARED_LAYOUT_LIMITS.sideBevelWidth,
} as const;

export const BASE_CONVERTER_DEFAULTS: BaseConverterParams = {
  sourceStandardId: "source-20x20",
  targetStandardId: "target-circle-25",
  floorThickness: 1.2,
  recessDepth: 2,
  sideBevelWidth: 0,
};

export function findSourceBaseStandard(id: string | undefined) {
  return SOURCE_BASE_STANDARDS.find((standard) => standard.id === id);
}

export function findTargetBaseStandard(id: string | undefined) {
  return TARGET_BASE_STANDARDS.find((standard) => standard.id === id);
}

export function getConversionRecessDimensions(source: SourceBaseStandard) {
  const clearance = CONVERSION_CLEARANCE_PER_SIDE * 2;
  return {
    width: source.width + clearance,
    depth: source.depth + clearance,
  };
}

export function isBaseConversionCompatible(
  source: SourceBaseStandard,
  target: TargetBaseStandard,
) {
  const recess = getConversionRecessDimensions(source);
  return recess.width < target.width && recess.depth < target.depth;
}

const MIN_TOP_WALL = 0.1;

export function getMaxBaseConverterSideBevelWidth(
  source: SourceBaseStandard,
  target: TargetBaseStandard,
) {
  const recess = getConversionRecessDimensions(source);
  return Math.max(
    0,
    Math.min(
      BASE_CONVERTER_LIMITS.sideBevelWidth.max,
      (target.width - recess.width) / 2 - MIN_TOP_WALL,
      (target.depth - recess.depth) / 2 - MIN_TOP_WALL,
    ),
  );
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function normalizeBaseConverterParams(
  params: Partial<BaseConverterParams>,
): BaseConverterParams {
  const source = findSourceBaseStandard(params.sourceStandardId)
    ?? findSourceBaseStandard(BASE_CONVERTER_DEFAULTS.sourceStandardId)!;
  const requestedTarget = findTargetBaseStandard(params.targetStandardId);
  const target = requestedTarget && isBaseConversionCompatible(source, requestedTarget)
    ? requestedTarget
    : TARGET_BASE_STANDARDS.find((candidate) =>
        isBaseConversionCompatible(source, candidate),
      ) ?? findTargetBaseStandard(BASE_CONVERTER_DEFAULTS.targetStandardId)!;
  const sideBevelWidth = clamp(
    params.sideBevelWidth,
    BASE_CONVERTER_LIMITS.sideBevelWidth.min,
    BASE_CONVERTER_LIMITS.sideBevelWidth.max,
    BASE_CONVERTER_DEFAULTS.sideBevelWidth,
  );

  return {
    sourceStandardId: source.id,
    targetStandardId: target.id,
    floorThickness: clamp(
      params.floorThickness,
      BASE_CONVERTER_LIMITS.floorThickness.min,
      BASE_CONVERTER_LIMITS.floorThickness.max,
      BASE_CONVERTER_DEFAULTS.floorThickness,
    ),
    recessDepth: clamp(
      params.recessDepth,
      BASE_CONVERTER_LIMITS.recessDepth.min,
      BASE_CONVERTER_LIMITS.recessDepth.max,
      BASE_CONVERTER_DEFAULTS.recessDepth,
    ),
    sideBevelWidth: Math.min(
      sideBevelWidth,
      getMaxBaseConverterSideBevelWidth(source, target),
    ),
  };
}

export function resolveBaseConverterGeometry(params: BaseConverterParams) {
  const normalized = normalizeBaseConverterParams(params);
  const source = findSourceBaseStandard(normalized.sourceStandardId)!;
  const target = findTargetBaseStandard(normalized.targetStandardId)!;
  return {
    params: normalized,
    source,
    target,
    recess: getConversionRecessDimensions(source),
    totalHeight: normalized.floorThickness + normalized.recessDepth,
  };
}
