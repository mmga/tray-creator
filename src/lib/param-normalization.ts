import type { TrayParams } from "@/types/tray";
import type {
  AppMode,
  BaseConverterParams,
  CustomLayoutParams,
  FreeSlot,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import { normalizeBaseConverterParams } from "@/lib/base-converter-config";
import { CUSTOM_LAYOUT_DEFAULTS, CUSTOM_LIMITS } from "@/lib/custom-config";
import { PARAM_CONFIG } from "@/lib/grid-config";
import { normalizeGridParams } from "@/lib/grid-model-state";
import {
  getRawSteppedDisconnectDistance,
  getRawSteppedSmoothingRadius,
  migrateCustomLegacyShape,
  migrateGridLegacyShape,
  migrateSteppedLegacyShape,
} from "@/lib/param-legacy-migration";
import {
  GROUP_COLORS,
  STEPPED_LAYOUT_DEFAULTS,
  STEPPED_LIMITS,
} from "@/lib/stepped-config";
import { applySteppedBaseHoleDerivedFields } from "@/lib/stepped-base-hole";
import { createGroupStructureOverrides } from "@/lib/stepped-group-params";
import {
  normalizeFreeSlotInstanceSnapshot,
} from "@/lib/slot-instance-factory";
import type { ImportNormalizationRecorder } from "@/lib/param-import-report";
import {
  recordBehaviorChange,
  recordDefault,
  recordMigration,
  recordValueAdjustment,
} from "@/lib/param-import-report";
import {
  isBaseHoleStructure,
  MAGNET_POST_HOLE_LIMITS,
  normalizeBaseHoleParams,
  resolveLargestMagneticBaseHolePreset,
} from "@/lib/base-hole-config";
import type { BaseHoleStructure } from "@/types/tray";
import {
  applyFlatTrayBaseHoleSupportingThickness,
} from "@/lib/base-hole-rules";

export type NormalizableParams =
  | TrayParams
  | BaseConverterParams
  | CustomLayoutParams
  | SteppedLayoutParams;

type ParamNormalizationStep<T extends NormalizableParams> = (
  params: T,
  recorder?: ImportNormalizationRecorder,
) => void;

type ParamNormalizationPipeline<T extends NormalizableParams> = {
  validateRequiredFields: ParamNormalizationStep<T>;
  migrateLegacyShape: ParamNormalizationStep<T>;
  normalizeSlotInstances: ParamNormalizationStep<T>;
  clampAndFillDerivedFields: ParamNormalizationStep<T>;
};

function getRawSteppedSplitRecessEnabled(obj: Record<string, unknown>) {
  if (typeof obj.enableSplitRecess === "boolean") {
    return obj.enableSplitRecess;
  }
  return obj.splitAssemblyMode === "locator-recess";
}

function getRawSteppedSplitAssemblyEnabled(obj: Record<string, unknown>) {
  return typeof obj.enableSplitAssembly === "boolean"
    ? obj.enableSplitAssembly
    : STEPPED_LAYOUT_DEFAULTS.enableSplitAssembly;
}

function getRawSteppedSplitGrooveType(obj: Record<string, unknown>) {
  return obj.splitGrooveType === "inset" ? "inset" : "profile";
}

function getRawSteppedSplitLocatorsEnabled(obj: Record<string, unknown>) {
  if (typeof obj.enableSplitLocators === "boolean") {
    return obj.enableSplitLocators;
  }
  return obj.splitAssemblyMode === "locator-recess";
}

function requireNumber(obj: Record<string, unknown>, key: string) {
  if (typeof obj[key] !== "number") {
    throw new Error(`缺少或无效的字段: ${key}`);
  }
}

function clampField(
  obj: Record<string, unknown>,
  key: string,
  config: { min: number; max: number },
  recorder?: ImportNormalizationRecorder,
  path = key,
  label = key,
) {
  const value = obj[key] as number;
  const normalizedValue = Math.max(config.min, Math.min(config.max, value));
  obj[key] = normalizedValue;
  if (normalizedValue !== value) {
    recordValueAdjustment(recorder, {
      path,
      label,
      previousValue: value,
      normalizedValue,
      reason: `当前允许范围为 ${config.min}–${config.max}`,
    });
  }
}

function normalizeReportedBaseHoleParams(
  obj: Record<string, unknown>,
  defaultStructure: BaseHoleStructure,
  recorder?: ImportNormalizationRecorder,
) {
  const previousStructure = obj.baseHoleStructure;
  const previousLegacyEnabled = obj.enableBaseHole;
  const previousDiameter = obj.magnetPostHoleDiameter;
  const previousDepth = obj.magnetPostHoleDepth;
  const normalized = normalizeBaseHoleParams(obj, defaultStructure);

  if (!isBaseHoleStructure(previousStructure)) {
    if (typeof previousLegacyEnabled === "boolean") {
      recordMigration(recorder, {
        path: "baseHoleStructure",
        label: "底板孔位结构",
        previousValue: previousLegacyEnabled,
        normalizedValue: normalized.baseHoleStructure,
        reason: "旧磁吸孔开关已迁移为互斥的底板孔位结构",
      });
    } else {
      recordDefault(recorder, {
        path: "baseHoleStructure",
        label: "底板孔位结构",
        normalizedValue: normalized.baseHoleStructure,
        reason: "旧文件未记录底板孔位结构",
      });
    }
  }

  for (const [key, previousValue, normalizedValue] of [
    ["magnetPostHoleDiameter", previousDiameter, normalized.magnetPostHoleDiameter],
    ["magnetPostHoleDepth", previousDepth, normalized.magnetPostHoleDepth],
  ] as const) {
    if (typeof previousValue !== "number" || !Number.isFinite(previousValue)) {
      recordDefault(recorder, {
        path: key,
        label: key === "magnetPostHoleDiameter" ? "磁铁桩孔直径" : "磁铁桩孔深度",
        normalizedValue,
        reason: "旧文件未记录磁铁桩孔尺寸",
      });
    } else if (previousValue !== normalizedValue) {
      const limits = key === "magnetPostHoleDiameter"
        ? MAGNET_POST_HOLE_LIMITS.diameter
        : MAGNET_POST_HOLE_LIMITS.depth;
      recordValueAdjustment(recorder, {
        path: key,
        label: limits.label,
        previousValue,
        normalizedValue,
        reason: `当前允许范围为 ${limits.min}–${limits.max}`,
      });
    }
  }

  Object.assign(obj, normalized);
  delete obj.enableBaseHole;
}

function runParamNormalizationPipeline<T extends NormalizableParams>(
  params: T,
  pipeline: ParamNormalizationPipeline<T>,
  recorder?: ImportNormalizationRecorder,
): T {
  pipeline.validateRequiredFields(params, recorder);
  pipeline.migrateLegacyShape(params, recorder);
  pipeline.normalizeSlotInstances(params, recorder);
  pipeline.clampAndFillDerivedFields(params, recorder);
  return params;
}

export function normalizeParamsForMode(
  mode: AppMode,
  params: NormalizableParams,
  recorder?: ImportNormalizationRecorder,
): NormalizableParams {
  const resolvedMode = mode;

  if (resolvedMode === "base-converter") {
    const raw = params as BaseConverterParams;
    if (typeof raw.sourceStandardId !== "string") {
      throw new Error("缺少或无效的字段: sourceStandardId");
    }
    if (typeof raw.targetStandardId !== "string") {
      throw new Error("缺少或无效的字段: targetStandardId");
    }
    requireNumber(raw as unknown as Record<string, unknown>, "floorThickness");
    requireNumber(raw as unknown as Record<string, unknown>, "recessDepth");
    const normalized = normalizeBaseConverterParams(raw);
    for (const key of [
      "sourceStandardId",
      "targetStandardId",
      "floorThickness",
      "recessDepth",
      "sideBevelWidth",
    ] as const) {
      if (normalized[key] !== raw[key]) {
        recordValueAdjustment(recorder, {
          path: key,
          label: key,
          previousValue: raw[key],
          normalizedValue: normalized[key],
          reason: "已调整为当前支持的转换底盘标准或参数范围",
        });
      }
    }
    return normalized;
  }

  if (resolvedMode === "grid") {
    return runParamNormalizationPipeline(
      params as TrayParams,
      gridParamNormalizationPipeline,
      recorder,
    );
  }
  if (resolvedMode === "stepped") {
    return runParamNormalizationPipeline(
      params as SteppedLayoutParams,
      steppedParamNormalizationPipeline,
      recorder,
    );
  }
  return runParamNormalizationPipeline(
    params as CustomLayoutParams,
    customParamNormalizationPipeline,
    recorder,
  );
}

export function migrateCustomParamsToStepped(
  customParams: CustomLayoutParams,
): SteppedLayoutParams {
  runParamNormalizationPipeline(customParams, customParamNormalizationPipeline);
  const defaultGroupId = crypto.randomUUID();
  const steppedParams: SteppedLayoutParams = {
    trayWidth: customParams.trayWidth,
    trayDepth: customParams.trayDepth,
    slots: customParams.slots.map((slot) => ({
      ...slot,
      shape: "circle" as const,
      height: slot.width,
      outerOffset: undefined,
      profileExponent: undefined,
      groupId: defaultGroupId,
    })),
    groups: [
      {
        id: defaultGroupId,
        name: "组 1",
        color: GROUP_COLORS[0],
        bottomHeight: 10,
        ...createGroupStructureOverrides({
          smoothingRadius: STEPPED_LAYOUT_DEFAULTS.smoothingRadius,
          disconnectDistance: STEPPED_LAYOUT_DEFAULTS.disconnectDistance,
        }),
      },
    ],
    activeGroupId: defaultGroupId,
    spacing: customParams.spacing,
    holeDepth: customParams.holeDepth || 3,
    splitGrooveDepth: STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth,
    enableSplitAssembly: STEPPED_LAYOUT_DEFAULTS.enableSplitAssembly,
    enableSplitRecess: STEPPED_LAYOUT_DEFAULTS.enableSplitRecess,
    splitGrooveType: STEPPED_LAYOUT_DEFAULTS.splitGrooveType,
    enableSplitLocators: STEPPED_LAYOUT_DEFAULTS.enableSplitLocators,
    smoothingRadius: STEPPED_LAYOUT_DEFAULTS.smoothingRadius,
    disconnectDistance: STEPPED_LAYOUT_DEFAULTS.disconnectDistance,
    baseHoleStructure: customParams.baseHoleStructure,
    magnetPostHoleDiameter: STEPPED_LAYOUT_DEFAULTS.magnetPostHoleDiameter,
    magnetPostHoleDepth: STEPPED_LAYOUT_DEFAULTS.magnetPostHoleDepth,
    baseHoleSize: customParams.baseHoleSize,
  };
  return runParamNormalizationPipeline(
    steppedParams,
    steppedParamNormalizationPipeline,
  );
}

const gridParamNormalizationPipeline: ParamNormalizationPipeline<TrayParams> = {
  validateRequiredFields: validateGridRequiredFields,
  migrateLegacyShape: migrateGridLegacyShape,
  normalizeSlotInstances: normalizeGridSlotInstances,
  clampAndFillDerivedFields: clampAndFillGridDerivedFields,
};

const customParamNormalizationPipeline: ParamNormalizationPipeline<CustomLayoutParams> =
  {
    validateRequiredFields: validateCustomRequiredFields,
    migrateLegacyShape: migrateCustomLegacyShape,
    normalizeSlotInstances: normalizeCustomSlotInstances,
    clampAndFillDerivedFields: clampAndFillCustomDerivedFields,
  };

const steppedParamNormalizationPipeline: ParamNormalizationPipeline<SteppedLayoutParams> =
  {
    validateRequiredFields: validateSteppedRequiredFields,
    migrateLegacyShape: migrateSteppedLegacyShape,
    normalizeSlotInstances: normalizeSteppedSlotInstances,
    clampAndFillDerivedFields: clampAndFillSteppedDerivedFields,
  };

function validateGridRequiredFields(params: TrayParams) {
  const obj = params as unknown as Record<string, unknown>;
  for (const field of [
    "rows",
    "columns",
    "holeDiameter",
    "spacing",
    "baseThickness",
    "holeDepth",
    "cornerRadius",
  ]) {
    requireNumber(obj, field);
  }

  const holeDiameter = obj.holeDiameter as number;
  if (holeDiameter <= 0 || holeDiameter > 200) {
    throw new Error("holeDiameter: 超出合理范围 (0, 200]");
  }
}

function normalizeGridSlotInstances(
  params: TrayParams,
  recorder?: ImportNormalizationRecorder,
) {
  const obj = params as unknown as Record<string, unknown>;
  const previousSlotDefinitionId = obj.slotDefinitionId;
  const previousSlotDiameter = obj.slotDiameter;
  const previousBaseThickness = obj.baseThickness;
  normalizeReportedBaseHoleParams(obj, "none", recorder);
  if (obj.basePlateOnly) {
    obj.baseHoleStructure = "magnetic-base-hole";
  }
  const normalized = normalizeGridParams(params);
  Object.assign(params, normalized);
  if (normalized.baseThickness !== previousBaseThickness) {
    recordBehaviorChange(recorder, {
      path: "baseThickness",
      label: "底板厚度",
      previousValue: previousBaseThickness,
      normalizedValue: normalized.baseThickness,
      reason: "已自动提高以容纳底板孔位并保留最小底壁",
    });
  }
  if (previousSlotDefinitionId !== normalized.slotDefinitionId) {
    recordMigration(recorder, {
      path: "slotDefinitionId",
      label: "Slot Definition 标识",
      previousValue: previousSlotDefinitionId,
      normalizedValue: normalized.slotDefinitionId,
      reason: "按当前 Slot Definition 补全网格凹槽身份",
      technical: true,
    });
  }
  if (previousSlotDiameter !== normalized.slotDiameter) {
    recordDefault(recorder, {
      path: "slotDiameter",
      label: "最终凹槽尺寸",
      normalizedValue: normalized.slotDiameter,
      reason: "旧网格文件未保存 Slot Geometry Snapshot",
      technical: true,
    });
  }
}

function clampAndFillGridDerivedFields(
  params: TrayParams,
  recorder?: ImportNormalizationRecorder,
) {
  const obj = params as unknown as Record<string, unknown>;
  clampField(obj, "columns", PARAM_CONFIG.columns, recorder, "columns", "列数");
  clampField(obj, "rows", PARAM_CONFIG.rows, recorder, "rows", "行数");
  clampField(obj, "spacing", PARAM_CONFIG.spacing, recorder, "spacing", "凹槽间距");
  clampField(obj, "baseThickness", PARAM_CONFIG.baseThickness, recorder, "baseThickness", "底板厚度");
  clampField(obj, "holeDepth", PARAM_CONFIG.holeDepth, recorder, "holeDepth", "凹槽深度");
  clampField(obj, "cornerRadius", PARAM_CONFIG.cornerRadius, recorder, "cornerRadius", "圆角半径");
  clampField(obj, "sideBevelWidth", PARAM_CONFIG.sideBevelWidth, recorder, "sideBevelWidth", "侧面斜角宽度");

  clampField(obj, "spacingX", PARAM_CONFIG.spacingX, recorder, "spacingX", "横向间距");
  clampField(obj, "spacingY", PARAM_CONFIG.spacingY, recorder, "spacingY", "纵向间距");
  if (!obj.spacingIndependent) {
    const previousX = obj.spacingX;
    const previousY = obj.spacingY;
    obj.spacingX = obj.spacing;
    obj.spacingY = obj.spacing;
    if (previousX !== obj.spacingX || previousY !== obj.spacingY) {
      recordBehaviorChange(recorder, {
        path: "spacingX,spacingY",
        label: "横纵间距联动",
        previousValue: `${String(previousX)}, ${String(previousY)}`,
        normalizedValue: obj.spacing,
        reason: "横纵间距未启用独立设置",
      });
    }
  }

  clampField(obj, "boundarySpacing", PARAM_CONFIG.boundarySpacing, recorder, "boundarySpacing", "边界间距");
  if (!obj.boundarySpacingIndependent) {
    const previous = obj.boundarySpacing;
    obj.boundarySpacing = obj.spacing;
    if (previous !== obj.boundarySpacing) {
      recordBehaviorChange(recorder, {
        path: "boundarySpacing",
        label: "边界间距联动",
        previousValue: previous,
        normalizedValue: obj.boundarySpacing,
        reason: "边界间距未启用独立设置",
      });
    }
  }

  if (obj.rows !== 1 && obj.columns !== 1) {
    obj.halfCircleSlots = false;
  }
  if (obj.basePlateOnly) {
    obj.halfCircleSlots = false;
  }
  Object.assign(params, normalizeGridParams(params));
}

function validateCustomRequiredFields(params: CustomLayoutParams) {
  const obj = params as unknown as Record<string, unknown>;
  for (const field of [
    "trayWidth",
    "trayDepth",
    "spacing",
    "baseThickness",
    "holeDepth",
    "cornerRadius",
  ]) {
    requireNumber(obj, field);
  }

  if (!Array.isArray(obj.slots)) {
    throw new Error("缺少或无效的字段: slots");
  }

  const slots = obj.slots as Record<string, unknown>[];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (!slot || typeof slot !== "object") {
      throw new Error(`slots[${index}]: 无效的凹槽数据`);
    }

    for (const key of ["x", "y", "width", "height", "rotation"] as const) {
      if (
        typeof slot[key] !== "number" ||
        !Number.isFinite(slot[key] as number)
      ) {
        throw new Error(`slots[${index}].${key}: 缺少或无效（需要有限数字）`);
      }
    }

    if (slot.shape !== "circle" && slot.shape !== "ellipse") {
      throw new Error(`slots[${index}].shape: 必须是 "circle" 或 "ellipse"`);
    }

    const width = slot.width as number;
    const height = slot.height as number;
    if (width <= 0 || width > 200) {
      throw new Error(`slots[${index}].width: 超出合理范围 (0, 200]`);
    }
    if (height <= 0 || height > 200) {
      throw new Error(`slots[${index}].height: 超出合理范围 (0, 200]`);
    }
  }
}

