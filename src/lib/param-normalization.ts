import type { BaseHolePresetKey, TrayParams } from "@/types/tray";
import type {
  AppMode,
  CustomLayoutParams,
  FreeSlot,
  SimpleSteppedLayoutParams,
  SimpleSteppedSlot,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import { CUSTOM_LAYOUT_DEFAULTS, CUSTOM_LIMITS } from "@/lib/custom-config";
import { getBaseHoleMinBaseThickness, resolveBaseHolePresetKey } from "@/lib/config";
import { DEFAULT_TRAY_PARAMS, PARAM_CONFIG } from "@/lib/grid-config";
import { calculateSimpleSteppedDimensions } from "@/lib/simple-stepped-layout";
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
  createGridSlotSnapshotFromDefinition,
  normalizeFreeSlotInstanceSnapshot,
  normalizeSimpleSteppedSlotInstanceSnapshot,
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

function getRawSteppedSmoothingRadius(obj: Record<string, unknown>): number {
  if (
    typeof obj.smoothingRadius === "number" &&
    Number.isFinite(obj.smoothingRadius)
  ) {
    return obj.smoothingRadius;
  }
  if (
    typeof obj.bridgeRadius === "number" &&
    Number.isFinite(obj.bridgeRadius)
  ) {
    return obj.bridgeRadius;
  }
  return STEPPED_LAYOUT_DEFAULTS.smoothingRadius;
}

function getRawSteppedDisconnectDistance(obj: Record<string, unknown>): number {
  if (
    typeof obj.disconnectDistance === "number" &&
    Number.isFinite(obj.disconnectDistance)
  ) {
    return obj.disconnectDistance;
  }
  return STEPPED_LAYOUT_DEFAULTS.disconnectDistance;
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

function migrateGridLegacyShape(params: TrayParams) {
  const obj = params as unknown as Record<string, unknown>;
  if (typeof obj.spacingIndependent !== "boolean") {
    obj.spacingIndependent = false;
  }
  if (typeof obj.spacingX !== "number") {
    obj.spacingX = obj.spacing;
  }
  if (typeof obj.spacingY !== "number") {
    obj.spacingY = obj.spacing;
  }
  if (typeof obj.boundarySpacing !== "number") {
    obj.boundarySpacing = DEFAULT_TRAY_PARAMS.boundarySpacing;
  }
  if (typeof obj.boundarySpacingIndependent !== "boolean") {
    obj.boundarySpacingIndependent = false;
  }
  if (typeof obj.halfCircleSlots !== "boolean") {
    obj.halfCircleSlots = false;
  }
  if (typeof obj.basePlateOnly !== "boolean") {
    obj.basePlateOnly = false;
  }
  if (typeof obj.enableBaseHole !== "boolean") {
    obj.enableBaseHole = DEFAULT_TRAY_PARAMS.enableBaseHole;
  }
}

function normalizeGridSlotInstances(params: TrayParams) {
  const obj = params as unknown as Record<string, unknown>;
  const slotSnapshot = createGridSlotSnapshotFromDefinition(
    obj.holeDiameter as number,
  );
  obj.slotDefinitionId = slotSnapshot.slotDefinitionId;
  obj.slotDiameter =
    typeof obj.slotDiameter === "number" && Number.isFinite(obj.slotDiameter)
      ? obj.slotDiameter
      : slotSnapshot.slotDiameter;
}

function clampAndFillGridDerivedFields(params: TrayParams) {
  const obj = params as unknown as Record<string, unknown>;
  clampField(obj, "columns", PARAM_CONFIG.columns);
  clampField(obj, "rows", PARAM_CONFIG.rows);
  clampField(obj, "spacing", PARAM_CONFIG.spacing);
  clampField(obj, "baseThickness", PARAM_CONFIG.baseThickness);
  clampField(obj, "holeDepth", PARAM_CONFIG.holeDepth);
  clampField(obj, "cornerRadius", PARAM_CONFIG.cornerRadius);

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
  obj.baseHoleSize = resolveBaseHolePresetKey(obj.holeDiameter as number);
  if (obj.basePlateOnly) {
    obj.enableBaseHole = true;
  }
  if (obj.enableBaseHole) {
    const baseHoleSize = obj.baseHoleSize as BaseHolePresetKey;
    obj.baseThickness = Math.max(
      obj.baseThickness as number,
      getBaseHoleMinBaseThickness(baseHoleSize),
    );
  }
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

function migrateCustomLegacyShape(params: CustomLayoutParams) {
  const obj = params as unknown as Record<string, unknown>;
  if (typeof obj.boundarySpacing !== "number") {
    obj.boundarySpacing = obj.spacing;
  }
  if (typeof obj.boundarySpacingIndependent !== "boolean") {
    obj.boundarySpacingIndependent = false;
  }

  const slots = obj.slots as Record<string, unknown>[];
  for (const slot of slots) {
    if (typeof slot.id !== "string" || !slot.id) {
      slot.id = crypto.randomUUID();
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
  if (obj.enableBaseHole) {
    const baseHoleSize = obj.baseHoleSize as BaseHolePresetKey;
    obj.baseThickness = Math.max(
      obj.baseThickness as number,
      getBaseHoleMinBaseThickness(baseHoleSize),
    );
  }
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

function migrateSimpleSteppedLegacyShape(params: SimpleSteppedLayoutParams) {
  const obj = params as unknown as Record<string, unknown>;

  if (!Array.isArray(obj.rows)) {
    obj.rows = [];
  }
  if (!Array.isArray(obj.slots)) {
    obj.slots = [];
  }

  const rows = obj.rows as Record<string, unknown>[];
  const slots = obj.slots as Record<string, unknown>[];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || typeof row !== "object") {
      throw new Error(`rows[${index}]: 无效的行数据`);
    }
    if (typeof row.id !== "string" || !row.id) {
      row.id = crypto.randomUUID();
    }
    if (typeof row.name !== "string" || !row.name.trim()) {
      row.name = `行 ${index + 1}`;
    }
    if (!Array.isArray(row.slotIds)) {
      row.slotIds = [];
    }
  }

  if (rows.length === 0 && slots.length > 0) {
    rows.push({
      id: crypto.randomUUID(),
      name: "行 1",
      slotIds: [],
    });
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
    Object.assign(
      slot,
      normalizeSimpleSteppedSlotInstanceSnapshot(
        slot as unknown as SimpleSteppedSlot,
      ),
    );
  }
}

function clampAndFillSimpleSteppedDerivedFields(
  params: SimpleSteppedLayoutParams,
) {
  const obj = params as unknown as Record<string, unknown>;
  const rows = obj.rows as Record<string, unknown>[];
  const slots = obj.slots as Record<string, unknown>[];

  clampField(obj, "firstRowHeight", SIMPLE_STEPPED_LIMITS.firstRowHeight);
  clampField(obj, "stepHeight", SIMPLE_STEPPED_LIMITS.stepHeight);
  clampField(obj, "rowGap", SIMPLE_STEPPED_LIMITS.rowGap);
  clampField(obj, "spacing", SIMPLE_STEPPED_LIMITS.spacing);
  clampField(obj, "outerMargin", SIMPLE_STEPPED_LIMITS.outerMargin);
  clampField(obj, "holeDepth", SIMPLE_STEPPED_LIMITS.holeDepth);
  clampField(obj, "cornerRadius", SIMPLE_STEPPED_LIMITS.cornerRadius);
  if (!obj.outerMarginIndependent) {
    obj.outerMargin = obj.spacing;
  }

  const slotIdsByRowId = new Map<string, string[]>();
  rows.forEach((row) => {
    slotIdsByRowId.set(row.id as string, []);
  });
  slots.forEach((slot) => {
    const rowId = slot.rowId as string;
    const list = slotIdsByRowId.get(rowId);
    if (list) {
      list.push(slot.id as string);
    }
  });
  rows.forEach((row) => {
    row.slotIds = slotIdsByRowId.get(row.id as string) ?? [];
  });

  const normalized = obj as unknown as SimpleSteppedLayoutParams;
  const fallbackWidth =
    typeof normalized.trayWidth === "number" &&
    Number.isFinite(normalized.trayWidth)
      ? normalized.trayWidth
      : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayWidth;
  const fallbackDepth =
    typeof normalized.trayDepth === "number" &&
    Number.isFinite(normalized.trayDepth)
      ? normalized.trayDepth
      : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayDepth;
  normalized.trayWidth = fallbackWidth;
  normalized.trayDepth = fallbackDepth;

  const dimensions = calculateSimpleSteppedDimensions(normalized);
  normalized.trayWidth = Math.max(fallbackWidth, dimensions.width);
  normalized.trayDepth = Math.max(fallbackDepth, dimensions.depth);
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

function migrateSteppedLegacyShape(params: SteppedLayoutParams) {
  const obj = params as unknown as Record<string, unknown>;
  let slots = obj.slots as Record<string, unknown>[];
  const hasLegacyBottomHeight = slots.some(
    (slot) => typeof slot.bottomHeight === "number" && !slot.groupId,
  );
  const hasMissingGroups =
    !Array.isArray(obj.groups) || (obj.groups as unknown[]).length === 0;
  const rawSmoothingRadius = getRawSteppedSmoothingRadius(obj);
  const rawDisconnectDistance = getRawSteppedDisconnectDistance(obj);

  if (hasLegacyBottomHeight || hasMissingGroups) {
    const heightGroupMap = new Map<
      number,
      {
        id: string;
        name: string;
        color: string;
        bottomHeight: number;
        useGroupSmoothingRadius: boolean;
        groupSmoothingRadius: number;
        useGroupDisconnectDistance: boolean;
        groupDisconnectDistance: number;
        splitPartGroupId?: string;
      }
    >();
    const migratedSlots = slots.map((slot) => {
      const bottomHeight =
        typeof slot.bottomHeight === "number"
          ? (slot.bottomHeight as number)
          : 10;
      let group = heightGroupMap.get(bottomHeight);
      if (!group) {
        const colorIndex = heightGroupMap.size % GROUP_COLORS.length;
        group = {
          id: crypto.randomUUID(),
          name: `组 ${heightGroupMap.size + 1}`,
          color: GROUP_COLORS[colorIndex],
          bottomHeight,
          ...createGroupStructureOverrides({
            smoothingRadius: rawSmoothingRadius,
            disconnectDistance: rawDisconnectDistance,
          }),
        };
        heightGroupMap.set(bottomHeight, group);
      }
      return { ...slot, groupId: group.id };
    });

    const sortedGroups = [...heightGroupMap.values()].sort(
      (left, right) => left.bottomHeight - right.bottomHeight,
    );
    if (sortedGroups.length === 0) {
      sortedGroups.push({
        id: crypto.randomUUID(),
        name: "组 1",
        color: GROUP_COLORS[0],
        bottomHeight: 10,
        ...createGroupStructureOverrides({
          smoothingRadius: rawSmoothingRadius,
          disconnectDistance: rawDisconnectDistance,
        }),
      });
    }

    obj.groups = sortedGroups;
    obj.activeGroupId = sortedGroups[0].id;
    obj.slots = migratedSlots;
    slots = obj.slots as Record<string, unknown>[];
  }

  if (!Array.isArray(obj.groups)) {
    throw new Error("缺少或无效的字段: groups");
  }
  normalizeSteppedGroups(params);
}

function normalizeSteppedGroups(params: SteppedLayoutParams) {
  const obj = params as unknown as Record<string, unknown>;
  const rawSmoothingRadius = getRawSteppedSmoothingRadius(obj);
  const rawDisconnectDistance = getRawSteppedDisconnectDistance(obj);
  const groups = obj.groups as Record<string, unknown>[];

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (!group || typeof group !== "object") {
      throw new Error(`groups[${index}]: 无效的分组数据`);
    }
    if (typeof group.id !== "string" || !group.id) {
      group.id = crypto.randomUUID();
    }
    if (typeof group.name !== "string") {
      group.name = `组 ${index + 1}`;
    }
    if (typeof group.color !== "string") {
      group.color = GROUP_COLORS[index % GROUP_COLORS.length];
    }
    requireNumber(group as Record<string, unknown>, "bottomHeight");
    if (typeof group.useGroupSmoothingRadius !== "boolean") {
      group.useGroupSmoothingRadius = false;
    }
    if (
      typeof group.groupSmoothingRadius !== "number" ||
      !Number.isFinite(group.groupSmoothingRadius)
    ) {
      group.groupSmoothingRadius = rawSmoothingRadius;
    }
    if (typeof group.useGroupDisconnectDistance !== "boolean") {
      group.useGroupDisconnectDistance = false;
    }
    if (
      typeof group.groupDisconnectDistance !== "number" ||
      !Number.isFinite(group.groupDisconnectDistance)
    ) {
      group.groupDisconnectDistance = rawDisconnectDistance;
    }
  }

  const groupIds = new Set(groups.map((group) => group.id as string));
  for (const group of groups) {
    if (
      typeof group.splitPartGroupId !== "string" ||
      group.splitPartGroupId === group.id ||
      !groupIds.has(group.splitPartGroupId)
    ) {
      delete group.splitPartGroupId;
    }
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
