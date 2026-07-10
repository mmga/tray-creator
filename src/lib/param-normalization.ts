import type { TrayParams } from "@/types/tray";
import type {
  AppMode,
  CustomLayoutParams,
  FreeSlot,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import { CUSTOM_LAYOUT_DEFAULTS, CUSTOM_LIMITS } from "@/lib/custom-config";
import { resolveBaseHolePresetKey } from "@/lib/config";
import { PARAM_CONFIG } from "@/lib/grid-config";
import { normalizeGridParams } from "@/lib/grid-model-state";
import {
  getRawSteppedDisconnectDistance,
  getRawSteppedSmoothingRadius,
  migrateCustomLegacyShape,
  migrateGridLegacyShape,
  migrateSimpleSteppedLegacyShape,
  migrateSteppedLegacyShape,
} from "@/lib/param-legacy-migration";
import { normalizeSimpleSteppedParams } from "@/lib/simple-stepped-projection";
import {
  SIMPLE_STEPPED_LAYOUT_DEFAULTS,
  SIMPLE_STEPPED_LIMITS,
} from "@/lib/simple-stepped-config";
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

export type NormalizableParams =
  | TrayParams
  | CustomLayoutParams
  | SimpleSteppedLayoutParams
  | SteppedLayoutParams;

type ParamNormalizationStep<T extends NormalizableParams> = (params: T) => void;

type ParamNormalizationPipeline<T extends NormalizableParams> = {
  validateRequiredFields: ParamNormalizationStep<T>;
  migrateLegacyShape: ParamNormalizationStep<T>;
  normalizeSlotInstances: ParamNormalizationStep<T>;
  clampAndFillDerivedFields: ParamNormalizationStep<T>;
};

function resolveNormalizationMode(mode: AppMode): Exclude<AppMode, "stepped-cad"> | "stepped" {
  return mode === "stepped-cad" ? "stepped" : mode;
}

function getRawSteppedSplitRecessEnabled(obj: Record<string, unknown>) {
  if (typeof obj.enableSplitRecess === "boolean") {
    return obj.enableSplitRecess;
  }
  return obj.splitAssemblyMode === "locator-recess";
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
) {
  const value = obj[key] as number;
  obj[key] = Math.max(config.min, Math.min(config.max, value));
}

function runParamNormalizationPipeline<T extends NormalizableParams>(
  params: T,
  pipeline: ParamNormalizationPipeline<T>,
): T {
  pipeline.validateRequiredFields(params);
  pipeline.migrateLegacyShape(params);
  pipeline.normalizeSlotInstances(params);
  pipeline.clampAndFillDerivedFields(params);
  return params;
}

export function normalizeParamsForMode(
  mode: AppMode,
  params: NormalizableParams,
): NormalizableParams {
  const resolvedMode = resolveNormalizationMode(mode);

  if (resolvedMode === "grid") {
    return runParamNormalizationPipeline(
      params as TrayParams,
      gridParamNormalizationPipeline,
    );
  }
  if (resolvedMode === "simple-stepped") {
    return runParamNormalizationPipeline(
      params as SimpleSteppedLayoutParams,
      simpleSteppedParamNormalizationPipeline,
    );
  }
  if (resolvedMode === "stepped") {
    return runParamNormalizationPipeline(
      params as SteppedLayoutParams,
      steppedParamNormalizationPipeline,
    );
  }
  return runParamNormalizationPipeline(
    params as CustomLayoutParams,
    customParamNormalizationPipeline,
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
    enableSplitRecess: STEPPED_LAYOUT_DEFAULTS.enableSplitRecess,
    splitGrooveType: STEPPED_LAYOUT_DEFAULTS.splitGrooveType,
    enableSplitLocators: STEPPED_LAYOUT_DEFAULTS.enableSplitLocators,
    smoothingRadius: STEPPED_LAYOUT_DEFAULTS.smoothingRadius,
    disconnectDistance: STEPPED_LAYOUT_DEFAULTS.disconnectDistance,
    enableBaseHole: customParams.enableBaseHole,
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

const simpleSteppedParamNormalizationPipeline: ParamNormalizationPipeline<SimpleSteppedLayoutParams> =
  {
    validateRequiredFields: validateSimpleSteppedRequiredFields,
    migrateLegacyShape: migrateSimpleSteppedLegacyShape,
    normalizeSlotInstances: normalizeSimpleSteppedSlotInstances,
    clampAndFillDerivedFields: clampAndFillSimpleSteppedDerivedFields,
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

function normalizeGridSlotInstances(params: TrayParams) {
  Object.assign(params, normalizeGridParams(params));
}

function clampAndFillGridDerivedFields(params: TrayParams) {
  const obj = params as unknown as Record<string, unknown>;
  clampField(obj, "columns", PARAM_CONFIG.columns);
  clampField(obj, "rows", PARAM_CONFIG.rows);
  clampField(obj, "spacing", PARAM_CONFIG.spacing);
  clampField(obj, "baseThickness", PARAM_CONFIG.baseThickness);
  clampField(obj, "holeDepth", PARAM_CONFIG.holeDepth);
  clampField(obj, "cornerRadius", PARAM_CONFIG.cornerRadius);
  clampField(obj, "sideBevelWidth", PARAM_CONFIG.sideBevelWidth);

  clampField(obj, "spacingX", PARAM_CONFIG.spacingX);
  clampField(obj, "spacingY", PARAM_CONFIG.spacingY);
  if (!obj.spacingIndependent) {
    obj.spacingX = obj.spacing;
    obj.spacingY = obj.spacing;
  }

  clampField(obj, "boundarySpacing", PARAM_CONFIG.boundarySpacing);
  if (!obj.boundarySpacingIndependent) {
    obj.boundarySpacing = obj.spacing;
  }

  if (obj.rows !== 1 && obj.columns !== 1) {
    obj.halfCircleSlots = false;
  }
  if (obj.basePlateOnly) {
    obj.halfCircleSlots = false;
  }
  if (obj.basePlateOnly) {
    obj.enableBaseHole = true;
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

function normalizeCustomSlotInstances(params: CustomLayoutParams) {
  const obj = params as unknown as Record<string, unknown>;
  const slots = obj.slots as Record<string, unknown>[];
  for (const slot of slots) {
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
  }
}

function clampAndFillCustomDerivedFields(params: CustomLayoutParams) {
  const obj = params as unknown as Record<string, unknown>;
  const slots = obj.slots as Record<string, unknown>[];
  clampField(obj, "trayWidth", CUSTOM_LIMITS.trayWidth);
  clampField(obj, "trayDepth", CUSTOM_LIMITS.trayDepth);
  clampField(obj, "spacing", CUSTOM_LIMITS.spacing);
  clampField(obj, "boundarySpacing", CUSTOM_LIMITS.boundarySpacing);
  clampField(obj, "baseThickness", CUSTOM_LIMITS.baseThickness);
  clampField(obj, "holeDepth", CUSTOM_LIMITS.holeDepth);
  clampField(obj, "cornerRadius", CUSTOM_LIMITS.cornerRadius);
  clampField(obj, "sideBevelWidth", CUSTOM_LIMITS.sideBevelWidth);

  obj.traySizingMode = obj.traySizingMode === "fixed" ? "fixed" : "auto";

  if (!obj.boundarySpacingIndependent) {
    obj.boundarySpacing = obj.spacing;
  }
  if (typeof obj.enableBaseHole !== "boolean") {
    obj.enableBaseHole = CUSTOM_LAYOUT_DEFAULTS.enableBaseHole;
  }
  const largestSlotSize = slots.reduce(
    (maxSize, slot) =>
      Math.max(maxSize, slot.width as number, slot.height as number),
    0,
  );
  obj.baseHoleSize = resolveBaseHolePresetKey(largestSlotSize);
}

function validateSimpleSteppedRequiredFields(params: SimpleSteppedLayoutParams) {
  const obj = params as unknown as Record<string, unknown>;

  if (
    typeof obj.firstRowHeight !== "number" ||
    !Number.isFinite(obj.firstRowHeight)
  ) {
    obj.firstRowHeight = SIMPLE_STEPPED_LAYOUT_DEFAULTS.firstRowHeight;
  }
  if (
    typeof obj.cornerRadius !== "number" ||
    !Number.isFinite(obj.cornerRadius)
  ) {
    obj.cornerRadius = SIMPLE_STEPPED_LAYOUT_DEFAULTS.cornerRadius;
  }
  if (typeof obj.outerMarginIndependent !== "boolean") {
    obj.outerMarginIndependent =
      typeof obj.outerMargin === "number" &&
      typeof obj.spacing === "number" &&
      Math.abs((obj.outerMargin as number) - (obj.spacing as number)) > 0.001;
  }

  for (const field of [
    "firstRowHeight",
    "stepHeight",
    "rowGap",
    "spacing",
    "outerMargin",
    "holeDepth",
    "cornerRadius",
  ]) {
    requireNumber(obj, field);
  }
}

function normalizeSimpleSteppedSlotInstances(
  params: SimpleSteppedLayoutParams,
) {
  const obj = params as unknown as Record<string, unknown>;
  const rows = obj.rows as Record<string, unknown>[];
  const slots = obj.slots as Record<string, unknown>[];
  const rowIds = new Set(rows.map((row) => row.id as string));

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (!slot || typeof slot !== "object") {
      throw new Error(`slots[${index}]: 无效的凹槽数据`);
    }
    if (typeof slot.id !== "string" || !slot.id) {
      slot.id = crypto.randomUUID();
    }
    if (slot.shape !== "circle") {
      slot.shape = "circle";
    }
    if (
      typeof slot.rowId !== "string" ||
      !slot.rowId ||
      !rowIds.has(slot.rowId)
    ) {
      slot.rowId = rows[0]?.id ?? "";
    }
    if (
      typeof slot.diameter !== "number" ||
      !Number.isFinite(slot.diameter) ||
      slot.diameter <= 0 ||
      slot.diameter > SIMPLE_STEPPED_LIMITS.diameter.max
    ) {
      throw new Error(
        `slots[${index}].diameter: 超出合理范围 (0, ${SIMPLE_STEPPED_LIMITS.diameter.max}]`,
      );
    }
    if (typeof slot.x !== "number" || !Number.isFinite(slot.x)) {
      throw new Error(`slots[${index}].x: 缺少或无效（需要有限数字）`);
    }
  }

  Object.assign(params, normalizeSimpleSteppedParams(params));
}

function clampAndFillSimpleSteppedDerivedFields(
  params: SimpleSteppedLayoutParams,
) {
  const obj = params as unknown as Record<string, unknown>;
  clampField(obj, "firstRowHeight", SIMPLE_STEPPED_LIMITS.firstRowHeight);
  clampField(obj, "stepHeight", SIMPLE_STEPPED_LIMITS.stepHeight);
  clampField(obj, "rowGap", SIMPLE_STEPPED_LIMITS.rowGap);
  clampField(obj, "spacing", SIMPLE_STEPPED_LIMITS.spacing);
  clampField(obj, "outerMargin", SIMPLE_STEPPED_LIMITS.outerMargin);
  clampField(obj, "holeDepth", SIMPLE_STEPPED_LIMITS.holeDepth);
  clampField(obj, "cornerRadius", SIMPLE_STEPPED_LIMITS.cornerRadius);
  Object.assign(params, normalizeSimpleSteppedParams(params));
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

function normalizeSteppedSlotInstances(params: SteppedLayoutParams) {
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
      slot.shape = "circle";
    }
    slot.shape = "circle";
    slot.height = slot.width;
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
    delete slot.outerOffset;
    delete slot.profileExponent;
    if (
      typeof slot.groupId !== "string" ||
      !groupIds.has(slot.groupId as string)
    ) {
      slot.groupId = (obj.groups as { id: string }[])[0]?.id ?? "";
    }
    delete slot.bottomHeight;
  }
}

function clampAndFillSteppedDerivedFields(params: SteppedLayoutParams) {
  const obj = params as unknown as Record<string, unknown>;
  const groups = obj.groups as Record<string, unknown>[];
  const rawSmoothingRadius = getRawSteppedSmoothingRadius(obj);
  const rawDisconnectDistance = getRawSteppedDisconnectDistance(obj);
  const rawSplitRecessEnabled = getRawSteppedSplitRecessEnabled(obj);
  const rawSplitGrooveType = getRawSteppedSplitGrooveType(obj);
  const rawSplitLocatorsEnabled = getRawSteppedSplitLocatorsEnabled(obj);

  for (const group of groups) {
    clampField(
      group as Record<string, unknown>,
      "bottomHeight",
      STEPPED_LIMITS.bottomHeight,
    );
    clampField(
      group as Record<string, unknown>,
      "groupSmoothingRadius",
      STEPPED_LIMITS.smoothingRadius,
    );
    clampField(
      group as Record<string, unknown>,
      "groupDisconnectDistance",
      STEPPED_LIMITS.disconnectDistance,
    );
  }

  clampField(obj, "trayWidth", STEPPED_LIMITS.trayWidth);
  clampField(obj, "trayDepth", STEPPED_LIMITS.trayDepth);
  clampField(obj, "spacing", STEPPED_LIMITS.spacing);
  clampField(obj, "holeDepth", STEPPED_LIMITS.holeDepth);
  obj.splitGrooveDepth = STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth;
  obj.enableSplitRecess = rawSplitRecessEnabled;
  obj.splitGrooveType = rawSplitGrooveType;
  obj.enableSplitLocators = rawSplitLocatorsEnabled;
  delete obj.splitAssemblyMode;

  if (
    typeof obj.smoothingRadius !== "number" ||
    !Number.isFinite(obj.smoothingRadius)
  ) {
    obj.smoothingRadius = rawSmoothingRadius;
  }
  delete obj.bridgeRadius;
  clampField(obj, "smoothingRadius", STEPPED_LIMITS.smoothingRadius);

  if (
    typeof obj.disconnectDistance !== "number" ||
    !Number.isFinite(obj.disconnectDistance)
  ) {
    obj.disconnectDistance = rawDisconnectDistance;
  }
  clampField(obj, "disconnectDistance", STEPPED_LIMITS.disconnectDistance);

  const normalized = applySteppedBaseHoleDerivedFields(params);
  Object.assign(params, normalized);
}
