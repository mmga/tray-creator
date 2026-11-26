import { isBaseHoleStructure, normalizeBaseHoleParams } from "@/lib/base-hole-config";
import { normalizeFreeSlotInstanceSnapshot } from "@/lib/slot-instance-factory";
import {
  STORAGE_STEPPED_HEIGHT_SPECS,
  STORAGE_STEPPED_INTERFACE_VERSION,
  STORAGE_STEPPED_LIMITS,
  getStorageSteppedDepthError,
  STORAGE_STEPPED_TRAY_THICKNESS,
  isStorageSteppedHeightSpecId,
} from "@/lib/storage-stepped-config";
import type { FreeSlot } from "@/types/custom-tray";
import type {
  StorageSteppedInterfaceParams,
  StorageSteppedParams,
  StorageSteppedTrayConfig,
} from "@/types/storage-stepped";
import type { ImportNormalizationRecorder } from "@/lib/param-import-report";
import { recordDefault } from "@/lib/param-import-report";

const EPSILON = 1e-6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireFinite(
  value: unknown,
  path: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path}: 需要有限数字`);
  }
}

function normalizeSlot(
  raw: unknown,
  path: string,
): FreeSlot {
  if (!isRecord(raw)) {
    throw new Error(`${path}: 槽位数据无效`);
  }
  for (const key of ["x", "y", "width", "height", "rotation"] as const) {
    requireFinite(raw[key], `${path}.${key}`);
  }
  if (raw.shape !== "circle" && raw.shape !== "ellipse") {
    throw new Error(`${path}.shape: 必须是 "circle" 或 "ellipse"`);
  }
  const width = raw.width as number;
  const height = raw.height as number;
  if (width <= 0 || width > 200 || height <= 0 || height > 200) {
    throw new Error(`${path}: 槽位尺寸必须在 (0, 200] 范围内`);
  }
  return normalizeFreeSlotInstanceSnapshot({
    ...(raw as unknown as FreeSlot),
    id: typeof raw.id === "string" && raw.id
      ? raw.id
      : crypto.randomUUID(),
  });
}

function normalizeTray(
  raw: unknown,
  expectedStepIndex: number,
  recorder?: ImportNormalizationRecorder,
): StorageSteppedTrayConfig {
  const path = `trays[${expectedStepIndex}]`;
  if (!isRecord(raw)) {
    throw new Error(`${path}: 托盘配置无效`);
  }
  if (raw.stepIndex !== expectedStepIndex) {
    throw new Error(`${path}.stepIndex: 必须为 ${expectedStepIndex}`);
  }
  requireFinite(raw.holeDepth, `${path}.holeDepth`);
  const { min, max } = STORAGE_STEPPED_LIMITS.holeDepth;
  if (raw.holeDepth < min || raw.holeDepth > max) {
    throw new Error(`${path}.holeDepth: 槽深必须在 ${min}–${max}mm 之间`);
  }
  if (!Array.isArray(raw.slots)) {
    throw new Error(`${path}.slots: 槽位列表无效`);
  }
  const slots = raw.slots.map((slot, index) =>
    normalizeSlot(slot, `${path}.slots[${index}]`),
  );

  if (
    raw.baseHoleStructure !== undefined &&
    !isBaseHoleStructure(raw.baseHoleStructure)
  ) {
    throw new Error(`${path}.baseHoleStructure: 底板孔位结构无效`);
  }
  const baseHole = normalizeBaseHoleParams(raw, "none");
  if (raw.baseHoleStructure === undefined) {
    recordDefault(recorder, {
      path: `${path}.baseHoleStructure`,
      label: `第 ${expectedStepIndex + 1} 阶底板孔位`,
      normalizedValue: "none",
      reason: "旧文件未记录该托盘的底板孔位，按关闭处理",
    });
  }

  const presetId =
    typeof raw.presetId === "string" && raw.presetId
      ? raw.presetId
      : "custom";

  return {
    stepIndex: expectedStepIndex,
    presetId,
    slots,
    holeDepth: raw.holeDepth,
    baseHoleStructure: baseHole.baseHoleStructure,
    magnetPostHoleDiameter: baseHole.magnetPostHoleDiameter,
    magnetPostHoleDepth: baseHole.magnetPostHoleDepth,
    baseHoleSize: baseHole.baseHoleSize,
    smallBaseHoleSize: baseHole.smallBaseHoleSize ?? "20",
  };
}

const INTERFACE_FIELDS: Array<Exclude<keyof StorageSteppedInterfaceParams, "stepDepths">> = [
  "bodyWidth",
  "moduleDepth",
  "stepCount",
  "trayThickness",
  "lowerWallThickness",
  "rimThickness",
  "fingerPullDiameter",
  "baseThickness",
  "assemblyClearance",
];

/**
 * 阶梯收纳展示台参数归一化。
 *
 * 与普通托盘不同：接口尺寸不做静默钳位。非法数值、未知接口版本、固定厚度被改写
 * 或托盘结构不完整时直接抛错，由导入报告呈现具体参数位置。
 */
export function normalizeStorageSteppedParams(
  params: StorageSteppedParams,
  recorder?: ImportNormalizationRecorder,
): StorageSteppedParams {
  if (!isRecord(params)) {
    throw new Error("参数不是对象");
  }
  if (params.interfaceVersion !== STORAGE_STEPPED_INTERFACE_VERSION) {
    throw new Error(
      `interfaceVersion: 未知接口版本 ${String(params.interfaceVersion)}`,
    );
  }
  if (!isStorageSteppedHeightSpecId(params.heightSpecId)) {
    throw new Error(`heightSpecId: 未知的主体高度规格`);
  }
  const spec = STORAGE_STEPPED_HEIGHT_SPECS[params.heightSpecId];

  if (params.firstStepHeight === undefined) {
    params.firstStepHeight = spec.firstStepHeight;
    recordDefault(recorder, {
      path: "firstStepHeight",
      label: "首阶台面高度",
      normalizedValue: spec.firstStepHeight,
      reason: `按高度规格「${spec.label}」补齐`,
    });
  } else {
    requireFinite(params.firstStepHeight, "firstStepHeight");
    if (Math.abs(params.firstStepHeight - spec.firstStepHeight) > EPSILON) {
      throw new Error(
        `firstStepHeight: 与高度规格「${spec.label}」不一致`,
      );
    }
  }
  if (params.stepRise === undefined) {
    params.stepRise = spec.stepRise;
    recordDefault(recorder, {
      path: "stepRise",
      label: "台阶步进高度",
      normalizedValue: spec.stepRise,
      reason: `按高度规格「${spec.label}」补齐`,
    });
  } else {
    requireFinite(params.stepRise, "stepRise");
    if (Math.abs(params.stepRise - spec.stepRise) > EPSILON) {
      throw new Error(`stepRise: 与高度规格「${spec.label}」不一致`);
    }
  }

  if (!isRecord(params.interface)) {
    throw new Error("interface: 接口参数无效");
  }
  for (const key of INTERFACE_FIELDS) {
    requireFinite(params.interface[key], `interface.${key}`);
  }
  const legacyInterface = params.interface as StorageSteppedInterfaceParams & Record<string, unknown>;
  for (const [key, label] of [
    ["trayBottomChamfer", "托盘底部倒角退让"],
    ["trayChamferAngle", "托盘底部倒角角度"],
  ]) {
    if (!Object.hasOwn(legacyInterface, key)) continue;
    recorder?.retire({
      path: `interface.${key}`,
      label,
      previousValue: legacyInterface[key],
      reason: "收纳托盘改用平底，底部倒角固定为 0 mm",
    });
    delete legacyInterface[key];
  }
  const depthError = getStorageSteppedDepthError(params.interface);
  if (depthError) throw new Error(`${depthError.path}: ${depthError.message}`);
  if (
    Math.abs(
      params.interface.trayThickness - STORAGE_STEPPED_TRAY_THICKNESS,
    ) > EPSILON
  ) {
    throw new Error(
      `interface.trayThickness: 首版固定为 ${STORAGE_STEPPED_TRAY_THICKNESS}mm`,
    );
  }
  if (params.interface.rimThickness >= params.interface.lowerWallThickness) {
    throw new Error("interface.rimThickness: 上沿厚度必须小于下部壁厚");
  }

  for (const [key, label] of [
    ["slotSpacing", "槽位间距"],
    ["slotBoundarySpacing", "槽位边界间距"],
  ] as const) {
    requireFinite(params[key], key);
    if (params[key] < 0) {
      throw new Error(`${key}: ${label}不能为负`);
    }
  }

  if (!Array.isArray(params.trays)) {
    throw new Error("trays: 托盘配置必须是数组");
  }
  if (params.trays.length !== params.interface.stepCount) {
    throw new Error(
      `trays: 需要 ${params.interface.stepCount} 块托盘配置，当前为 ${params.trays.length} 块`,
    );
  }
  // 托盘顺序即阶顺序；stepIndex 与数组位置不一致时直接报错，避免静默重排。
  params.trays = params.trays.map((tray, index) =>
    normalizeTray(tray, index, recorder),
  );

  return params;
}
