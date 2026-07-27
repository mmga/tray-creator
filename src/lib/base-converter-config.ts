import { DEFAULT_ELLIPSE_PROFILE_EXPONENT } from "@/lib/slot-definitions";
import type {
  BaseConverterParams,
  ConversionGeometrySnapshot,
  ConversionSourceGeometrySnapshot,
  ConversionTargetGeometrySnapshot,
} from "@/types/custom-tray";

export interface SourceBaseStandard {
  id: string;
  name: string;
  width: number;
  depth: number;
  cornerRadius: number;
}

export interface TargetBaseStandard {
  id: string;
  name: string;
  shape: "circle" | "ellipse";
  width: number;
  depth: number;
  profileExponent: number;
}

export const CONVERSION_CLEARANCE_PER_SIDE = 0.2;

export const SOURCE_BASE_STANDARDS: SourceBaseStandard[] = [
  { id: "source-20x20", name: "20 × 20mm", width: 20, depth: 20, cornerRadius: 0 },
  { id: "source-25x25", name: "25 × 25mm", width: 25, depth: 25, cornerRadius: 0 },
  { id: "source-40x40", name: "40 × 40mm", width: 40, depth: 40, cornerRadius: 0 },
  { id: "source-25x50", name: "25 × 50mm", width: 25, depth: 50, cornerRadius: 0 },
  { id: "source-50x75", name: "50 × 75mm", width: 50, depth: 75, cornerRadius: 0 },
  { id: "source-50x100", name: "50 × 100mm", width: 50, depth: 100, cornerRadius: 0 },
];

export const TARGET_BASE_STANDARDS: TargetBaseStandard[] = [
  { id: "target-circle-25", name: "Ø25mm", shape: "circle", width: 25, depth: 25, profileExponent: 2 },
  { id: "target-circle-28.5", name: "Ø28.5mm", shape: "circle", width: 28.5, depth: 28.5, profileExponent: 2 },
  { id: "target-circle-32", name: "Ø32mm", shape: "circle", width: 32, depth: 32, profileExponent: 2 },
  { id: "target-circle-40", name: "Ø40mm", shape: "circle", width: 40, depth: 40, profileExponent: 2 },
  { id: "target-circle-50", name: "Ø50mm", shape: "circle", width: 50, depth: 50, profileExponent: 2 },
  { id: "target-ellipse-35x60", name: "35 × 60mm", shape: "ellipse", width: 35, depth: 60, profileExponent: 2.05 },
  { id: "target-ellipse-42x75", name: "42 × 75mm", shape: "ellipse", width: 42, depth: 75, profileExponent: 2.08 },
  { id: "target-ellipse-70x105", name: "70 × 105mm", shape: "ellipse", width: 70, depth: 105, profileExponent: DEFAULT_ELLIPSE_PROFILE_EXPONENT },
];

export const BASE_CONVERTER_LIMITS = {
  conversionClearance: { min: 0, max: 1, step: 0.05, label: "单边装配间隙", unit: "mm" },
  floorThickness: { min: 0.8, max: 5, step: 0.1, label: "底部保留厚度", unit: "mm" },
  recessDepth: { min: 0.5, max: 5, step: 0.1, label: "凹槽深度 / 挡边高度", unit: "mm" },
  sideBevelWidth: { min: 0, max: 10, step: 0.5, label: "侧面斜面宽度", unit: "mm" },
} as const;

export function findSourceBaseStandard(id: string | undefined) {
  return SOURCE_BASE_STANDARDS.find((standard) => standard.id === id);
}

export function findTargetBaseStandard(id: string | undefined) {
  return TARGET_BASE_STANDARDS.find((standard) => standard.id === id);
}

function snapshotSource(source: SourceBaseStandard): ConversionSourceGeometrySnapshot {
  return {
    standardId: source.id,
    name: source.name,
    shape: "rectangle",
    nominalWidth: source.width,
    nominalDepth: source.depth,
    fitWidth: source.width,
    fitDepth: source.depth,
    cornerRadius: source.cornerRadius,
  };
}

function snapshotTarget(target: TargetBaseStandard): ConversionTargetGeometrySnapshot {
  return {
    standardId: target.id,
    name: target.name,
    shape: target.shape,
    width: target.width,
    depth: target.depth,
    profileExponent: target.profileExponent,
  };
}

export function createConversionGeometrySnapshot(
  source: SourceBaseStandard,
  target: TargetBaseStandard,
): ConversionGeometrySnapshot {
  return {
    source: snapshotSource(source),
    target: snapshotTarget(target),
  };
}

const DEFAULT_SOURCE = SOURCE_BASE_STANDARDS[0];
const DEFAULT_TARGET = TARGET_BASE_STANDARDS[0];

export const BASE_CONVERTER_DEFAULTS: BaseConverterParams = {
  sourceStandardId: DEFAULT_SOURCE.id,
  targetStandardId: DEFAULT_TARGET.id,
  geometrySnapshot: createConversionGeometrySnapshot(DEFAULT_SOURCE, DEFAULT_TARGET),
  conversionClearance: CONVERSION_CLEARANCE_PER_SIDE,
  floorThickness: 1.2,
  recessDepth: 2,
  sideBevelWidth: 0,
};

