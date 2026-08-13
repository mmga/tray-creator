import { DEFAULT_ELLIPSE_PROFILE_EXPONENT } from "@/lib/slot-definitions";
import { validatePushFitHexHolePlacement } from "@/lib/push-fit-hex-hole";
import { ROUND_BASE_SHELL_THICKNESS } from "@/lib/round-base-profile";
import type {
  BaseGenerationKind,
  BaseConverterParams,
  ConversionGeometrySnapshot,
  ConversionSourceGeometrySnapshot,
  ConversionTargetGeometrySnapshot,
  RoundBaseProfileSnapshot,
} from "@/types/custom-tray";

export type RoundBaseStandard = RoundBaseProfileSnapshot;

export interface SourceBaseStandard {
  id: string;
  name: string;
  shape: "rectangle" | "circle";
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

export const ROUND_BASE_STANDARDS: RoundBaseStandard[] = [
  { standardId: "round-25", name: "Ø25mm", nominalDiameter: 25, height: 4, topInset: 1.5 },
  { standardId: "round-28.5", name: "Ø28.5mm", nominalDiameter: 28.5, height: 4, topInset: 1.5 },
  { standardId: "round-32", name: "Ø32mm", nominalDiameter: 32, height: 4, topInset: 1.5 },
  { standardId: "round-40", name: "Ø40mm", nominalDiameter: 40, height: 4, topInset: 1.5 },
  { standardId: "round-50", name: "Ø50mm", nominalDiameter: 50, height: 4, topInset: 1.5 },
];

export const CONVERSION_CLEARANCE_PER_SIDE = 0.2;

export const SOURCE_BASE_STANDARDS: SourceBaseStandard[] = [
  { id: "source-20x20", name: "20 × 20mm", shape: "rectangle", width: 20, depth: 20, cornerRadius: 0 },
  { id: "source-25x25", name: "25 × 25mm", shape: "rectangle", width: 25, depth: 25, cornerRadius: 0 },
  { id: "source-40x40", name: "40 × 40mm", shape: "rectangle", width: 40, depth: 40, cornerRadius: 0 },
  { id: "source-25x50", name: "25 × 50mm", shape: "rectangle", width: 25, depth: 50, cornerRadius: 0 },
  { id: "source-50x75", name: "50 × 75mm", shape: "rectangle", width: 50, depth: 75, cornerRadius: 0 },
  { id: "source-50x100", name: "50 × 100mm", shape: "rectangle", width: 50, depth: 100, cornerRadius: 0 },
  { id: "source-circle-20", name: "Ø20mm", shape: "circle", width: 20, depth: 20, cornerRadius: 0 },
  { id: "source-circle-25", name: "Ø25mm", shape: "circle", width: 25, depth: 25, cornerRadius: 0 },
  { id: "source-circle-28.5", name: "Ø28.5mm", shape: "circle", width: 28.5, depth: 28.5, cornerRadius: 0 },
  { id: "source-circle-32", name: "Ø32mm", shape: "circle", width: 32, depth: 32, cornerRadius: 0 },
  { id: "source-circle-40", name: "Ø40mm", shape: "circle", width: 40, depth: 40, cornerRadius: 0 },
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

export function snapshotSourceStandard(
  source: SourceBaseStandard,
): ConversionSourceGeometrySnapshot {
  return {
    standardId: source.id,
    name: source.name,
    shape: source.shape,
    nominalWidth: source.width,
    nominalDepth: source.depth,
    fitWidth: source.width,
    fitDepth: source.depth,
    cornerRadius: source.cornerRadius,
  };
}

export function snapshotTargetStandard(
  target: TargetBaseStandard,
): ConversionTargetGeometrySnapshot {
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
    source: snapshotSourceStandard(source),
    target: snapshotTargetStandard(target),
  };
}

const DEFAULT_SOURCE = SOURCE_BASE_STANDARDS[0];
const DEFAULT_TARGET = TARGET_BASE_STANDARDS[0];
const DEFAULT_ROUND_BASE = ROUND_BASE_STANDARDS[2];

export const BASE_CONVERTER_DEFAULTS: BaseConverterParams = {
  generationKind: "conversion",
  roundBaseStandardId: DEFAULT_ROUND_BASE.standardId,
  roundBaseSnapshot: { ...DEFAULT_ROUND_BASE },
  pushFitHexHole: {
    acrossFlats: 3.6,
    offsetX: 7,
    offsetY: 5,
  },
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

const MIN_TOP_WALL = 0.1;

export function getMaxBaseConverterSideBevelWidth(
  source:
    | Pick<ConversionSourceGeometrySnapshot, "fitWidth" | "fitDepth" | "cornerRadius">
    | Pick<SourceBaseStandard, "width" | "depth" | "cornerRadius">,
  target: Pick<ConversionTargetGeometrySnapshot, "width" | "depth">,
  clearance = CONVERSION_CLEARANCE_PER_SIDE,
) {
  const recess = getConversionRecessDimensions(source, clearance);
  return Math.max(
    0,
    Math.min(
      BASE_CONVERTER_LIMITS.sideBevelWidth.max,
      (target.width - recess.width) / 2 - MIN_TOP_WALL,
      (target.depth - recess.depth) / 2 - MIN_TOP_WALL,
    ),
  );
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

function sourceSnapshotMatchesId(
  source: ConversionSourceGeometrySnapshot | undefined,
  id: string | undefined,
) {
  return source?.standardId === id || source?.customId === id;
}

function targetSnapshotMatchesId(
  target: ConversionTargetGeometrySnapshot | undefined,
  id: string | undefined,
) {
  return target?.standardId === id || target?.customId === id;
}

function normalizeGenerationKind(value: unknown): BaseGenerationKind {
  return value === "plain" || value === "push-fit" || value === "conversion"
    ? value
    : "conversion";
}

export function findRoundBaseStandard(id: unknown) {
  return typeof id === "string"
    ? ROUND_BASE_STANDARDS.find((standard) => standard.standardId === id)
    : undefined;
}

function normalizeRoundBaseSnapshot(
  value: Partial<RoundBaseProfileSnapshot> | undefined,
  selected: RoundBaseStandard,
): RoundBaseProfileSnapshot {
  if (value?.standardId !== selected.standardId) {
    return { ...selected };
  }
  return {
    standardId: selected.standardId,
    name: typeof value.name === "string" && value.name.trim()
      ? value.name
      : selected.name,
    nominalDiameter: normalizeFinite(
      value.nominalDiameter,
      () => true,
      selected.nominalDiameter,
    ),
    height: normalizeFinite(value.height, () => true, selected.height),
    topInset: normalizeFinite(value.topInset, () => true, selected.topInset),
  };
}

export function normalizeBaseConverterParams(
  params: Partial<BaseConverterParams>,
): BaseConverterParams {
  const sourceStandard = findSourceBaseStandard(params.sourceStandardId);
  const targetStandard = findTargetBaseStandard(params.targetStandardId);
  const sourceSnapshot = sourceSnapshotMatchesId(
    params.geometrySnapshot?.source,
    params.sourceStandardId,
  )
    ? params.geometrySnapshot!.source
    : snapshotSourceStandard(sourceStandard ?? DEFAULT_SOURCE);
  const targetSnapshot = targetSnapshotMatchesId(
    params.geometrySnapshot?.target,
    params.targetStandardId,
  )
    ? params.geometrySnapshot!.target
    : snapshotTargetStandard(targetStandard ?? DEFAULT_TARGET);
  const roundBaseStandard = findRoundBaseStandard(params.roundBaseStandardId)
    ?? findRoundBaseStandard(params.roundBaseSnapshot?.standardId)
    ?? DEFAULT_ROUND_BASE;

  return {
    generationKind: normalizeGenerationKind(params.generationKind),
    roundBaseStandardId: roundBaseStandard.standardId,
    roundBaseSnapshot: normalizeRoundBaseSnapshot(
      params.roundBaseSnapshot,
      roundBaseStandard,
    ),
    pushFitHexHole: {
      acrossFlats: normalizeFinite(
        params.pushFitHexHole?.acrossFlats,
        () => true,
        BASE_CONVERTER_DEFAULTS.pushFitHexHole.acrossFlats,
      ),
      offsetX: normalizeFinite(
        params.pushFitHexHole?.offsetX,
        () => true,
        BASE_CONVERTER_DEFAULTS.pushFitHexHole.offsetX,
      ),
      offsetY: normalizeFinite(
        params.pushFitHexHole?.offsetY,
        () => true,
        BASE_CONVERTER_DEFAULTS.pushFitHexHole.offsetY,
      ),
    },
    sourceStandardId: sourceStandard?.id
      ?? sourceSnapshot.customId
      ?? DEFAULT_SOURCE.id,
    targetStandardId: targetStandard?.id
      ?? targetSnapshot.customId
      ?? DEFAULT_TARGET.id,
    geometrySnapshot: {
      source: sourceSnapshot,
      target: targetSnapshot,
    },
    conversionClearance: normalizeFinite(
      params.conversionClearance,
      () => true,
      BASE_CONVERTER_DEFAULTS.conversionClearance,
    ),
    floorThickness: normalizeFinite(
      params.floorThickness,
      () => true,
      BASE_CONVERTER_DEFAULTS.floorThickness,
    ),
    recessDepth: normalizeFinite(
      params.recessDepth,
      () => true,
      BASE_CONVERTER_DEFAULTS.recessDepth,
    ),
    sideBevelWidth: normalizeFinite(
      params.sideBevelWidth,
      () => true,
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
  const normalizedParams = normalizeBaseConverterParams(params);
  if (normalizedParams.generationKind !== "conversion") {
    const profile = normalizedParams.roundBaseSnapshot;
    if (!Number.isFinite(profile.nominalDiameter) || profile.nominalDiameter <= 0) {
      return "圆形底盘直径无效";
    }
    if (!Number.isFinite(profile.height) || profile.height <= 0) {
      return "圆形底盘高度无效";
    }
    if (profile.height <= ROUND_BASE_SHELL_THICKNESS) {
      return `圆形底盘高度必须大于 ${ROUND_BASE_SHELL_THICKNESS}mm 壳厚`;
    }
    if (!Number.isFinite(profile.topInset) || profile.topInset < 0) {
      return "圆形底盘顶部内缩无效";
    }
    if (profile.topInset * 2 >= profile.nominalDiameter) {
      return "圆形底盘顶部内缩过大，顶部轮廓已消失";
    }
    if (normalizedParams.generationKind === "push-fit") {
      const hole = normalizedParams.pushFitHexHole;
      if (!Number.isFinite(hole.acrossFlats) || hole.acrossFlats <= 0) {
        return "简版六边形孔尺寸无效";
      }
      if (!Number.isFinite(hole.offsetX) || !Number.isFinite(hole.offsetY)) {
        return "简版六边形孔位置无效";
      }
      const placementError = validatePushFitHexHolePlacement(profile, hole);
      if (placementError) return placementError;
    }
    return null;
  }
  const { params: normalized, source, target, recess, compatible } =
    resolveBaseConverterGeometry(normalizedParams);

  if (
    (source.shape !== "rectangle" && source.shape !== "circle")
    || !Number.isFinite(source.nominalWidth)
    || !Number.isFinite(source.nominalDepth)
    || !Number.isFinite(source.fitWidth)
    || !Number.isFinite(source.fitDepth)
    || !Number.isFinite(source.cornerRadius)
    || source.nominalWidth <= 0
    || source.nominalDepth <= 0
    || source.fitWidth <= 0
    || source.fitDepth <= 0
    || source.cornerRadius < 0
    || (source.shape === "rectangle"
      && source.cornerRadius > Math.min(source.fitWidth, source.fitDepth) / 2)
  ) {
    return "源底座尺寸或圆角无效";
  }
  if (
    (target.shape !== "circle" && target.shape !== "ellipse")
    || !Number.isFinite(target.width)
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
    normalized.sideBevelWidth > getMaxBaseConverterSideBevelWidth(
      source,
      target,
      normalized.conversionClearance,
    )
  ) {
    return "侧面斜面过大，顶面凹槽侧壁不足";
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
