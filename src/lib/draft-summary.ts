import { calculateTrayDimensions } from "@/lib/tray-model";
import type {
  BaseConverterParams,
  CustomLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import {
  normalizeBaseConverterParams,
  resolveBaseConverterGeometry,
} from "@/lib/base-converter-config";
import type { TrayParams } from "@/types/tray";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { resolveStackableBoxParams } from "@/lib/stackable-box";

export type GridDraftStructureMode =
  | "full"
  | "half-circle"
  | "base-plate-only";

export type DraftSummary =
  | {
      mode: "grid";
      /** 托盘或堆叠盒体结构。 */
      kind: "tray" | "box";
      rows: number;
      columns: number;
      structureMode: GridDraftStructureMode;
      baseSizeLabel: string;
      trayWidth: number;
      trayDepth: number;
      trayHeight?: number;
    }
  | {
      mode: "custom";
      kind: "tray" | "box";
      slotCount: number;
      trayWidth: number;
      trayDepth: number;
      trayHeight?: number;
    }
  | {
      mode: "base-converter";
      sourceLabel: string;
      targetLabel: string;
      trayWidth: number;
      trayDepth: number;
    }
  | {
      mode: "stepped";
      groupCount: number;
      slotCount: number;
      trayWidth: number;
      trayDepth: number;
    };

export type DraftSummaryByMode = {
  [K in DraftSummary["mode"]]: Extract<DraftSummary, { mode: K }>;
};

export type DraftParamsByMode = {
  grid: TrayParams;
  custom: CustomLayoutParams;
  "base-converter": BaseConverterParams;
  stepped: SteppedLayoutParams;
};

function formatBaseSizeLabel(size: number) {
  const rounded = Math.round(size * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}mm`;
}

function getGridStructureMode(params: TrayParams): GridDraftStructureMode {
  if (params.basePlateOnly) {
    return "base-plate-only";
  }
  if (params.halfCircleSlots && (params.rows === 1 || params.columns === 1)) {
    return "half-circle";
  }
  return "full";
}

function buildGridDraftSummary(
  params: TrayParams,
): DraftSummaryByMode["grid"] {
  const box = resolveStackableBoxParams(params.stackableBox);
  if (box.enabled) {
    return {
      mode: "grid",
      kind: "box",
      rows: params.rows,
      columns: params.columns,
      structureMode: getGridStructureMode(params),
      baseSizeLabel: formatBaseSizeLabel(params.holeDiameter),
      trayWidth: box.outerWidth,
      trayDepth: box.outerDepth,
      trayHeight: box.outerHeight,
    };
  }
  const dimensions = calculateTrayDimensions(params);
  return {
    mode: "grid",
    kind: "tray",
    rows: params.rows,
    columns: params.columns,
    structureMode: getGridStructureMode(params),
    baseSizeLabel: formatBaseSizeLabel(params.holeDiameter),
    trayWidth: dimensions.width,
    trayDepth: dimensions.depth,
  };
}

function buildCustomDraftSummary(
  params: CustomLayoutParams,
): DraftSummaryByMode["custom"] {
  const box = resolveStackableBoxParams(params.stackableBox);
  if (box.enabled) {
    return {
      mode: "custom",
      kind: "box",
      slotCount: params.slots.length,
      trayWidth: box.outerWidth,
      trayDepth: box.outerDepth,
      trayHeight: box.outerHeight,
    };
  }
  return {
    mode: "custom",
    kind: "tray",
    slotCount: params.slots.length,
    trayWidth: params.trayWidth,
    trayDepth: params.trayDepth,
  };
}

function buildBaseConverterDraftSummary(
  params: BaseConverterParams,
): DraftSummaryByMode["base-converter"] {
  const normalized = normalizeBaseConverterParams(params);
  if (normalized.generationKind !== "conversion") {
    const profile = normalized.roundBaseSnapshot;
    const sourceLabel = normalized.generationKind === "plain"
      ? "普通底盘"
      : `简版底盘 · 六边孔 ${Number(normalized.pushFitHexHole.acrossFlats.toFixed(3))}mm · X${Number(normalized.pushFitHexHole.offsetX.toFixed(3))} Y${Number(normalized.pushFitHexHole.offsetY.toFixed(3))}`;
    return {
      mode: "base-converter",
      sourceLabel,
      targetLabel: profile.name,
      trayWidth: profile.nominalDiameter,
      trayDepth: profile.nominalDiameter,
    };
  }
  const { source, target } = resolveBaseConverterGeometry(normalized);
  return {
    mode: "base-converter",
    sourceLabel: source.name,
    targetLabel: target.name,
    trayWidth: target.width,
    trayDepth: target.depth,
  };
}

function buildSteppedDraftSummary<M extends "stepped">(
  mode: M,
  params: SteppedLayoutParams,
): DraftSummaryByMode[M] {
  return {
    mode,
    groupCount: params.groups.length,
    slotCount: params.slots.length,
    trayWidth: params.trayWidth,
    trayDepth: params.trayDepth,
  } as DraftSummaryByMode[M];
}

export function buildDraftSummary<M extends keyof DraftParamsByMode>(
  snapshot: ModeParamSnapshot<M>,
): DraftSummaryByMode[M] {
  const { mode, params } = snapshot;
  switch (mode) {
    case "grid":
      return buildGridDraftSummary(params as TrayParams) as DraftSummaryByMode[M];
    case "custom":
      return buildCustomDraftSummary(
        params as CustomLayoutParams,
      ) as DraftSummaryByMode[M];
    case "base-converter":
      return buildBaseConverterDraftSummary(
        params as BaseConverterParams,
      ) as DraftSummaryByMode[M];
    case "stepped":
      return buildSteppedDraftSummary(
        "stepped",
        params as SteppedLayoutParams,
      ) as DraftSummaryByMode[M];
    default: {
      const unreachableMode: never = mode;
      throw new Error(`Unsupported draft mode: ${String(unreachableMode)}`);
    }
  }
}
