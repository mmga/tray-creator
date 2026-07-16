import { calculateSimpleSteppedDimensions } from "@/lib/simple-stepped-layout";
import { calculateTrayDimensions } from "@/lib/tray-model";
import type {
  BaseConverterParams,
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import { resolveBaseConverterGeometry } from "@/lib/base-converter-config";
import type { TrayParams } from "@/types/tray";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";

export type GridDraftStructureMode =
  | "full"
  | "half-circle"
  | "base-plate-only";

export type DraftSummary =
  | {
      mode: "grid";
      rows: number;
      columns: number;
      structureMode: GridDraftStructureMode;
      baseSizeLabel: string;
      trayWidth: number;
      trayDepth: number;
    }
  | {
      mode: "custom";
      slotCount: number;
      trayWidth: number;
      trayDepth: number;
    }
  | {
      mode: "base-converter";
      sourceLabel: string;
      targetLabel: string;
      trayWidth: number;
      trayDepth: number;
    }
  | {
      mode: "simple-stepped";
      rowCount: number;
      slotCount: number;
      trayWidth: number;
      trayDepth: number;
    }
  | {
      mode: "stepped";
      groupCount: number;
      slotCount: number;
      trayWidth: number;
      trayDepth: number;
    }
  | {
      mode: "stepped-cad";
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
  "simple-stepped": SimpleSteppedLayoutParams;
  stepped: SteppedLayoutParams;
  "stepped-cad": SteppedLayoutParams;
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
  const dimensions = calculateTrayDimensions(params);
  return {
    mode: "grid",
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
  return {
    mode: "custom",
    slotCount: params.slots.length,
    trayWidth: params.trayWidth,
    trayDepth: params.trayDepth,
  };
}

function buildBaseConverterDraftSummary(
  params: BaseConverterParams,
): DraftSummaryByMode["base-converter"] {
  const { source, target } = resolveBaseConverterGeometry(params);
  return {
    mode: "base-converter",
    sourceLabel: source.name,
    targetLabel: target.name,
    trayWidth: target.width,
    trayDepth: target.depth,
  };
}

function buildSimpleSteppedDraftSummary(
  params: SimpleSteppedLayoutParams,
): DraftSummaryByMode["simple-stepped"] {
  const dimensions = calculateSimpleSteppedDimensions(params);
  return {
    mode: "simple-stepped",
    rowCount: params.rows.length,
    slotCount: params.slots.length,
    trayWidth: dimensions.width,
    trayDepth: dimensions.depth,
  };
}

function buildSteppedDraftSummary<M extends "stepped" | "stepped-cad">(
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
    case "simple-stepped":
      return buildSimpleSteppedDraftSummary(
        params as SimpleSteppedLayoutParams,
      ) as DraftSummaryByMode[M];
    case "stepped":
      return buildSteppedDraftSummary(
        "stepped",
        params as SteppedLayoutParams,
      ) as DraftSummaryByMode[M];
    case "stepped-cad":
      return buildSteppedDraftSummary(
        "stepped-cad",
        params as SteppedLayoutParams,
      ) as DraftSummaryByMode[M];
    default: {
      const unreachableMode: never = mode;
      throw new Error(`Unsupported draft mode: ${String(unreachableMode)}`);
    }
  }
}
