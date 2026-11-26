import type { IdFactory } from "@/lib/model-ports";
import type {
  StorageSteppedHeightSpecId,
  StorageSteppedInterfaceParams,
  StorageSteppedParams,
  StorageSteppedTrayConfig,
} from "@/types/storage-stepped";
import { STORAGE_STEPPED_INTERFACE_VERSION } from "@/types/storage-stepped";

export { STORAGE_STEPPED_INTERFACE_VERSION };
import { BASE_HOLE_PARAM_DEFAULTS } from "@/lib/base-hole-config";

/** 首版固定托盘总厚度 (mm)；不随槽深自动增加。 */
export const STORAGE_STEPPED_TRAY_THICKNESS = 6;
/** 首版固定阶数。 */
export const STORAGE_STEPPED_STEP_COUNT = 3;
/** 首版固定台阶步进 (mm)。 */
export const STORAGE_STEPPED_STEP_RISE = 40;
/** 默认槽深 (mm)；槽底厚 = 托盘总厚度 − 槽深。 */
export const STORAGE_STEPPED_DEFAULT_HOLE_DEPTH = 3;
export const STORAGE_STEPPED_DEFAULT_SLOT_SPACING = 5;
export const STORAGE_STEPPED_DEFAULT_SLOT_BOUNDARY_SPACING = 3;

/** 打样默认接口参数。任何偏离都要重新记录兼容性说明。 */
export const STORAGE_STEPPED_INTERFACE_DEFAULTS: StorageSteppedInterfaceParams = {
  bodyWidth: 240,
  moduleDepth: 80,
  stepCount: STORAGE_STEPPED_STEP_COUNT,
  trayThickness: STORAGE_STEPPED_TRAY_THICKNESS,
  lowerWallThickness: 4,
  rimThickness: 2,
  fingerPullDiameter: 32,
  baseThickness: 2.4,
  assemblyClearance: 0.3,
};

export interface StorageSteppedHeightSpec {
  id: StorageSteppedHeightSpecId;
  label: string;
  /** 首阶台面高度 (mm) */
  firstStepHeight: number;
  /** 台阶步进高度 (mm) */
  stepRise: number;
  stepCount: number;
}

export const STORAGE_STEPPED_HEIGHT_SPECS: Record<
  StorageSteppedHeightSpecId,
  StorageSteppedHeightSpec
> = {
  standard: {
    id: "standard",
    label: "标准高度 30/70/110",
    firstStepHeight: 30,
    stepRise: STORAGE_STEPPED_STEP_RISE,
    stepCount: STORAGE_STEPPED_STEP_COUNT,
  },
  storage: {
    id: "storage",
    label: "收纳高度 40/80/120",
    firstStepHeight: 40,
    stepRise: STORAGE_STEPPED_STEP_RISE,
    stepCount: STORAGE_STEPPED_STEP_COUNT,
  },
};

export const STORAGE_STEPPED_HEIGHT_SPEC_IDS: StorageSteppedHeightSpecId[] = [
  "standard",
  "storage",
];

export function isStorageSteppedHeightSpecId(
  value: unknown,
): value is StorageSteppedHeightSpecId {
  return value === "standard" || value === "storage";
}

/** 稳定的零件身份；主体与三块托盘各自独立缓存与导出。 */
export const STORAGE_STEPPED_BODY_PART_ID = "body";

export function storageSteppedTrayPartId(stepIndex: number): string {
  return `tray-${stepIndex + 1}`;
}

export function storageSteppedPartLabel(partId: string): string {
  if (partId === STORAGE_STEPPED_BODY_PART_ID) return "主体";
  const match = /^tray-(\d+)$/.exec(partId);
  return match ? `第 ${match[1]} 阶托盘` : partId;
}

/**
 * 稳定文件名片段：文件名必须包含高度规格、零件身份与接口版本，
 * 避免两种主体或相同托盘互相覆盖。
 */
export function storageSteppedInterfaceFileTag(
  params: Pick<StorageSteppedParams, "interfaceVersion">,
): string {
  return `ssi${params.interfaceVersion}`;
}

export function storageSteppedHeightFileTag(
  params: Pick<StorageSteppedParams, "heightSpecId">,
): string {
  return params.heightSpecId;
}

export function storageSteppedPartFileStem(
  params: Pick<StorageSteppedParams, "heightSpecId" | "interfaceVersion">,
  partId: string,
): string {
  const part = partId === STORAGE_STEPPED_BODY_PART_ID
    ? "body"
    : partId.replace(/^tray-/, "tray-step");
  return `storage_stepped_${storageSteppedHeightFileTag(params)}_${part}_${storageSteppedInterfaceFileTag(params)}`;
}

