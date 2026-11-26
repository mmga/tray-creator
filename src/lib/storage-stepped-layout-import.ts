import type { FreeSlot } from "@/types/custom-tray";
import type { IdFactory } from "@/lib/model-ports";
import { normalizeFreeSlotInstanceSnapshot } from "@/lib/slot-instance-factory";
import {
  deriveStorageSteppedTraySize,
  getStorageSteppedSlotBounds,
  validateStorageSteppedParams,
} from "@/lib/storage-stepped-plan";
import { storageSteppedTrayPartId } from "@/lib/storage-stepped-config";
import { STORAGE_STEPPED_CUSTOM_PRESET_ID } from "@/lib/storage-stepped-presets";
import { updateStorageSteppedTray } from "@/lib/storage-stepped-layout";
import type { StorageSteppedParams } from "@/types/storage-stepped";

export interface StorageSteppedLayoutImportConflict {
  path: string;
  message: string;
}

export interface StorageSteppedLayoutImportReport {
  status: "ready" | "blocked";
  sourceMode: "custom";
  slotCount: number;
  sourceWidth: number;
  sourceDepth: number;
  targetWidth: number;
  targetDepth: number;
  /** 为放入固定托盘所需的整体平移；不缩放、不裁剪 */
  translation: { x: number; y: number };
  conflicts: StorageSteppedLayoutImportConflict[];
  notes: string[];
  /** 平移后的候选槽位；仅用于预览与冲突说明，blocked 时不得提交 */
  slots: FreeSlot[];
}

