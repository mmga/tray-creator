/**
 * 草稿 legacy 兼容模块。
 *
 * 从 local-drafts.ts 提取，专门处理旧版草稿记录的兼容读取：
 * - 从旧版平铺字段（slotCount/groupCount/trayWidth/...）重建 summary
 * - normalizeListItem 三级 fallback：item.summary → legacy fields → buildDraftSummary
 *
 * 独立成模块后，legacy 规则变更只改这一处（locality）。
 */
import { buildDraftSummary } from "@/lib/draft-summary";
import type {
  DraftParamsByMode,
  DraftSummary,
  DraftSummaryByMode,
  GridDraftStructureMode,
} from "@/lib/draft-summary";
import type { ExportableParams } from "@/lib/mode-param-snapshot";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";

export type DraftMode = keyof DraftParamsByMode;
type HistoricalDraftMode = DraftMode | "stepped-cad";

export type DraftListItemCompatibilityByMode = {
  grid: {
    rows: number;
    columns: number;
    structureMode: GridDraftStructureMode;
    baseSizeLabel: string;
    trayWidth: number;
    trayDepth: number;
  };
  custom: {
    slotCount: number;
    trayWidth: number;
    trayDepth: number;
  };
  "base-converter": {
    sourceLabel: string;
    targetLabel: string;
    trayWidth: number;
    trayDepth: number;
  };
  "simple-stepped": {
    rowCount: number;
    slotCount: number;
    trayWidth: number;
    trayDepth: number;
  };
  stepped: {
    groupCount: number;
    slotCount: number;
    trayWidth: number;
    trayDepth: number;
  };
};

export type UnknownDraftListItem = Partial<{
  id: unknown;
  mode: unknown;
  title: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  summary: unknown;
  slotCount: unknown;
  groupCount: unknown;
  trayWidth: unknown;
  trayDepth: unknown;
  rowCount: unknown;
  rows: unknown;
  columns: unknown;
  structureMode: unknown;
  baseSizeLabel: unknown;
  sourceLabel: unknown;
  targetLabel: unknown;
}>;

export const DRAFT_MODES: DraftMode[] = [
  "grid",
  "custom",
  "base-converter",
  "simple-stepped",
  "stepped",
];

export function isDraftMode(value: unknown): value is DraftMode {
  return DRAFT_MODES.includes(value as DraftMode);
}

