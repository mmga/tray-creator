/**
 * 草稿持久化模块。
 *
 * 聚焦"localStorage 双写事务（record + index）与回滚"，
 * legacy 兼容读取已提取到 draft-legacy-normalize.ts。
 */
import { buildDraftSummary } from "@/lib/draft-summary";
import type { DraftParamsByMode } from "@/lib/draft-summary";
import {
  extractCompatibilityFields,
  normalizeListItem,
  type DraftListItemCompatibilityByMode,
  type DraftListItemShape,
  type DraftMode,
  type UnknownDraftListItem,
} from "@/lib/draft-legacy-normalize";
import { downloadParamFile } from "@/lib/param-download";
import {
  captureModeParamSnapshot,
  type ModeParamSnapshot,
} from "@/lib/mode-param-snapshot";
import { readDraftParamArtifact } from "@/lib/historical-param-artifact-reader";

export type { DraftMode } from "@/lib/draft-legacy-normalize";
export type { DraftListItemCompatibilityByMode } from "@/lib/draft-legacy-normalize";

export type DraftListItem<M extends DraftMode = "stepped"> = DraftListItemShape<M>;

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

const DRAFT_INDEX_KEY = "tray-creator:drafts:index:v1";

const draftRecordKey = (
  mode: DraftMode | "simple-stepped" | "stepped-cad",
  id: string,
): string =>
  `tray-creator:drafts:${mode}:${id}:v1`;

function getCompatibleDraftRecordKeys(mode: DraftMode, id: string): string[] {
  const keys = [draftRecordKey(mode, id)];
  if (mode === "stepped") {
    keys.push(
      draftRecordKey("stepped-cad", id),
      draftRecordKey("simple-stepped", id),
    );
  }
  return keys;
}

function findStoredDraftRecord(mode: DraftMode, id: string) {
  for (const key of getCompatibleDraftRecordKeys(mode, id)) {
    const raw = safeGetItem(key);
    if (raw !== null) {
      return { key, raw };
    }
  }
  return null;
}

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
  snapshot: ModeParamSnapshot<M>,
  id: string,
  title: string,
  createdAt: string,
  updatedAt: string,
): DraftListItem<M> {
  const { mode } = snapshot;
  const summary = buildDraftSummary(snapshot);
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

function isKnownStoredParamMode(
  value: unknown,
): value is DraftMode | "simple-stepped" | "stepped-cad" {
  return value === "grid" || value === "custom" || value === "base-converter" ||
    value === "stepped" || value === "simple-stepped" || value === "stepped-cad";
}

function getDraftInternal<M extends DraftMode>(
  mode: M,
  id: string,
): DraftRecord<M> | null {
  const stored = findStoredDraftRecord(mode, id);
  if (!stored) return null;
  const { raw } = stored;

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

    if (parsed.paramFile.version !== 1) {
      return null;
    }

    const rawParams = parsed.paramFile.params;
    if (!rawParams || typeof rawParams !== "object") {
      return null;
    }
    const storedMode = isKnownStoredParamMode(parsed.paramFile.mode)
      ? parsed.paramFile.mode
      : mode;
    const normalizedParams = readDraftParamArtifact(
      { version: 1, mode: storedMode, params: rawParams },
      mode,
    );
    const params = captureModeParamSnapshot(mode, normalizedParams).params;

    const itemSource = storedMode === "simple-stepped"
      ? { ...parsed.item, mode: "stepped", summary: undefined }
      : parsed.item ?? {};
    const item = normalizeListItem(
      itemSource,
      mode,
      params,
    );

    if (!item) {
      return null;
    }

    return buildRecord(mode, item, params);
  } catch {
    return null;
  }
}

function buildRecord<M extends DraftMode>(
  mode: M,
  item: DraftListItem<M>,
  params: DraftParamsByMode[M],
): DraftRecord<M> {
  return {
    storageVersion: 1,
    item,
    paramFile: { version: 1, mode, params },
  };
}

// ── 双写事务：统一 record + index 的写入与回滚 ──────────────────

type MutateResult<M extends DraftMode> = {
  item: DraftListItem<M>;
  params: DraftParamsByMode[M];
};

type RollbackStrategy = "remove" | "restore";

/**
 * 执行 record + index 双写事务。
 *
 * - strategy = "remove"：创建场景，index 写失败时删除 record（回滚为"从未创建"）
 * - strategy = "restore"：更新场景，index 写失败时还原旧 record
 *
 * 写入顺序：先 record，后 index。
 */
function commitDraft<M extends DraftMode>(
  mode: M,
  id: string,
  result: MutateResult<M>,
  strategy: RollbackStrategy,
  existingRaw: string | null,
): DraftRecord<M> {
  const key = draftRecordKey(mode, id);
  const record = buildRecord(mode, result.item, result.params);

  safeSetItem(key, JSON.stringify(record));
  try {
    const index = readIndex();
    const nextIndex = index.some((entry) => entry.id === id)
      ? index.map((entry) =>
          entry.id === id ? (result.item as AnyDraftListItem) : entry,
        )
      : [...index, result.item as AnyDraftListItem];
    writeIndex(nextIndex);
  } catch (error) {
    if (strategy === "remove") {
      safeRemoveItem(key);
    } else if (existingRaw !== null) {
      safeSetItem(key, existingRaw);
    }
    throw error;
  }

  return record;
}