const REJECTED_MODES: Record<string, string> = {
  grid: "网格托盘",
  stepped: "自定义阶梯底座",
  "stepped-cad": "CAD 阶梯",
  "simple-stepped": "简易阶梯",
  "storage-stepped": "阶梯收纳展示台",
  "base-converter": "底盘生成",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function blockedReport(
  message: string,
  target: StorageSteppedLayoutImportReportBase,
): StorageSteppedLayoutImportReport {
  return {
    ...target,
    status: "blocked",
    slotCount: 0,
    sourceWidth: 0,
    sourceDepth: 0,
    translation: { x: 0, y: 0 },
    conflicts: [{ path: "file", message }],
    notes: [],
    slots: [],
  };
}

interface StorageSteppedLayoutImportReportBase {
  sourceMode: "custom";
  targetWidth: number;
  targetDepth: number;
}

interface DecodedSource {
  params: Record<string, unknown>;
  declaredMode: string | null;
}

function decodeImportSource(data: unknown): DecodedSource {
  if (!isRecord(data)) {
    throw new Error("文件内容无效，无法读取托盘布局");
  }
  if (isRecord(data.params)) {
    return {
      params: data.params,
      declaredMode: typeof data.mode === "string" ? data.mode : null,
    };
  }
  return {
    params: data,
    declaredMode: typeof data.mode === "string" ? data.mode : null,
  };
}

/**
 * 读取一个现有自定义托盘参数文件，计算整体平移并报告越界/间距冲突。
 * 不接受阶梯模式文件，也不做缩放或裁剪。
 */
export function prepareStorageSteppedLayoutImport(
  data: unknown,
  target: {
    params: StorageSteppedParams;
    stepIndex: number;
    idFactory: IdFactory;
  },
): StorageSteppedLayoutImportReport {
  const size = deriveStorageSteppedTraySize(target.params.interface);
  const base: StorageSteppedLayoutImportReportBase = {
    sourceMode: "custom",
    targetWidth: size.width,
    targetDepth: size.depth,
  };

  let decoded: DecodedSource;
  try {
    decoded = decodeImportSource(data);
  } catch (error) {
    return blockedReport(
      error instanceof Error ? error.message : "无法读取托盘布局",
      base,
    );
  }

  if (decoded.declaredMode) {
    const rejected = REJECTED_MODES[decoded.declaredMode];
    if (rejected) {
      return blockedReport(
        `这是${rejected}参数，不能直接导入为收纳托盘布局；请使用自定义模式导出的托盘参数`,
        base,
      );
    }
    if (decoded.declaredMode !== "custom") {
      return blockedReport(
        `不支持的源模式：${decoded.declaredMode}`,
        base,
      );
    }
  }

  const source = decoded.params;
  if (Array.isArray(source.groups)) {
    return blockedReport("阶梯分组参数不能导入为单块收纳托盘布局", base);
  }
  if (typeof source.rows === "number" && typeof source.columns === "number") {
    return blockedReport("网格托盘参数不能导入为收纳托盘布局", base);
  }
  if (!Array.isArray(source.slots)) {
    return blockedReport("文件中没有可导入的槽位列表", base);
  }
  if (source.slots.length === 0) {
    return blockedReport("源托盘没有有效槽位，请改用「平板」预设", base);
  }

  const rawSlots: FreeSlot[] = [];
  const conflicts: StorageSteppedLayoutImportConflict[] = [];
  source.slots.forEach((slot, index) => {
    if (!isRecord(slot)) {
      conflicts.push({
        path: `slots[${index}]`,
        message: "槽位数据不是对象",
      });
      return;
    }
    for (const key of ["x", "y", "width", "height", "rotation"] as const) {
      if (typeof slot[key] !== "number" || !Number.isFinite(slot[key])) {
        conflicts.push({
          path: `slots[${index}].${key}`,
          message: "缺少或无效的数值",
        });
        return;
      }
    }
    if (slot.shape !== "circle" && slot.shape !== "ellipse") {
      conflicts.push({
        path: `slots[${index}].shape`,
        message: "仅支持圆形或椭圆槽",
      });
      return;
    }
    if (
      (slot.width as number) <= 0 ||
      (slot.height as number) <= 0
    ) {
      conflicts.push({
        path: `slots[${index}]`,
        message: "槽位尺寸必须为正",
      });
      return;
    }
    const normalized = normalizeFreeSlotInstanceSnapshot({
      ...(slot as unknown as FreeSlot),
      id: target.idFactory.createId(),
    });
    rawSlots.push(normalized);
  });

  if (conflicts.length > 0) {
    return {
      ...base,
      status: "blocked",
      slotCount: rawSlots.length,
      sourceWidth: 0,
      sourceDepth: 0,
      translation: { x: 0, y: 0 },
      conflicts,
      notes: [],
      slots: [],
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const slot of rawSlots) {
    const bounds = getStorageSteppedSlotBounds(slot);
    minX = Math.min(minX, bounds.minX);
    maxX = Math.max(maxX, bounds.maxX);
    minY = Math.min(minY, bounds.minY);
    maxY = Math.max(maxY, bounds.maxY);
  }
  const sourceWidth = maxX - minX;
  const sourceDepth = maxY - minY;
  const translation = {
    x: size.width / 2 - (minX + maxX) / 2,
    y: size.depth / 2 - (minY + maxY) / 2,
  };
  const slots = rawSlots.map((slot) => ({
    ...slot,
    x: slot.x + translation.x,
    y: slot.y + translation.y,
  }));

  const candidate = updateStorageSteppedTray(
    target.params,
    target.stepIndex,
    (tray) => ({
      ...tray,
      presetId: STORAGE_STEPPED_CUSTOM_PRESET_ID,
      slots,
    }),
  );
  const validation = validateStorageSteppedParams(candidate);
  const partId = storageSteppedTrayPartId(target.stepIndex);
  const trayConflicts = validation.errors
    .filter((issue) => issue.partId === partId)
    .map((issue) => ({ path: issue.path, message: issue.message }));
  const notes = [
    `源布局 ${sourceWidth.toFixed(1)} × ${sourceDepth.toFixed(1)} mm，` +
      `目标托盘 ${size.width.toFixed(1)} × ${size.depth.toFixed(1)} mm`,
    `整体平移 X ${translation.x.toFixed(2)} mm、Y ${translation.y.toFixed(2)} mm；槽形与槽径不缩放`,
  ];
  if (sourceWidth > size.width || sourceDepth > size.depth) {
    notes.push("源布局大于目标托盘，已保持相对位置并报告冲突，未做裁剪");
  }

  return {
    ...base,
    status: trayConflicts.length === 0 ? "ready" : "blocked",
    slotCount: slots.length,
    sourceWidth,
    sourceDepth,
    translation,
    conflicts: trayConflicts,
    notes,
    slots,
  };
}

/** 提交导入：只替换目标阶的槽位，保留槽深与底孔配置。 */
export function applyStorageSteppedLayoutImport(
  params: StorageSteppedParams,
  stepIndex: number,
  report: StorageSteppedLayoutImportReport,
): StorageSteppedParams {
  if (report.status !== "ready") {
    throw new Error("布局导入仍有冲突，不能提交");
  }
  return updateStorageSteppedTray(
    params,
    stepIndex,
    (tray) => ({
      ...tray,
      presetId: STORAGE_STEPPED_CUSTOM_PRESET_ID,
      slots: report.slots.map((slot) => ({ ...slot })),
    }),
  );
}