export function getConversionRecessDimensions(
  source:
    | Pick<ConversionSourceGeometrySnapshot, "fitWidth" | "fitDepth" | "cornerRadius">
    | Pick<SourceBaseStandard, "width" | "depth" | "cornerRadius">,
  clearance = CONVERSION_CLEARANCE_PER_SIDE,
) {
  const fitWidth = "fitWidth" in source ? source.fitWidth : source.width;
  const fitDepth = "fitDepth" in source ? source.fitDepth : source.depth;
  return {
    width: fitWidth + clearance * 2,
    depth: fitDepth + clearance * 2,
    cornerRadius: source.cornerRadius + clearance,
  };
}

export function isBaseConversionCompatible(
  source:
    | Pick<ConversionSourceGeometrySnapshot, "fitWidth" | "fitDepth" | "cornerRadius">
    | Pick<SourceBaseStandard, "width" | "depth" | "cornerRadius">,
  target: Pick<ConversionTargetGeometrySnapshot, "width" | "depth">,
  clearance = CONVERSION_CLEARANCE_PER_SIDE,
) {
  const recess = getConversionRecessDimensions(source, clearance);
  return recess.width < target.width && recess.depth < target.depth;
}

function normalizeFinite(
  value: unknown,
  predicate: (value: number) => boolean,
  fallback: number,
) {
  return typeof value === "number" && Number.isFinite(value) && predicate(value)
    ? value
    : fallback;
}

function hasMatchingSnapshot(
  snapshot: ConversionGeometrySnapshot | undefined,
  sourceId: string,
  targetId: string,
): snapshot is ConversionGeometrySnapshot {
  return snapshot?.source.standardId === sourceId
    && snapshot.target.standardId === targetId;
}

export function normalizeBaseConverterParams(
  params: Partial<BaseConverterParams>,
): BaseConverterParams {
  const source = findSourceBaseStandard(params.sourceStandardId) ?? DEFAULT_SOURCE;
  const target = findTargetBaseStandard(params.targetStandardId) ?? DEFAULT_TARGET;
  const geometrySnapshot = hasMatchingSnapshot(
    params.geometrySnapshot,
    source.id,
    target.id,
  )
    ? params.geometrySnapshot
    : createConversionGeometrySnapshot(source, target);

  return {
    sourceStandardId: source.id,
    targetStandardId: target.id,
    geometrySnapshot,
    conversionClearance: normalizeFinite(
      params.conversionClearance,
      (value) => value >= 0,
      BASE_CONVERTER_DEFAULTS.conversionClearance,
    ),
    floorThickness: normalizeFinite(
      params.floorThickness,
      (value) => value > 0,
      BASE_CONVERTER_DEFAULTS.floorThickness,
    ),
    recessDepth: normalizeFinite(
      params.recessDepth,
      (value) => value > 0,
      BASE_CONVERTER_DEFAULTS.recessDepth,
    ),
    sideBevelWidth: normalizeFinite(
      params.sideBevelWidth,
      (value) => value >= 0,
      BASE_CONVERTER_DEFAULTS.sideBevelWidth,
    ),
  };
}

export function resolveBaseConverterGeometry(params: BaseConverterParams) {
  const normalized = normalizeBaseConverterParams(params);
  const source = normalized.geometrySnapshot.source;
  const target = normalized.geometrySnapshot.target;
  return {
    params: normalized,
    source,
    target,
    recess: getConversionRecessDimensions(source, normalized.conversionClearance),
    totalHeight: normalized.floorThickness + normalized.recessDepth,
    compatible: isBaseConversionCompatible(
      source,
      target,
      normalized.conversionClearance,
    ),
  };
}

export function validateBaseConverterParams(
  params: BaseConverterParams,
): string | null {
  const { params: normalized, source, target, recess, compatible } =
    resolveBaseConverterGeometry(params);

  if (
    !Number.isFinite(source.fitWidth)
    || !Number.isFinite(source.fitDepth)
    || !Number.isFinite(source.cornerRadius)
    || source.fitWidth <= 0
    || source.fitDepth <= 0
    || source.cornerRadius < 0
    || source.cornerRadius > Math.min(source.fitWidth, source.fitDepth) / 2
  ) {
    return "源底座尺寸或圆角无效";
  }
  if (
    !Number.isFinite(target.width)
    || !Number.isFinite(target.depth)
    || !Number.isFinite(target.profileExponent)
    || target.width <= 0
    || target.depth <= 0
    || target.profileExponent <= 0
  ) {
    return "目标底座尺寸或丰满度无效";
  }
  if (
    normalized.floorThickness <= 0
    || normalized.recessDepth <= 0
    || normalized.conversionClearance < 0
    || normalized.sideBevelWidth < 0
  ) {
    return "转换底盘厚度、深度、间隙或斜面参数无效";
  }
  if (
    normalized.sideBevelWidth >= target.width / 2
    || normalized.sideBevelWidth >= target.depth / 2
  ) {
    return "侧面斜面过大，顶面轮廓已消失";
  }
  if (
    recess.cornerRadius > Math.min(recess.width, recess.depth) / 2
  ) {
    return "源底座圆角与间隙形成的凹槽无效";
  }
  if (!compatible) {
    return "源底座凹槽不小于目标底座，无法生成 3D 模型";
  }
  return null;
}