// ── 公共 API ──────────────────

export function listDrafts<M extends DraftMode>(mode: M): DraftListItem<M>[] {
  return readIndex()
    .filter((item) => item.mode === mode)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ) as unknown as DraftListItem<M>[];
}

export function getDraft<M extends DraftMode>(
  mode: M,
  id: string,
): DraftRecord<M> | null {
  return getDraftInternal(mode, id);
}

export function createDraft<M extends DraftMode>(
  title: string,
  snapshot: ModeParamSnapshot<M>,
): DraftRecord<M> {
  const { mode, params } = snapshot;
  const existing = readIndex().filter((item) => item.mode === mode);
  if (existing.length >= MAX_DRAFTS_PER_MODE) {
    throw new Error(
      `草稿数量已达上限（${MAX_DRAFTS_PER_MODE} 个），请先删除不需要的草稿`,
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const cleanTitle = title.trim() || defaultDraftTitle(mode);
  const item = buildListItem(snapshot, id, cleanTitle, now, now);

  // 创建场景：index 写失败时删除 record（回滚为"从未创建"）
  return commitDraft(mode, id, { item, params }, "remove", null);
}

export function updateDraft<M extends DraftMode>(
  id: string,
  title: string,
  snapshot: ModeParamSnapshot<M>,
): DraftRecord<M> {
  const { mode, params } = snapshot;
  const key = draftRecordKey(mode, id);
  const currentRaw = safeGetItem(key);
  const existingRaw = findStoredDraftRecord(mode, id)?.raw ?? null;
  if (!existingRaw) throw new Error(`草稿不存在: ${id}`);

  const existing = getDraftInternal(mode, id);
  if (!existing) throw new Error(`草稿不存在: ${id}`);

  const now = new Date().toISOString();
  const cleanTitle = title.trim() || existing.item.title;
  const updatedItem = buildListItem(
    snapshot,
    id,
    cleanTitle,
    existing.item.createdAt,
    now,
  );

  // 更新场景：index 写失败时还原旧 record
  const updated = commitDraft(
    mode,
    id,
    { item: updatedItem, params },
    currentRaw ? "restore" : "remove",
    currentRaw,
  );
  if (mode === "stepped") {
    safeRemoveItem(draftRecordKey("stepped-cad", id));
    safeRemoveItem(draftRecordKey("simple-stepped", id));
  }
  return updated;
}

export function renameDraft<M extends DraftMode>(
  mode: M,
  id: string,
  title: string,
): DraftRecord<M> {
  const key = draftRecordKey(mode, id);
  const currentRaw = safeGetItem(key);
  const existingRaw = findStoredDraftRecord(mode, id)?.raw ?? null;
  if (!existingRaw) throw new Error(`草稿不存在: ${id}`);

  const existing = getDraftInternal(mode, id);
  if (!existing) throw new Error(`草稿不存在: ${id}`);

  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error("草稿名称不能为空");

  const updatedItem: DraftListItem<M> = {
    ...existing.item,
    title: cleanTitle,
    updatedAt: new Date().toISOString(),
  };

  const renamed = commitDraft(
    mode,
    id,
    { item: updatedItem, params: existing.paramFile.params },
    currentRaw ? "restore" : "remove",
    currentRaw,
  );
  if (mode === "stepped") {
    safeRemoveItem(draftRecordKey("stepped-cad", id));
    safeRemoveItem(draftRecordKey("simple-stepped", id));
  }
  return renamed;
}

export function deleteDraft<M extends DraftMode>(mode: M, id: string): void {
  safeRemoveItem(draftRecordKey(mode, id));
  if (mode === "stepped") {
    safeRemoveItem(draftRecordKey("stepped-cad", id));
    safeRemoveItem(draftRecordKey("simple-stepped", id));
  }
  const index = readIndex().filter((item) => item.id !== id);
  writeIndex(index);
}

export function exportDraft<M extends DraftMode>(mode: M, id: string): void;
export function exportDraft<M extends DraftMode>(
  mode: M,
  id: string,
): void {
  const record = getDraftInternal(mode, id);
  if (!record) throw new Error(`草稿不存在: ${id}`);

  const slug = record.item.title
    .replace(/[^\w\u4e00-\u9fa5-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const filename = `${mode}-draft-${slug || id.slice(0, 8)}.json`;
  downloadParamFile(
    captureModeParamSnapshot(mode, record.paramFile.params),
    filename,
  );
}

export function defaultDraftTitle(mode: DraftMode = "stepped"): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const label = {
    grid: "网格草稿",
    custom: "自定义草稿",
    "base-converter": "转换底盘草稿",
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