function isHistoricalDraftMode(value: unknown): value is HistoricalDraftMode {
  return value === "stepped-cad" || isDraftMode(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function extractCompatibilityFields(
  summary: DraftSummary,
): DraftListItemCompatibilityByMode[DraftMode] {
  switch (summary.mode) {
    case "grid":
      return {
        rows: summary.rows,
        columns: summary.columns,
        structureMode: summary.structureMode,
        baseSizeLabel: summary.baseSizeLabel,
        trayWidth: summary.trayWidth,
        trayDepth: summary.trayDepth,
      };
    case "custom":
      return {
        slotCount: summary.slotCount,
        trayWidth: summary.trayWidth,
        trayDepth: summary.trayDepth,
      };
    case "base-converter":
      return {
        sourceLabel: summary.sourceLabel,
        targetLabel: summary.targetLabel,
        trayWidth: summary.trayWidth,
        trayDepth: summary.trayDepth,
      };
    case "simple-stepped":
      return {
        rowCount: summary.rowCount,
        slotCount: summary.slotCount,
        trayWidth: summary.trayWidth,
        trayDepth: summary.trayDepth,
      };
    case "stepped":
      return {
        groupCount: summary.groupCount,
        slotCount: summary.slotCount,
        trayWidth: summary.trayWidth,
        trayDepth: summary.trayDepth,
      };
    default: {
      throw new Error(`Unsupported draft summary mode: ${String(summary)}`);
    }
  }
}

function normalizeSummaryFromLegacyFields(
  item: UnknownDraftListItem,
): DraftSummary | null {
  if (item.mode === "stepped" || item.mode === "stepped-cad") {
    if (
      isFiniteNumber(item.slotCount) &&
      isFiniteNumber(item.groupCount) &&
      isFiniteNumber(item.trayWidth) &&
      isFiniteNumber(item.trayDepth)
    ) {
      return {
        mode: "stepped",
        slotCount: item.slotCount,
        groupCount: item.groupCount,
        trayWidth: item.trayWidth,
        trayDepth: item.trayDepth,
      };
    }
    return null;
  }

  if (item.mode === "grid") {
    if (
      isFiniteNumber(item.rows) &&
      isFiniteNumber(item.columns) &&
      typeof item.structureMode === "string" &&
      typeof item.baseSizeLabel === "string" &&
      isFiniteNumber(item.trayWidth) &&
      isFiniteNumber(item.trayDepth)
    ) {
      return {
        mode: "grid",
        rows: item.rows,
        columns: item.columns,
        structureMode: item.structureMode as GridDraftStructureMode,
        baseSizeLabel: item.baseSizeLabel,
        trayWidth: item.trayWidth,
        trayDepth: item.trayDepth,
      };
    }
    return null;
  }

  if (item.mode === "custom") {
    if (
      isFiniteNumber(item.slotCount) &&
      isFiniteNumber(item.trayWidth) &&
      isFiniteNumber(item.trayDepth)
    ) {
      return {
        mode: "custom",
        slotCount: item.slotCount,
        trayWidth: item.trayWidth,
        trayDepth: item.trayDepth,
      };
    }
    return null;
  }

  if (item.mode === "base-converter") {
    if (
      typeof item.sourceLabel === "string" &&
      typeof item.targetLabel === "string" &&
      isFiniteNumber(item.trayWidth) &&
      isFiniteNumber(item.trayDepth)
    ) {
      return {
        mode: "base-converter",
        sourceLabel: item.sourceLabel,
        targetLabel: item.targetLabel,
        trayWidth: item.trayWidth,
        trayDepth: item.trayDepth,
      };
    }
    return null;
  }

  if (item.mode === "simple-stepped") {
    if (
      isFiniteNumber(item.rowCount) &&
      isFiniteNumber(item.slotCount) &&
      isFiniteNumber(item.trayWidth) &&
      isFiniteNumber(item.trayDepth)
    ) {
      return {
        mode: "simple-stepped",
        rowCount: item.rowCount,
        slotCount: item.slotCount,
        trayWidth: item.trayWidth,
        trayDepth: item.trayDepth,
      };
    }
    return null;
  }

  return null;
}

/**
 * 三级 fallback 重建 DraftListItem：
 * 1. item.summary（已是规范 summary 对象）
 * 2. 从 legacy 平铺字段重建
 * 3. 从 fallbackParams 调 buildDraftSummary 重建
 */
export function normalizeListItem<M extends DraftMode>(
  item: UnknownDraftListItem,
  fallbackMode?: M,
  fallbackParams?: DraftParamsByMode[M] | ExportableParams,
): (DraftListItemShape<M>) | null {
  const historicalMode = isHistoricalDraftMode(item.mode) ? item.mode : fallbackMode;
  const mode = historicalMode === "stepped-cad" ? "stepped" : historicalMode;
  if (
    !mode ||
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string"
  ) {
    return null;
  }

  const rawSummary =
    item.summary && typeof item.summary === "object" && item.summary !== null
      ? (item.summary as DraftSummary)
      : normalizeSummaryFromLegacyFields(item) ??
        (fallbackParams
          ? buildDraftSummary(
              captureModeParamSnapshot(
                mode,
                fallbackParams as DraftParamsByMode[typeof mode],
              ),
            )
          : null);
  const summary = rawSummary && (rawSummary as { mode?: unknown }).mode === "stepped-cad"
    ? { ...rawSummary, mode: "stepped" } as DraftSummary
    : rawSummary;

  if (!summary || summary.mode !== mode) {
    return null;
  }

  return {
    id: item.id,
    mode: mode as M,
    title: item.title,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    summary: summary as DraftSummaryByMode[M],
    ...(extractCompatibilityFields(summary as DraftSummary) as DraftListItemCompatibilityByMode[M]),
  };
}

/** DraftListItem 的结构形状（不含 mode 条件类型的简化版，供内部使用） */
export type DraftListItemShape<M extends DraftMode> = {
  id: string;
  mode: M;
  title: string;
  createdAt: string;
  updatedAt: string;
  summary: DraftSummaryByMode[M];
} & DraftListItemCompatibilityByMode[M];