function normalizeCustomSlotInstances(
  params: CustomLayoutParams,
  recorder?: ImportNormalizationRecorder,
) {
  const obj = params as unknown as Record<string, unknown>;
  const slots = obj.slots as Record<string, unknown>[];
  let normalizedSnapshotCount = 0;
  for (const slot of slots) {
    const before = JSON.stringify(slot);
    Object.assign(
      slot,
      normalizeFreeSlotInstanceSnapshot(slot as unknown as FreeSlot),
    );
    if (slot.shape === "ellipse") {
      delete slot.slotWidth;
      delete slot.slotHeight;
    } else {
      delete slot.outerOffset;
      delete slot.profileExponent;
    }
    if (JSON.stringify(slot) !== before) {
      normalizedSnapshotCount += 1;
    }
  }
  if (normalizedSnapshotCount > 0) {
    recordMigration(recorder, {
      path: "slots[]",
      label: "Slot Geometry Snapshot",
      previousValue: "旧 Slot Instance 几何",
      normalizedValue: `已规范化 ${normalizedSnapshotCount} 个 Slot Instance`,
      reason: "保证导入后的模型几何可复现",
      technical: true,
      count: normalizedSnapshotCount,
    });
  }
}

function clampAndFillCustomDerivedFields(
  params: CustomLayoutParams,
  recorder?: ImportNormalizationRecorder,
) {
  const obj = params as unknown as Record<string, unknown>;
  const slots = obj.slots as Record<string, unknown>[];
  clampField(obj, "trayWidth", CUSTOM_LIMITS.trayWidth, recorder, "trayWidth", "托盘宽度");
  clampField(obj, "trayDepth", CUSTOM_LIMITS.trayDepth, recorder, "trayDepth", "托盘深度");
  clampField(obj, "spacing", CUSTOM_LIMITS.spacing, recorder, "spacing", "凹槽间距");
  clampField(obj, "boundarySpacing", CUSTOM_LIMITS.boundarySpacing, recorder, "boundarySpacing", "边界间距");
  clampField(obj, "baseThickness", CUSTOM_LIMITS.baseThickness, recorder, "baseThickness", "底板厚度");
  clampField(obj, "holeDepth", CUSTOM_LIMITS.holeDepth, recorder, "holeDepth", "凹槽深度");
  clampField(obj, "cornerRadius", CUSTOM_LIMITS.cornerRadius, recorder, "cornerRadius", "圆角半径");
  clampField(obj, "sideBevelWidth", CUSTOM_LIMITS.sideBevelWidth, recorder, "sideBevelWidth", "侧面斜角宽度");

  if (typeof obj.smoothingRadius !== "number" || !Number.isFinite(obj.smoothingRadius)) {
    obj.smoothingRadius = CUSTOM_LAYOUT_DEFAULTS.smoothingRadius;
    recordDefault(recorder, {
      path: "smoothingRadius",
      label: "平滑半径",
      normalizedValue: obj.smoothingRadius,
      reason: "旧自定义文件未记录贴合轮廓平滑半径",
    });
  }
  clampField(obj, "smoothingRadius", CUSTOM_LIMITS.smoothingRadius, recorder, "smoothingRadius", "平滑半径");
  if (typeof obj.disconnectDistance !== "number" || !Number.isFinite(obj.disconnectDistance)) {
    obj.disconnectDistance = CUSTOM_LAYOUT_DEFAULTS.disconnectDistance;
    recordDefault(recorder, {
      path: "disconnectDistance",
      label: "槽群断连距离",
      normalizedValue: obj.disconnectDistance,
      reason: "旧自定义文件未记录贴合轮廓断连距离",
    });
  }
  clampField(obj, "disconnectDistance", CUSTOM_LIMITS.disconnectDistance, recorder, "disconnectDistance", "槽群断连距离");

  // 补全 Baseplate Footprint Style；缺失时默认 rectangular 以兼容旧自定义文件（CONTEXT:591）
  const previousFootprintStyle = obj.footprintStyle;
  if (previousFootprintStyle !== "rectangular" && previousFootprintStyle !== "contoured") {
    obj.footprintStyle = "rectangular";
    recordDefault(recorder, {
      path: "footprintStyle",
      label: "底座轮廓样式",
      normalizedValue: "rectangular",
      reason: "旧自定义文件未记录底座轮廓样式，默认矩形包络",
    });
  }

  const previousSizingMode = obj.traySizingMode;
  obj.traySizingMode = obj.traySizingMode === "fixed" ? "fixed" : "auto";
  if (previousSizingMode !== obj.traySizingMode) {
    recordDefault(recorder, {
      path: "traySizingMode",
      label: "托盘尺寸模式",
      normalizedValue: obj.traySizingMode,
      reason: "旧自定义文件默认使用自动尺寸",
    });
  }

  if (!obj.boundarySpacingIndependent) {
    const previous = obj.boundarySpacing;
    obj.boundarySpacing = obj.spacing;
    if (previous !== obj.boundarySpacing) {
      recordBehaviorChange(recorder, {
        path: "boundarySpacing",
        label: "边界间距联动",
        previousValue: previous,
        normalizedValue: obj.boundarySpacing,
        reason: "边界间距未启用独立设置",
      });
    }
  }
  normalizeReportedBaseHoleParams(obj, "none", recorder);
  obj.baseHoleSize = resolveLargestMagneticBaseHolePreset(slots.map((slot) => ({
    shape: slot.shape === "ellipse" ? "ellipse" as const : "circle" as const,
    width: slot.width as number,
    height: slot.height as number,
  })));
  const previousBaseThickness = obj.baseThickness;
  Object.assign(params, applyFlatTrayBaseHoleSupportingThickness(params));
  if (params.baseThickness !== previousBaseThickness) {
    recordBehaviorChange(recorder, {
      path: "baseThickness",
      label: "底板厚度",
      previousValue: previousBaseThickness,
      normalizedValue: params.baseThickness,
      reason: "已自动提高以容纳底板孔位并保留最小底壁",
    });
  }
}

