import { MAX_BUILD_SIZE } from "@/lib/config";
import { calculateCustomTrayFootprint } from "@/lib/custom-layout-math";
import type { ConstructedSteppedContouredFootprints } from "@/lib/stepped-contoured-footprint";
import type { ConstructedContouredFootprint } from "@/lib/contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import { calculateTrayDimensions } from "@/lib/tray-model";
import {
  normalizeBaseConverterParams,
  resolveBaseConverterGeometry,
} from "@/lib/base-converter-config";
import type {
  BaseGenerationKind,
  BaseConverterParams,
  CustomBaseplateFootprintStyle,
  CustomLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { StackableBoxParams, TrayParams } from "@/types/tray";
import {
  calculateBoxHeightProjection,
  resolveStackableBoxParams,
} from "@/lib/stackable-box";

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

/** 盒体开启时的结构投影。 */
export interface BoxResultProjection {
  outerWidth: number;
  outerDepth: number;
  outerHeight: number;
  closedOuterHeight: number;
  lidClearHeight: number;
  stackClearHeight: number;
  xyFitClearance: number;
  bodyWeight: TrayResultWeight;
  lidWeight: TrayResultWeight;
}

interface TrayResultProjectionBase {
  slotCount: number;
  itemLabel: string;
  dimensions: TrayResultDimensions;
  weight: TrayResultWeight;
  buildLimit: TrayResultBuildLimit;
  generating: boolean;
  stale: boolean;
  footprintWarnings?: readonly string[];
  box?: BoxResultProjection;
}

export interface GridTrayResultProjection extends TrayResultProjectionBase {
  mode: "grid";
  rows: number;
  columns: number;
  footprintArea: number;
}

export interface CustomTrayResultProjection extends TrayResultProjectionBase {
  mode: "custom";
  footprintStyle: CustomBaseplateFootprintStyle;
  sizingMode: "auto" | "fixed";
  footprintKind: "effective-baseplate" | "fixed-outer-footprint" | "contoured-footprint" | "polygonal-footprint";
  /** contoured footprint 产生的独立可打印实体数；rectangular 时为 1（或 0 当无槽）。 */
  contourBodyCount: number;
  polygonSideCount?: number;
  footprintArea: number;
}

export interface BaseConverterResultProjection extends TrayResultProjectionBase {
  mode: "base-converter";
  generationKind: BaseGenerationKind;
  sourceLabel: string;
  targetLabel: string;
  recess: { width: number; depth: number };
  hole: BaseConverterParams["pushFitHexHole"] | null;
}

export interface SteppedTrayResultProjection extends TrayResultProjectionBase {
  mode: "stepped";
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
  | SteppedTrayResultProjection;

export function projectBaseConverterResult(
  params: BaseConverterParams,
  state: ResultState,
): BaseConverterResultProjection {
  const normalized = normalizeBaseConverterParams(params);
  if (normalized.generationKind !== "conversion") {
    const profile = normalized.roundBaseSnapshot;
    const isPushFit = normalized.generationKind === "push-fit";
    const hole = isPushFit ? normalized.pushFitHexHole : null;
    const itemLabel = isPushFit
      ? `简版底盘 · ${profile.name} · 六边孔 ${Number(hole!.acrossFlats.toFixed(3))}mm`
      : `普通底盘 · ${profile.name}`;
    return {
      mode: "base-converter",
      generationKind: normalized.generationKind,
      slotCount: 1,
      itemLabel,
      ...projectCommon({
        width: profile.nominalDiameter,
        depth: profile.nominalDiameter,
        height: profile.height,
      }, state),
      sourceLabel: isPushFit ? "简版底盘" : "普通底盘",
      targetLabel: profile.name,
      recess: { width: 0, depth: 0 },
      hole,
    };
  }
  const { source, target, recess, totalHeight } =
    resolveBaseConverterGeometry(normalized);
  return {
    mode: "base-converter",
    generationKind: "conversion",
    slotCount: 1,
    itemLabel: `${source.name} → ${target.name}`,
    ...projectCommon(
      { width: target.width, depth: target.depth, height: totalHeight },
      state,
    ),
    sourceLabel: source.name,
    targetLabel: target.name,
    recess,
    hole: null,
  };
}

interface ResultState {
  volume: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  bodyVolume?: number;
  lidVolume?: number;
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

function projectBox(
  box: StackableBoxParams,
  baseThickness: number,
  holeDepth: number,
  basePlateOnly: boolean,
  state: ResultState,
): BoxResultProjection {
  const height = calculateBoxHeightProjection(
    box,
    baseThickness,
    holeDepth,
    basePlateOnly,
  );
  return {
    outerWidth: box.outerWidth,
    outerDepth: box.outerDepth,
    outerHeight: box.outerHeight,
    closedOuterHeight: height.closedOuterHeight,
    lidClearHeight: height.lidClearHeight,
    stackClearHeight: height.stackClearHeight,
    xyFitClearance: box.xyFitClearance,
    bodyWeight: projectWeight(state.bodyVolume ?? 0),
    lidWeight: projectWeight(state.lidVolume ?? 0),
  };
}

export function projectGridTrayResult(
  params: TrayParams,
  state: ResultState,
): GridTrayResultProjection {
  const box = resolveStackableBoxParams(params.stackableBox);
  const dimensions = box.enabled
    ? {
        width: box.outerWidth,
        depth: box.outerDepth,
        height: box.outerHeight,
      }
    : calculateTrayDimensions(params);
  const slotCount = params.rows * params.columns;
  const common = projectCommon(dimensions, state);
  return {
    mode: "grid",
    slotCount,
    itemLabel: box.enabled ? "堆叠盒体" : `${slotCount} 个凹槽`,
    ...common,
    rows: params.rows,
    columns: params.columns,
    footprintArea: finiteOrZero(common.dimensions.width * common.dimensions.depth),
    box: box.enabled
      ? projectBox(
          box,
          params.baseThickness,
          params.holeDepth,
          params.basePlateOnly,
          state,
        )
      : undefined,
  };
}

export function projectCustomTrayResult(
  params: CustomLayoutParams,
  effectiveDimensions: { width: number; depth: number },
  state: ResultState,
  contouredState: ContouredFootprintState<ConstructedContouredFootprint> = {
    status: "inactive",
  },
): CustomTrayResultProjection {
  const footprint = calculateCustomTrayFootprint(params, contouredState);
  const box = resolveStackableBoxParams(params.stackableBox);
  const modelDimensions = box.enabled
    ? {
        width: box.outerWidth,
        depth: box.outerDepth,
        height: box.outerHeight,
      }
    : {
        width: footprint.width,
        depth: footprint.depth,
        height: params.baseThickness + params.holeDepth,
      };
  const footprintStyle = footprint.footprintStyle;
  const sizingMode = footprint.sizingMode;

  // contoured 时尺寸完全由派生轮廓外接框决定，忽略 effectiveDimensions 上游计算（避免双轨）
  const width = box.enabled
    ? box.outerWidth
    : footprintStyle !== "rectangular"
      ? (footprint.width > 0 ? footprint.width : params.trayWidth)
      : sizingMode === "fixed"
        ? modelDimensions.width
        : effectiveDimensions.width > 0
          ? effectiveDimensions.width
          : params.trayWidth;
  const depth = box.enabled
    ? box.outerDepth
    : footprintStyle !== "rectangular"
      ? (footprint.depth > 0 ? footprint.depth : params.trayDepth)
      : sizingMode === "fixed"
        ? modelDimensions.depth
        : effectiveDimensions.depth > 0
          ? effectiveDimensions.depth
          : params.trayDepth;
  const common = projectCommon(
    { width, depth, height: modelDimensions.height },
    state,
  );

  const footprintKind =
    footprintStyle === "polygonal" ? ("polygonal-footprint" as const)
    : footprintStyle === "contoured"
      ? ("contoured-footprint" as const)
      : sizingMode === "fixed"
        ? ("fixed-outer-footprint" as const)
        : ("effective-baseplate" as const);

  return {
    mode: "custom",
    slotCount: params.slots.length,
    itemLabel: box.enabled ? "堆叠盒体" : `${params.slots.length} 个凹槽`,
    ...common,
    footprintStyle,
    sizingMode,
    footprintKind,
    contourBodyCount: footprint.contourBodyCount,
    ...(footprintStyle === "polygonal" && contouredState.status === "ready"
      ? { polygonSideCount: contouredState.value.polygonSideCount } : {}),
    footprintArea: finiteOrZero(common.dimensions.width * common.dimensions.depth),
    box: box.enabled
      ? projectBox(box, params.baseThickness, params.holeDepth, false, state)
      : undefined,
    footprintWarnings: contouredState.status === "failed"
      ? [contouredState.error.message]
      : contouredState.status === "ready"
        ? contouredState.value.diagnostics.map((diagnostic) => diagnostic.message)
        : undefined,
  };
}

export function projectSteppedTrayResult(
  mode: "stepped",
  params: SteppedLayoutParams,
  effectiveDimensions: { width: number; depth: number },
  state: ResultState,
  contouredState: ContouredFootprintState<ConstructedSteppedContouredFootprints>,
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
    footprintWarnings: contouredState.status === "failed"
      ? [contouredState.error.message]
      : contouredState.status === "ready"
        ? contouredState.value.diagnostics.map(
            (diagnostic) => diagnostic.message,
          )
        : undefined,
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