export const STORAGE_STEPPED_LIMITS = {
  bodyWidth: { label: "主体宽度", min: 120, max: 600, step: 1, unit: "mm" },
  moduleDepth: { label: "单阶深度", min: 50, max: 300, step: 1, unit: "mm" },
  lowerWallThickness: {
    label: "下部壁厚",
    min: 1.2,
    max: 20,
    step: 0.2,
    unit: "mm",
  },
  rimThickness: { label: "上沿厚度", min: 0.6, max: 10, step: 0.2, unit: "mm" },
  fingerPullDiameter: {
    label: "指扣直径",
    min: 10,
    max: 60,
    step: 1,
    unit: "mm",
  },
  baseThickness: { label: "主体底板厚度", min: 0.8, max: 10, step: 0.2, unit: "mm" },
  assemblyClearance: {
    label: "单边装配间隙",
    min: 0,
    max: 2,
    step: 0.05,
    unit: "mm",
  },
  holeDepth: { label: "槽深", min: 0.6, max: 5, step: 0.2, unit: "mm" },
  slotSpacing: { label: "槽位间距", min: 0, max: 20, step: 0.5, unit: "mm" },
  slotBoundarySpacing: {
    label: "槽位边距",
    min: 0,
    max: 20,
    step: 0.5,
    unit: "mm",
  },
  magnetPostHoleDiameter: {
    label: "磁铁桩孔直径",
    min: 1,
    max: 15,
    step: 0.1,
    unit: "mm",
  },
  magnetPostHoleDepth: {
    label: "磁铁桩孔深度",
    min: 0.5,
    max: 3,
    step: 0.1,
    unit: "mm",
  },
} as const;

export function createStorageSteppedTrayConfig(
  stepIndex: number,
): StorageSteppedTrayConfig {
  return {
    stepIndex,
    presetId: "flat",
    slots: [],
    holeDepth: STORAGE_STEPPED_DEFAULT_HOLE_DEPTH,
    baseHoleStructure: "none",
    magnetPostHoleDiameter: BASE_HOLE_PARAM_DEFAULTS.magnetPostHoleDiameter,
    magnetPostHoleDepth: BASE_HOLE_PARAM_DEFAULTS.magnetPostHoleDepth,
    baseHoleSize: BASE_HOLE_PARAM_DEFAULTS.baseHoleSize,
    smallBaseHoleSize: BASE_HOLE_PARAM_DEFAULTS.smallBaseHoleSize,
  };
}

export function createDefaultStorageSteppedParams(
  heightSpecId: StorageSteppedHeightSpecId = "standard",
): StorageSteppedParams {
  const spec = STORAGE_STEPPED_HEIGHT_SPECS[heightSpecId];
  return {
    interfaceVersion: STORAGE_STEPPED_INTERFACE_VERSION,
    heightSpecId: spec.id,
    firstStepHeight: spec.firstStepHeight,
    stepRise: spec.stepRise,
    interface: { ...STORAGE_STEPPED_INTERFACE_DEFAULTS },
    trays: Array.from({ length: spec.stepCount }, (_, index) =>
      createStorageSteppedTrayConfig(index),
    ),
    slotSpacing: STORAGE_STEPPED_DEFAULT_SLOT_SPACING,
    slotBoundarySpacing: STORAGE_STEPPED_DEFAULT_SLOT_BOUNDARY_SPACING,
  };
}

/** 生成后的参数深拷贝；用于预设、复制与导入，避免共享数组与对象。 */
export function cloneStorageSteppedParams(
  params: StorageSteppedParams,
): StorageSteppedParams {
  return structuredClone(params);
}

export function cloneStorageSteppedTrayConfig(
  tray: StorageSteppedTrayConfig,
): StorageSteppedTrayConfig {
  return structuredClone(tray);
}

/**
 * 把某一阶托盘配置深拷贝到另一阶（含槽位）。
 * 新配置获得新的槽位 ID，其余尺寸与几何快照按值独立保存。
 */
export function copyStorageSteppedTrayConfig(
  params: StorageSteppedParams,
  fromStepIndex: number,
  toStepIndex: number,
  idFactory: IdFactory,
): StorageSteppedParams {
  const source = params.trays.find((tray) => tray.stepIndex === fromStepIndex);
  if (!source) {
    throw new Error(`找不到第 ${fromStepIndex + 1} 阶托盘配置`);
  }
  const copy = cloneStorageSteppedTrayConfig(source);
  copy.stepIndex = toStepIndex;
  copy.slots = copy.slots.map((slot) => ({
    ...slot,
    id: idFactory.createId(),
  }));
  return replaceStorageSteppedTray(params, copy);
}

/** 用新配置替换同阶托盘，保持按 stepIndex 排序。 */
export function replaceStorageSteppedTray(
  params: StorageSteppedParams,
  tray: StorageSteppedTrayConfig,
): StorageSteppedParams {
  const exists = params.trays.some(
    (candidate) => candidate.stepIndex === tray.stepIndex,
  );
  const trays = exists
    ? params.trays.map((candidate) =>
        candidate.stepIndex === tray.stepIndex ? tray : candidate,
      )
    : [...params.trays, tray];
  return {
    ...params,
    trays: [...trays].sort((left, right) => left.stepIndex - right.stepIndex),
  };
}

export function getStorageSteppedTray(
  params: StorageSteppedParams,
  stepIndex: number,
): StorageSteppedTrayConfig | undefined {
  return params.trays.find((tray) => tray.stepIndex === stepIndex);
}

/** 切换高度规格时同步实际首阶高度与步进，不改动任何托盘配置。 */
export function withStorageSteppedHeightSpec(
  params: StorageSteppedParams,
  heightSpecId: StorageSteppedHeightSpecId,
): StorageSteppedParams {
  const spec = STORAGE_STEPPED_HEIGHT_SPECS[heightSpecId];
  return {
    ...params,
    heightSpecId: spec.id,
    firstStepHeight: spec.firstStepHeight,
    stepRise: spec.stepRise,
  };
}
