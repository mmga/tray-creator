import type { SteppedLayoutParams } from "@/types/custom-tray";
import { downloadParamFile } from "@/lib/param-io";

// ═══════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════

export type DraftMode = "stepped";

export interface DraftListItem {
  id: string;
  mode: DraftMode;
  title: string;
  createdAt: string;
  updatedAt: string;
  slotCount: number;
  groupCount: number;
  trayWidth: number;
  trayDepth: number;
}

export interface DraftRecord {
  storageVersion: 1;
  item: DraftListItem;
  paramFile: {
    version: 1;
    mode: DraftMode;
    params: SteppedLayoutParams;
  };
}

// ═══════════════════════════════════════════
// localStorage 键名
// ═══════════════════════════════════════════

const DRAFT_INDEX_KEY = "tray-creator:drafts:index:v1";
const draftRecordKey = (id: string): string =>
  `tray-creator:drafts:stepped:${id}:v1`;

/** 单模式最大草稿数，超出时拒绝创建新草稿 */
export const MAX_DRAFTS_PER_MODE = 30;

// ═══════════════════════════════════════════
// localStorage 安全包装
// ═══════════════════════════════════════════

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
  } catch (e) {
    throw new Error(
      `存储失败（可能超出配额）：${e instanceof Error ? e.message : String(e)}`,
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

// ═══════════════════════════════════════════
// 索引管理
// ═══════════════════════════════════════════

function readIndex(): DraftListItem[] {
  const raw = safeGetItem(DRAFT_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as DraftListItem[];
  } catch {
    return [];
  }
}

function writeIndex(items: DraftListItem[]): void {
  safeSetItem(DRAFT_INDEX_KEY, JSON.stringify(items));
}

// ═══════════════════════════════════════════
// 摘要构建
// ═══════════════════════════════════════════

function buildSummary(
  params: SteppedLayoutParams,
): Pick<DraftListItem, "slotCount" | "groupCount" | "trayWidth" | "trayDepth"> {
  return {
    slotCount: params.slots.length,
    groupCount: params.groups.length,
    trayWidth: params.trayWidth,
    trayDepth: params.trayDepth,
  };
}

// ═══════════════════════════════════════════
// 公开 API
// ═══════════════════════════════════════════

/** 列出所有指定模式的草稿，按 updatedAt 倒序 */
export function listDrafts(mode: DraftMode): DraftListItem[] {
  return readIndex()
    .filter((item) => item.mode === mode)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

/** 按 id 读取完整草稿记录，若不存在或损坏返回 null */
export function getDraft(id: string): DraftRecord | null {
  const raw = safeGetItem(draftRecordKey(id));
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as DraftRecord;
    if (record.storageVersion !== 1) return null;
    return record;
  } catch {
    return null;
  }
}

/** 创建新草稿，返回草稿记录 */
export function createDraft(
  title: string,
  params: SteppedLayoutParams,
): DraftRecord {
  // 数量上限检查
  const existing = readIndex().filter((i) => i.mode === "stepped");
  if (existing.length >= MAX_DRAFTS_PER_MODE) {
    throw new Error(
      `草稿数量已达上限（${MAX_DRAFTS_PER_MODE} 个），请先删除不需要的草稿`,
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const cleanTitle = title.trim() || defaultDraftTitle();

  const item: DraftListItem = {
    id,
    mode: "stepped",
    title: cleanTitle,
    createdAt: now,
    updatedAt: now,
    ...buildSummary(params),
  };

  const record: DraftRecord = {
    storageVersion: 1,
    item,
    paramFile: { version: 1, mode: "stepped", params },
  };

  // 事务性写入：先写记录，再写索引；任一失败则回滚
  safeSetItem(draftRecordKey(id), JSON.stringify(record));
  try {
    const index = readIndex();
    index.push(item);
    writeIndex(index);
  } catch (e) {
    // 索引写失败 → 回滚已写入的记录
    safeRemoveItem(draftRecordKey(id));
    throw e;
  }

  return record;
}

/** 覆盖已有草稿的参数并更新摘要，返回更新后的记录 */
export function updateDraft(
  id: string,
  title: string,
  params: SteppedLayoutParams,
): DraftRecord {
  const existing = getDraft(id);
  if (!existing) throw new Error(`草稿不存在: ${id}`);

  const now = new Date().toISOString();
  const cleanTitle = title.trim() || existing.item.title;

  const updatedItem: DraftListItem = {
    ...existing.item,
    title: cleanTitle,
    updatedAt: now,
    ...buildSummary(params),
  };

  const updatedRecord: DraftRecord = {
    ...existing,
    item: updatedItem,
    paramFile: { version: 1, mode: "stepped", params },
  };

  // 事务性写入：先写记录，再写索引；任一失败则回滚至旧记录
  safeSetItem(draftRecordKey(id), JSON.stringify(updatedRecord));
  try {
    const index = readIndex().map((item) =>
      item.id === id ? updatedItem : item,
    );
    writeIndex(index);
  } catch (e) {
    // 索引写失败 → 回滚记录为旧版本
    safeSetItem(draftRecordKey(id), JSON.stringify(existing));
    throw e;
  }

  return updatedRecord;
}

/** 只更新草稿名称，不改变 params */
export function renameDraft(id: string, title: string): DraftRecord {
  const existing = getDraft(id);
  if (!existing) throw new Error(`草稿不存在: ${id}`);

  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error("草稿名称不能为空");

  const updatedItem: DraftListItem = {
    ...existing.item,
    title: cleanTitle,
    updatedAt: new Date().toISOString(),
  };

  const updatedRecord: DraftRecord = { ...existing, item: updatedItem };
  safeSetItem(draftRecordKey(id), JSON.stringify(updatedRecord));

  const index = readIndex().map((item) =>
    item.id === id ? updatedItem : item,
  );
  writeIndex(index);

  return updatedRecord;
}

/** 删除草稿（同时从索引移除） */
export function deleteDraft(id: string): void {
  safeRemoveItem(draftRecordKey(id));
  const index = readIndex().filter((item) => item.id !== id);
  writeIndex(index);
}

/** 触发下载该草稿对应的 JSON 参数文件 */
export function exportDraft(id: string): void {
  const record = getDraft(id);
  if (!record) throw new Error(`草稿不存在: ${id}`);
  const slug = record.item.title
    .replace(/[^\w\u4e00-\u9fa5-]/g, "-")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
  const filename = `stepped-draft-${slug || id.slice(0, 8)}.json`;
  downloadParamFile("stepped", record.paramFile.params, filename);
}

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

/** 生成默认草稿名称，格式：阶梯草稿 YYYY-MM-DD HH:mm */
export function defaultDraftTitle(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `阶梯草稿 ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 格式化时间戳为可读字符串 */
export function formatDraftTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