function validateSteppedRequiredFields(params: SteppedLayoutParams) {
  const obj = params as unknown as Record<string, unknown>;
  for (const field of ["trayWidth", "trayDepth", "spacing", "holeDepth"]) {
    requireNumber(obj, field);
  }
  if (!Array.isArray(obj.slots)) {
    throw new Error("缺少或无效的字段: slots");
  }
}

function normalizeSteppedSlotInstances(
  params: SteppedLayoutParams,
  recorder?: ImportNormalizationRecorder,
) {
  const obj = params as unknown as Record<string, unknown>;
  const slots = obj.slots as Record<string, unknown>[];
  const groupIds = new Set(
    (obj.groups as { id: string }[]).map((group) => group.id),
  );
  if (
    typeof obj.activeGroupId !== "string" ||
    !groupIds.has(obj.activeGroupId as string)
  ) {
    obj.activeGroupId = (obj.groups as { id: string }[])[0]?.id ?? "";
  }

  let normalizedSnapshotCount = 0;
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const before = JSON.stringify(slot);
    if (!slot || typeof slot !== "object") {
      throw new Error(`slots[${index}]: 无效的凹槽数据`);
    }

    for (const key of ["x", "y", "width", "height", "rotation"] as const) {
      if (
        typeof slot[key] !== "number" ||
        !Number.isFinite(slot[key] as number)
      ) {
        throw new Error(`slots[${index}].${key}: 缺少或无效（需要有限数字）`);
      }
    }

    if (slot.shape !== "circle" && slot.shape !== "ellipse") {
      slot.shape = "circle";
    }
    if (slot.shape === "circle") {
      slot.height = slot.width;
    }
    const width = slot.width as number;
    const height = slot.height as number;
    if (width <= 0 || width > 200) {
      throw new Error(`slots[${index}].width: 超出合理范围 (0, 200]`);
    }
    if (height <= 0 || height > 200) {
      throw new Error(`slots[${index}].height: 超出合理范围 (0, 200]`);
    }
    if (typeof slot.id !== "string" || !slot.id) {
      slot.id = crypto.randomUUID();
    }
    Object.assign(
      slot,
      normalizeFreeSlotInstanceSnapshot(slot as unknown as FreeSlot),
    );
    if (slot.shape === "circle") {
      delete slot.outerOffset;
      delete slot.profileExponent;
    }
    if (
      typeof slot.groupId !== "string" ||
      !groupIds.has(slot.groupId as string)
    ) {
      slot.groupId = (obj.groups as { id: string }[])[0]?.id ?? "";
    }
    delete slot.bottomHeight;
    if (JSON.stringify(slot) !== before) {
      normalizedSnapshotCount += 1;
    }
  }
  if (normalizedSnapshotCount > 0) {
    recordMigration(recorder, {
      path: "slots[]",
      label: "阶梯 Slot Geometry Snapshot",
      previousValue: "旧 Slot Instance 几何",
      normalizedValue: `已规范化 ${normalizedSnapshotCount} 个 Slot Instance`,
      reason: "保证导入后的模型几何和分组关系可复现",
      technical: true,
      count: normalizedSnapshotCount,
    });
  }
}

