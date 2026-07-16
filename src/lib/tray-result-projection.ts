import { MAX_BUILD_SIZE } from "@/lib/config";
import { calculateCustomTrayDimensions } from "@/lib/custom-tray-model";
import type { SimpleSteppedDerivedLayout } from "@/lib/simple-stepped-layout";
import { calculateTrayDimensions } from "@/lib/tray-model";
import { resolveBaseConverterGeometry } from "@/lib/base-converter-config";
import type {
  BaseConverterParams,
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";

export interface TrayResultDimensions {
  width: number;
  depth: number;
  height: number;
}

export type TrayResultWeight =
  | { status: "available"; grams: number }
  | { status: "unavailable" };

export interface TrayResultBuildLimit {
  maxSize: number;
  oversized: boolean;
  widthExceeded: boolean;
  depthExceeded: boolean;
}

interface TrayResultProjectionBase {
  slotCount: number;
  itemLabel: string;
  dimensions: TrayResultDimensions;
  weight: TrayResultWeight;
  buildLimit: TrayResultBuildLimit;
  generating: boolean;
  stale: boolean;
}

export interface GridTrayResultProjection extends TrayResultProjectionBase {
  mode: "grid";
  rows: number;
  columns: number;
  footprintArea: number;
}

export interface CustomTrayResultProjection extends TrayResultProjectionBase {
  mode: "custom";
  sizingMode: "auto" | "fixed";
  footprintKind: "effective-baseplate" | "fixed-outer-footprint";
  footprintArea: number;
}

export interface SimpleSteppedTrayResultProjection
  extends TrayResultProjectionBase {
  mode: "simple-stepped";
  rowCount: number;
  activeRowCount: number;
  minimumBaseplate: { width: number; depth: number };
}

export interface BaseConverterResultProjection extends TrayResultProjectionBase {
  mode: "base-converter";
  sourceLabel: string;
  targetLabel: string;
  recess: { width: number; depth: number };
}

export interface SteppedTrayResultProjection extends TrayResultProjectionBase {
  mode: "stepped" | "stepped-cad";
  groupCount: number;
  groups: Array<{
    id: string;
    name: string;
    color: string;
    bottomHeight: number;
    slotCount: number;
  }>;
}

export type TrayResultProjection =
  | GridTrayResultProjection
  | CustomTrayResultProjection
  | BaseConverterResultProjection
  | SimpleSteppedTrayResultProjection
  | SteppedTrayResultProjection;

export function projectBaseConverterResult(
  params: BaseConverterParams,
  state: ResultState,
): BaseConverterResultProjection {
  const { source, target, recess, totalHeight } =
    resolveBaseConverterGeometry(params);
  return {
    mode: "base-converter",
    slotCount: 1,
    itemLabel: `${source.name} → ${target.name}`,
    ...projectCommon(
      { width: target.width, depth: target.depth, height: totalHeight },
      state,
    ),
    sourceLabel: source.name,
    targetLabel: target.name,
    recess,
  };
}

interface ResultState {
  volume: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function normalizeDimensions(
  dimensions: TrayResultDimensions,
): TrayResultDimensions {
  return {
    width: finiteOrZero(dimensions.width),
    depth: finiteOrZero(dimensions.depth),
    height: finiteOrZero(dimensions.height),
  };
}

function projectWeight(volume: number): TrayResultWeight {
  if (!Number.isFinite(volume) || volume <= 0) {
    return { status: "unavailable" };
  }
  const grams = (volume / 1000) * 1.24 * 0.6;
  return { status: "available", grams: finiteOrZero(grams) };
}

function projectBuildLimit(
  dimensions: TrayResultDimensions,
): TrayResultBuildLimit {
  const widthExceeded = dimensions.width > MAX_BUILD_SIZE;
  const depthExceeded = dimensions.depth > MAX_BUILD_SIZE;
  return {
    maxSize: MAX_BUILD_SIZE,
    oversized: widthExceeded || depthExceeded,
    widthExceeded,
    depthExceeded,
  };
}

function projectCommon(
  dimensionsInput: TrayResultDimensions,
  state: ResultState,
) {
  const dimensions = normalizeDimensions(dimensionsInput);
  return {
    dimensions,
    weight: projectWeight(state.volume),
    buildLimit: projectBuildLimit(dimensions),
    generating: state.isGenerating,
    stale: state.isPreviewStale,
  };
}

export function projectGridTrayResult(
  params: TrayParams,
  state: ResultState,
): GridTrayResultProjection {
  const dimensions = calculateTrayDimensions(params);
  const slotCount = params.rows * params.columns;
  const common = projectCommon(dimensions, state);
  return {
    mode: "grid",
    slotCount,
    itemLabel: `${slotCount} 个凹槽`,
    ...common,
    rows: params.rows,
    columns: params.columns,
    footprintArea: finiteOrZero(common.dimensions.width * common.dimensions.depth),
  };
}

export function projectCustomTrayResult(
  params: CustomLayoutParams,
  effectiveDimensions: { width: number; depth: number },
  state: ResultState,
): CustomTrayResultProjection {
  const modelDimensions = calculateCustomTrayDimensions(params);
  const sizingMode = params.traySizingMode === "fixed" ? "fixed" : "auto";
  const width =
    sizingMode === "fixed"
      ? modelDimensions.width
      : effectiveDimensions.width > 0
        ? effectiveDimensions.width
        : params.trayWidth;
  const depth =
    sizingMode === "fixed"
      ? modelDimensions.depth
      : effectiveDimensions.depth > 0
        ? effectiveDimensions.depth
        : params.trayDepth;
  const common = projectCommon(
    { width, depth, height: modelDimensions.height },
    state,
  );
  return {
    mode: "custom",
    slotCount: params.slots.length,
    itemLabel: `${params.slots.length} 个凹槽`,
    ...common,
    sizingMode,
    footprintKind:
      sizingMode === "fixed"
        ? "fixed-outer-footprint"
        : "effective-baseplate",
    footprintArea: finiteOrZero(common.dimensions.width * common.dimensions.depth),
  };
}

export function projectSimpleSteppedTrayResult(
  params: SimpleSteppedLayoutParams,
  derivedLayout: SimpleSteppedDerivedLayout,
  effectiveDimensions: TrayResultDimensions,
  state: ResultState,
): SimpleSteppedTrayResultProjection {
  const common = projectCommon(effectiveDimensions, state);
  return {
    mode: "simple-stepped",
    slotCount: params.slots.length,
    itemLabel: `${params.rows.length} 行 · ${params.slots.length} 槽`,
    ...common,
    rowCount: params.rows.length,
    activeRowCount: derivedLayout.activeRows.length,
    minimumBaseplate: {
      width: finiteOrZero(derivedLayout.minimumTrayWidth),
      depth: finiteOrZero(derivedLayout.minimumTrayDepth),
    },
  };
}

export function projectSteppedTrayResult(
  mode: "stepped" | "stepped-cad",
  params: SteppedLayoutParams,
  effectiveDimensions: { width: number; depth: number },
  state: ResultState,
): SteppedTrayResultProjection {
  const height =
    params.groups.length > 0
      ? Math.max(
          ...params.groups.map((group) => Math.max(group.bottomHeight, 3)),
        )
      : 0;
  const common = projectCommon(
    { ...effectiveDimensions, height },
    state,
  );
  const slotCounts = new Map<string, number>();
  params.slots.forEach((slot) => {
    slotCounts.set(slot.groupId, (slotCounts.get(slot.groupId) ?? 0) + 1);
  });
  return {
    mode,
    slotCount: params.slots.length,
    itemLabel: `${params.groups.length} 组 · ${params.slots.length} 槽`,
    ...common,
    groupCount: params.groups.length,
    groups: params.groups.map((group) => ({
      id: group.id,
      name: group.name,
      color: group.color,
      bottomHeight: finiteOrZero(group.bottomHeight),
      slotCount: slotCounts.get(group.id) ?? 0,
    })),
  };
}
