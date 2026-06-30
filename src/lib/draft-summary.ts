import { calculateSimpleSteppedDimensions } from "@/lib/simple-stepped-layout";
import { calculateTrayDimensions } from "@/lib/tray-model";
import type {
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import type { ExportableParams } from "@/lib/param-io";

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
    };

export type DraftSummaryByMode = {
  [K in DraftSummary["mode"]]: Extract<DraftSummary, { mode: K }>;
};

export type DraftParamsByMode = {
  grid: TrayParams;
  custom: CustomLayoutParams;
  "simple-stepped": SimpleSteppedLayoutParams;
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

function buildSteppedDraftSummary(
  params: SteppedLayoutParams,
): DraftSummaryByMode["stepped"] {
  return {
    mode: "stepped",
    groupCount: params.groups.length,
    slotCount: params.slots.length,
    trayWidth: params.trayWidth,
    trayDepth: params.trayDepth,
  };
}

export function buildDraftSummary<M extends keyof DraftParamsByMode>(
  mode: M,
  params: DraftParamsByMode[M] | ExportableParams,
): DraftSummaryByMode[M] {
  switch (mode) {
    case "grid":
      return buildGridDraftSummary(params as TrayParams) as DraftSummaryByMode[M];
    case "custom":
      return buildCustomDraftSummary(
        params as CustomLayoutParams,
      ) as DraftSummaryByMode[M];
    case "simple-stepped":
      return buildSimpleSteppedDraftSummary(
        params as SimpleSteppedLayoutParams,
      ) as DraftSummaryByMode[M];
    case "stepped":
      return buildSteppedDraftSummary(
        params as SteppedLayoutParams,
      ) as DraftSummaryByMode[M];
    default: {
      const unreachableMode: never = mode;
      throw new Error(`Unsupported draft mode: ${String(unreachableMode)}`);
    }
  }
}