function clampAndFillSteppedDerivedFields(
  params: SteppedLayoutParams,
  recorder?: ImportNormalizationRecorder,
) {
  const obj = params as unknown as Record<string, unknown>;
  const groups = obj.groups as Record<string, unknown>[];
  const rawSmoothingRadius = getRawSteppedSmoothingRadius(obj);
  const rawDisconnectDistance = getRawSteppedDisconnectDistance(obj);
  const rawSplitAssemblyEnabled = getRawSteppedSplitAssemblyEnabled(obj);
  const rawSplitRecessEnabled = getRawSteppedSplitRecessEnabled(obj);
  const rawSplitGrooveType = getRawSteppedSplitGrooveType(obj);
  const rawSplitLocatorsEnabled = getRawSteppedSplitLocatorsEnabled(obj);

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    clampField(
      group as Record<string, unknown>,
      "bottomHeight",
      STEPPED_LIMITS.bottomHeight,
      recorder,
      `groups[${index}].bottomHeight`,
      `第 ${index + 1} 个分组高度`,
    );
    clampField(
      group as Record<string, unknown>,
      "groupSmoothingRadius",
      STEPPED_LIMITS.smoothingRadius,
      recorder,
      `groups[${index}].groupSmoothingRadius`,
      `第 ${index + 1} 个分组平滑半径`,
    );
    clampField(
      group as Record<string, unknown>,
      "groupDisconnectDistance",
      STEPPED_LIMITS.disconnectDistance,
      recorder,
      `groups[${index}].groupDisconnectDistance`,
      `第 ${index + 1} 个分组断开距离`,
    );
  }

  clampField(obj, "trayWidth", STEPPED_LIMITS.trayWidth, recorder, "trayWidth", "托盘宽度");
  clampField(obj, "trayDepth", STEPPED_LIMITS.trayDepth, recorder, "trayDepth", "托盘深度");
  clampField(obj, "spacing", STEPPED_LIMITS.spacing, recorder, "spacing", "凹槽间距");
  clampField(obj, "holeDepth", STEPPED_LIMITS.holeDepth, recorder, "holeDepth", "凹槽深度");

  // 补全 Baseplate Footprint Style；缺失时默认 contoured 以兼容旧阶梯文件（CONTEXT:592）
  const previousFootprintStyle = obj.footprintStyle;
  if (previousFootprintStyle !== "rectangular" && previousFootprintStyle !== "contoured") {
    obj.footprintStyle = "contoured";
    recordDefault(recorder, {
      path: "footprintStyle",
      label: "底座轮廓样式",
      normalizedValue: "contoured",
      reason: "旧阶梯文件未记录底座轮廓样式，默认贴合轮廓",
    });
  }

  // 补全 boundarySpacing / boundarySpacingIndependent（CONTEXT:611-613）
  if (typeof obj.boundarySpacingIndependent !== "boolean") {
    obj.boundarySpacingIndependent = false;
    recordDefault(recorder, {
      path: "boundarySpacingIndependent",
      label: "边界间距独立设置",
      normalizedValue: false,
      reason: "旧阶梯文件默认让边界间距跟随凹槽间距",
    });
  }
  if (typeof obj.boundarySpacing !== "number" || !Number.isFinite(obj.boundarySpacing as number)) {
    obj.boundarySpacing = obj.spacing;
    recordDefault(recorder, {
      path: "boundarySpacing",
      label: "边界间距",
      normalizedValue: obj.boundarySpacing,
      reason: "旧阶梯文件未记录边界间距，沿用凹槽间距",
    });
  } else {
    clampField(obj, "boundarySpacing", STEPPED_LIMITS.boundarySpacing, recorder, "boundarySpacing", "边界间距");
  }
  if (!obj.boundarySpacingIndependent) {
    const previous = obj.boundarySpacing;
    obj.boundarySpacing = obj.spacing;
    if (previous !== obj.boundarySpacing) {
      recordBehaviorChange(recorder, {
        path: "boundarySpacing",
        label: "边界间距联动",
        previousValue: previous,
        normalizedValue: obj.boundarySpacing,
        reason: "边界间距未启用独立设置",
      });
    }
  }

  // 矩形阶梯专属字段：traySizingMode、cornerRadius（contoured 时休眠但保留）
  const previousSizingMode = obj.traySizingMode;
  obj.traySizingMode = obj.traySizingMode === "fixed" ? "fixed" : "auto";
  if (previousSizingMode !== obj.traySizingMode) {
    recordDefault(recorder, {
      path: "traySizingMode",
      label: "托盘尺寸模式",
      normalizedValue: obj.traySizingMode,
      reason: "旧阶梯文件默认使用自动尺寸",
    });
  }
  if (typeof obj.cornerRadius !== "number" || !Number.isFinite(obj.cornerRadius as number)) {
    obj.cornerRadius = STEPPED_LAYOUT_DEFAULTS.cornerRadius;
    recordDefault(recorder, {
      path: "cornerRadius",
      label: "底板圆角",
      normalizedValue: obj.cornerRadius,
      reason: "旧阶梯文件未记录最低层外圆角",
    });
  } else {
    clampField(obj, "cornerRadius", STEPPED_LIMITS.cornerRadius, recorder, "cornerRadius", "底板圆角");
  }

  normalizeReportedBaseHoleParams(obj, "none", recorder);
  if (obj.splitGrooveDepth !== STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth) {
    recordValueAdjustment(recorder, {
      path: "splitGrooveDepth",
      label: "分件装配槽深度",
      previousValue: obj.splitGrooveDepth,
      normalizedValue: STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth,
      reason: "当前阶梯构造使用固定装配槽深度",
    });
  }
  obj.splitGrooveDepth = STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth;
  obj.enableSplitAssembly = rawSplitAssemblyEnabled;
  obj.enableSplitRecess = rawSplitRecessEnabled;
  obj.splitGrooveType = rawSplitGrooveType;
  obj.enableSplitLocators = rawSplitLocatorsEnabled;
  if ("splitAssemblyMode" in obj) {
    recordMigration(recorder, {
      path: "splitAssemblyMode",
      label: "分件装配方式",
      previousValue: obj.splitAssemblyMode,
      normalizedValue: {
        enableSplitRecess: rawSplitRecessEnabled,
        splitGrooveType: rawSplitGrooveType,
        enableSplitLocators: rawSplitLocatorsEnabled,
      },
      reason: "旧装配方式已拆分为装配槽类型与 Locator Pin 设置",
    });
  }
  delete obj.splitAssemblyMode;

  if (
    typeof obj.smoothingRadius !== "number" ||
    !Number.isFinite(obj.smoothingRadius)
  ) {
    obj.smoothingRadius = rawSmoothingRadius;
    recordMigration(recorder, {
      path: "smoothingRadius",
      label: "全局平滑半径",
      previousValue: obj.bridgeRadius,
      normalizedValue: rawSmoothingRadius,
      reason: "旧 bridgeRadius 已迁移为 smoothingRadius",
    });
  }
  delete obj.bridgeRadius;
  clampField(obj, "smoothingRadius", STEPPED_LIMITS.smoothingRadius, recorder, "smoothingRadius", "全局平滑半径");

  if (
    typeof obj.disconnectDistance !== "number" ||
    !Number.isFinite(obj.disconnectDistance)
  ) {
    obj.disconnectDistance = rawDisconnectDistance;
  }
  clampField(obj, "disconnectDistance", STEPPED_LIMITS.disconnectDistance, recorder, "disconnectDistance", "全局断开距离");

  const previousGroupHeights = new Map(
    params.groups.map((group) => [group.id, group.bottomHeight]),
  );
  const normalized = applySteppedBaseHoleDerivedFields(params);
  Object.assign(params, normalized);
  normalized.groups.forEach((group, index) => {
    const previousValue = previousGroupHeights.get(group.id);
    if (previousValue !== undefined && group.bottomHeight !== previousValue) {
      recordBehaviorChange(recorder, {
        path: `groups[${index}].bottomHeight`,
        label: `第 ${index + 1} 个分组高度`,
        previousValue,
        normalizedValue: group.bottomHeight,
        reason: "已自动提高以容纳凹槽深度、底板孔位并保留最小底壁",
      });
    }
  });
}
