import { buildDraftSummary } from "@/lib/draft-summary";
import type {
  DraftParamsByMode,
  DraftSummary,
  DraftSummaryByMode,
  GridDraftStructureMode,
} from "@/lib/draft-summary";
import { downloadParamFile } from "@/lib/param-io";
import type { ExportableParams } from "@/lib/param-io";
import type { AppMode, SteppedLayoutParams } from "@/types/custom-tray";

export type DraftMode = AppMode;

type DraftListItemCompatibilityByMode = {
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

export type DraftListItem<M extends DraftMode = "stepped"> = {
  id: string;
  mode: M;
  title: string;
  createdAt: string;
  updatedAt: string;
  summary?: DraftSummaryByMode[M];
} & DraftListItemCompatibilityByMode[M];

export type AnyDraftListItem = {
  [M in DraftMode]: DraftListItem<M>;
}[DraftMode];

export interface DraftRecord<M extends DraftMode = "stepped"> {
  storageVersion: 1;
  item: DraftListItem<M>;
  paramFile: {
    version: 1;
    mode: M;
    params: DraftParamsByMode[M];
  };
}

type UnknownDraftListItem = Partial<AnyDraftListItem> & {
  id?: unknown;
  mode?: unknown;
  title?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  summary?: unknown;
  slotCount?: unknown;
  groupCount?: unknown;
  trayWidth?: unknown;
  trayDepth?: unknown;
  rowCount?: unknown;
  rows?: unknown;
  columns?: unknown;
  structureMode?: unknown;
  baseSizeLabel?: unknown;
};

const DRAFT_INDEX_KEY = "tray-creator:drafts:index:v1";
const DRAFT_MODES: DraftMode[] = [
  "grid",
  "custom",
  "simple-stepped",
  "stepped",
];

const draftRecordKey = (mode: DraftMode, id: string): string =>
  `tray-creator:drafts:${mode}:${id}:v1`;

export const MAX_DRAFTS_PER_MODE = 30;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    throw new Error(
      `存储失败（可能超出配额）：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // silently ignore
  }
}

function isDraftMode(value: unknown): value is DraftMode {
  return DRAFT_MODES.includes(value as DraftMode);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function extractCompatibilityFields(
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
  if (item.mode === "stepped") {
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

function normalizeListItem<M extends DraftMode>(
  item: UnknownDraftListItem,
  fallbackMode?: M,
  fallbackParams?: DraftParamsByMode[M] | ExportableParams,
): DraftListItem<M> | null {
  const mode = isDraftMode(item.mode) ? item.mode : fallbackMode;
  if (
    !mode ||
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string"
  ) {
    return null;
  }

  const summary =
    item.summary && typeof item.summary === "object" && item.summary !== null
      ? (item.summary as DraftSummary)
      : normalizeSummaryFromLegacyFields(item) ??
        (fallbackParams ? buildDraftSummary(mode, fallbackParams) : null);

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

function readIndex(): AnyDraftListItem[] {
  const raw = safeGetItem(DRAFT_INDEX_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeListItem(item as UnknownDraftListItem))
      .filter((item): item is AnyDraftListItem => item !== null);
  } catch {
    return [];
  }
}

function writeIndex(items: AnyDraftListItem[]): void {
  safeSetItem(DRAFT_INDEX_KEY, JSON.stringify(items));
}

function buildListItem<M extends DraftMode>(
  mode: M,
  id: string,
  title: string,
  createdAt: string,
  updatedAt: string,
  params: DraftParamsByMode[M],
): DraftListItem<M> {
  const summary = buildDraftSummary(mode, params);
  return {
    id,
    mode: mode as M,
    title,
    createdAt,
    updatedAt,
    summary,
    ...(extractCompatibilityFields(summary) as DraftListItemCompatibilityByMode[M]),
  };
}

function resolveDraftMode(id: string): DraftMode | null {
  const indexed = readIndex().find((item) => item.id === id);
  if (indexed) {
    return indexed.mode;
  }

  for (const mode of DRAFT_MODES) {
    if (safeGetItem(draftRecordKey(mode, id))) {
      return mode;
    }
  }

  return null;
}

function getDraftInternal<M extends DraftMode>(
  mode: M,
  id: string,
): DraftRecord<M> | null {
  const raw = safeGetItem(draftRecordKey(mode, id));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      storageVersion?: unknown;
      item?: UnknownDraftListItem;
      paramFile?: {
        version?: unknown;
        mode?: unknown;
        params?: DraftParamsByMode[M];
      };
    };

    if (parsed.storageVersion !== 1 || !parsed.paramFile) {
      return null;
    }

    const recordMode = isDraftMode(parsed.paramFile.mode)
      ? parsed.paramFile.mode
      : mode;
    if (recordMode !== mode || parsed.paramFile.version !== 1) {
      return null;
    }

    const params = parsed.paramFile.params;
    if (!params || typeof params !== "object") {
      return null;
    }

    const item = normalizeListItem(
      parsed.item ?? {},
      mode,
      params,
    );

    if (!item) {
      return null;
    }

    return {
      storageVersion: 1,
      item,
      paramFile: {
        version: 1,
        mode,
        params,
      },
    };
  } catch {
    return null;
  }
}

function parseCreateArgs<M extends DraftMode>(
  title: string,
  modeOrParams: M | SteppedLayoutParams,
  maybeParams?: DraftParamsByMode[M],
): { mode: M; params: DraftParamsByMode[M] } {
  if (typeof modeOrParams === "string") {
    return {
      mode: modeOrParams,
      params: maybeParams as DraftParamsByMode[M],
    };
  }

  return {
    mode: "stepped" as M,
    params: modeOrParams as DraftParamsByMode[M],
  };
}

function parseUpdateArgs<M extends DraftMode>(
  modeOrId: M | string,
  idOrTitle: string,
  titleOrParams: string | DraftParamsByMode[M],
  maybeParams?: DraftParamsByMode[M],
) {
  if (maybeParams !== undefined && isDraftMode(modeOrId)) {
    return {
      mode: modeOrId,
      id: idOrTitle,
      title: titleOrParams as string,
      params: maybeParams,
    };
  }

  const id = modeOrId;
  return {
    mode: (resolveDraftMode(id) ?? "stepped") as M,
    id,
    title: idOrTitle,
    params: titleOrParams as DraftParamsByMode[M],
  };
}

function parseIdArgs<M extends DraftMode>(
  modeOrId: M | string,
  maybeId?: string,
): { mode: M; id: string } {
  if (maybeId && isDraftMode(modeOrId)) {
    return { mode: modeOrId as M, id: maybeId };
  }

  const id = modeOrId;
  return { mode: (resolveDraftMode(id) ?? "stepped") as M, id };
}

export function listDrafts<M extends DraftMode>(mode: M): DraftListItem<M>[] {
  return readIndex()
    .filter((item) => item.mode === mode)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ) as unknown as DraftListItem<M>[];
}

export function getDraft(id: string): DraftRecord<"stepped"> | null;
export function getDraft<M extends DraftMode>(
  mode: M,
  id: string,
): DraftRecord<M> | null;
export function getDraft<M extends DraftMode>(
  modeOrId: M | string,
  maybeId?: string,
): DraftRecord<M> | DraftRecord<"stepped"> | null {
  const { mode, id } = parseIdArgs(modeOrId, maybeId);
  return getDraftInternal(mode, id);
}

export function createDraft(
  title: string,
  params: SteppedLayoutParams,
): DraftRecord<"stepped">;
export function createDraft<M extends DraftMode>(
  title: string,
  mode: M,
  params: DraftParamsByMode[M],
): DraftRecord<M>;
export function createDraft<M extends DraftMode>(
  title: string,
  modeOrParams: M | SteppedLayoutParams,
  maybeParams?: DraftParamsByMode[M],
): DraftRecord<M> | DraftRecord<"stepped"> {
  const { mode, params } = parseCreateArgs(title, modeOrParams, maybeParams);
  const existing = readIndex().filter((item) => item.mode === mode);
  if (existing.length >= MAX_DRAFTS_PER_MODE) {
    throw new Error(
      `草稿数量已达上限（${MAX_DRAFTS_PER_MODE} 个），请先删除不需要的草稿`,
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const cleanTitle = title.trim() || defaultDraftTitle(mode);
  const item = buildListItem(mode, id, cleanTitle, now, now, params);
  const record: DraftRecord<M> = {
    storageVersion: 1,
    item,
    paramFile: { version: 1, mode, params },
  };

  safeSetItem(draftRecordKey(mode, id), JSON.stringify(record));
  try {
    const index = readIndex();
    index.push(item as AnyDraftListItem);
    writeIndex(index);
  } catch (error) {
    safeRemoveItem(draftRecordKey(mode, id));
    throw error;
  }

  return record;
}

export function updateDraft(
  id: string,
  title: string,
  params: SteppedLayoutParams,
): DraftRecord<"stepped">;
export function updateDraft<M extends DraftMode>(
  mode: M,
  id: string,
  title: string,
  params: DraftParamsByMode[M],
): DraftRecord<M>;
export function updateDraft<M extends DraftMode>(
  modeOrId: M | string,
  idOrTitle: string,
  titleOrParams: string | DraftParamsByMode[M],
  maybeParams?: DraftParamsByMode[M],
): DraftRecord<M> | DraftRecord<"stepped"> {
  const { mode, id, title, params } = parseUpdateArgs(
    modeOrId,
    idOrTitle,
    titleOrParams,
    maybeParams,
  );
  const existing = getDraftInternal(mode, id);
  if (!existing) throw new Error(`草稿不存在: ${id}`);

  const now = new Date().toISOString();
  const cleanTitle = title.trim() || existing.item.title;
  const updatedItem = buildListItem(
    mode,
    id,
    cleanTitle,
    existing.item.createdAt,
    now,
    params,
  );
  const updatedRecord = {
    storageVersion: 1,
    item: updatedItem,
    paramFile: { version: 1, mode, params },
  } as unknown as DraftRecord<M>;

  safeSetItem(draftRecordKey(mode, id), JSON.stringify(updatedRecord));
  try {
    const index = readIndex().map((item) =>
      item.id === id ? (updatedItem as AnyDraftListItem) : item,
    );
    writeIndex(index);
  } catch (error) {
    safeSetItem(draftRecordKey(mode, id), JSON.stringify(existing));
    throw error;
  }

  return updatedRecord;
}

export function renameDraft(id: string, title: string): DraftRecord;
export function renameDraft<M extends DraftMode>(
  mode: M,
  id: string,
  title: string,
): DraftRecord<M>;
export function renameDraft<M extends DraftMode>(
  modeOrId: M | string,
  idOrTitle: string,
  maybeTitle?: string,
): DraftRecord<M> | DraftRecord {
  const hasExplicitMode = maybeTitle !== undefined && isDraftMode(modeOrId);
  const mode = (hasExplicitMode
    ? modeOrId
    : resolveDraftMode(modeOrId as string) ?? "stepped") as M;
  const id = hasExplicitMode ? idOrTitle : (modeOrId as string);
  const title = hasExplicitMode ? maybeTitle : idOrTitle;
  const existing = getDraftInternal(mode, id);
  if (!existing) throw new Error(`草稿不存在: ${id}`);

  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error("草稿名称不能为空");

  const updatedItem = {
    ...existing.item,
    title: cleanTitle,
    updatedAt: new Date().toISOString(),
  } as DraftListItem<M>;
  const updatedRecord: DraftRecord<M> = { ...existing, item: updatedItem };

  safeSetItem(draftRecordKey(mode, id), JSON.stringify(updatedRecord));
  const index = readIndex().map((item) =>
    item.id === id ? (updatedItem as AnyDraftListItem) : item,
  );
  writeIndex(index);

  return updatedRecord;
}

export function deleteDraft(id: string): void;
export function deleteDraft<M extends DraftMode>(mode: M, id: string): void;
export function deleteDraft<M extends DraftMode>(
  modeOrId: M | string,
  maybeId?: string,
): void {
  const { mode, id } = parseIdArgs(modeOrId, maybeId);
  safeRemoveItem(draftRecordKey(mode, id));
  const index = readIndex().filter((item) => item.id !== id);
  writeIndex(index);
}

export function exportDraft(id: string): void;
export function exportDraft<M extends DraftMode>(mode: M, id: string): void;
export function exportDraft<M extends DraftMode>(
  modeOrId: M | string,
  maybeId?: string,
): void {
  const { mode, id } = parseIdArgs(modeOrId, maybeId);
  const record = getDraftInternal(mode, id);
  if (!record) throw new Error(`草稿不存在: ${id}`);

  const slug = record.item.title
    .replace(/[^\w\u4e00-\u9fa5-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const filename = `${mode}-draft-${slug || id.slice(0, 8)}.json`;
  downloadParamFile(mode, record.paramFile.params, filename);
}

export function defaultDraftTitle(mode: DraftMode = "stepped"): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const label = {
    grid: "网格草稿",
    custom: "自定义草稿",
    "simple-stepped": "简易阶梯草稿",
    stepped: "阶梯草稿",
  }[mode];

  return `${label} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDraftTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
