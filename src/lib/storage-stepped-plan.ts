import { isBaseHoleStructure } from "@/lib/base-hole-config";
import { polygonsIntersect } from "@/lib/collision";
import {
  getFreeSlotProfileGeometry,
  DEFAULT_ELLIPSE_PROFILE_EXPONENT,
} from "@/lib/slot-definitions";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import {
  STORAGE_STEPPED_BODY_PART_ID,
  STORAGE_STEPPED_HEIGHT_SPECS,
  STORAGE_STEPPED_INTERFACE_DEFAULTS,
  STORAGE_STEPPED_INTERFACE_VERSION,
  STORAGE_STEPPED_LIMITS,
  storageSteppedTrayPartId,
  isStorageSteppedHeightSpecId,
} from "@/lib/storage-stepped-config";
import {
  createStorageSteppedTrayBaseHolePlan,
  getStorageSteppedBaseHoleBlockingReason,
  getStorageSteppedFloorThickness,
  getStorageSteppedTrayRequiredSupportingThickness,
} from "@/lib/storage-stepped-base-hole";
import type { FreeSlot } from "@/types/custom-tray";
import type {
  StorageSteppedHeightSpecId,
  StorageSteppedInterfaceParams,
  StorageSteppedParams,
  StorageSteppedTrayConfig,
} from "@/types/storage-stepped";

export const STORAGE_STEPPED_EPSILON = 1e-6;

const SLOT_GEOMETRY_SAMPLE_STEPS = 192;
const ELLIPSE_BOUNDS_SAMPLE_STEPS = 720;

export interface StorageSteppedBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** 指扣沿 X 轴贯穿对应侧壁与承托台阶；不切削托盘。 */
export interface StorageSteppedFingerPullPlan {
  side: "left" | "right";
  centerY: number;
  centerZ: number;
  radius: number;
  /** 名义切削范围（不含布尔余量） */
  minX: number;
  maxX: number;
}

export interface StorageSteppedStepPlan {
  index: number;
  /** 台面高度 */
  deckHeight: number;
  /** 该阶标称模块范围（Y 从前向后） */
  module: StorageSteppedBounds;
  /** 下部收纳仓 */
  cavity: StorageSteppedBounds;
  /** 上部安装口 */
  opening: StorageSteppedBounds;
  /** 承托平面高度 */
  supportZ: number;
  /** 仓室净高 = 台面高度 − 托盘厚度 − 底板厚度 */
  clearHeight: number;
  /** 规则仓腔理论体积 (mm³) */
  capacity: number;
  /** 托盘装配位置 */
  trayAssembly: StorageSteppedBounds;
  fingerPulls: StorageSteppedFingerPullPlan[];
  /** 与下一阶之间的隔墙厚度；最后一阶为 0 */
  dividerWallToNext: number;
}

export interface StorageSteppedDerivedTray {
  stepIndex: number;
  partId: string;
  label: string;
  width: number;
  depth: number;
  thickness: number;
  holeDepth: number;
  floorThickness: number;
  slotCount: number;
  slots: FreeSlot[];
}

export interface StorageSteppedPlan {
  interfaceVersion: number;
  heightSpecId: StorageSteppedHeightSpecId;
  firstStepHeight: number;
  stepRise: number;
  stepCount: number;
  bodyWidth: number;
  bodyDepth: number;
  totalHeight: number;
  trayWidth: number;
  trayDepth: number;
  trayThickness: number;
  supportLedgeWidth: number;
  /** 居中放置时直边段平底接触宽度 */
  supportContactCentered: number;
  /** 侧向移动到间隙极限时对侧平底接触宽度 */
  supportContactShifted: number;
  fingerPullRadius: number;
  interface: StorageSteppedInterfaceParams;
  steps: StorageSteppedStepPlan[];
  trays: StorageSteppedDerivedTray[];
  /** 三仓规则长方体理论总容积 (mm³) */
  theoreticalCapacity: number;
}

function finiteOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeInterface(
  value: StorageSteppedInterfaceParams,
): StorageSteppedInterfaceParams {
  return {
    bodyWidth: finiteOr(value.bodyWidth),
    moduleDepth: finiteOr(value.moduleDepth),
    stepCount: finiteOr(value.stepCount),
    trayThickness: finiteOr(value.trayThickness),
    lowerWallThickness: finiteOr(value.lowerWallThickness),
    rimThickness: finiteOr(value.rimThickness),
    fingerPullDiameter: finiteOr(value.fingerPullDiameter),
    baseThickness: finiteOr(value.baseThickness),
    assemblyClearance: finiteOr(value.assemblyClearance),
  };
}

/** 由同一套接口参数推导托盘外形；二维边界、主体开口和托盘几何共用此结果。 */
export function deriveStorageSteppedTraySize(
  interfaceParams: StorageSteppedInterfaceParams,
): { width: number; depth: number } {
  const resolved = sanitizeInterface(interfaceParams);
  return {
    width:
      resolved.bodyWidth -
      2 * resolved.rimThickness -
      2 * resolved.assemblyClearance,
    depth:
      resolved.moduleDepth -
      2 * resolved.rimThickness -
      2 * resolved.assemblyClearance,
  };
}

/**
 * 纯函数尺寸推导：主体、托盘、二维边界与装配位置共享唯一来源。
 *
 * 输入缺失或非有限时按 0 处理，避免派生结果抛错；参数有效性由
 * `validateStorageSteppedParams` 单独报告。
 */
export function deriveStorageSteppedPlan(
  params: StorageSteppedParams,
): StorageSteppedPlan {
  const iface = sanitizeInterface(params.interface);
  const heightSpecId = isStorageSteppedHeightSpecId(params.heightSpecId)
    ? params.heightSpecId
    : "standard";
  const firstStepHeight = finiteOr(params.firstStepHeight);
  const stepRise = finiteOr(params.stepRise);
  const stepCount = Math.max(0, Math.floor(iface.stepCount));
  const traySize = deriveStorageSteppedTraySize(iface);
  const bodyDepth = iface.moduleDepth * stepCount;
  const trayThickness = iface.trayThickness;
  const fingerPullRadius = iface.fingerPullDiameter / 2;

  const steps: StorageSteppedStepPlan[] = [];
  for (let index = 0; index < stepCount; index += 1) {
    const deckHeight = firstStepHeight + stepRise * index;
    const moduleMinY = index * iface.moduleDepth;
    const moduleMaxY = moduleMinY + iface.moduleDepth;
    const clearHeight =
      deckHeight -
      trayThickness -
      iface.baseThickness;
    const cavityWidth = iface.bodyWidth - 2 * iface.lowerWallThickness;
    const cavityDepth = iface.moduleDepth - 2 * iface.lowerWallThickness;
    const capacity = Math.max(0, cavityWidth) *
      Math.max(0, cavityDepth) *
      Math.max(0, clearHeight);
    steps.push({
      index,
      deckHeight,
      module: {
        minX: 0,
        maxX: iface.bodyWidth,
        minY: moduleMinY,
        maxY: moduleMaxY,
        minZ: 0,
        maxZ: deckHeight,
      },
      cavity: {
        minX: iface.lowerWallThickness,
        maxX: iface.bodyWidth - iface.lowerWallThickness,
        minY: moduleMinY + iface.lowerWallThickness,
        maxY: moduleMaxY - iface.lowerWallThickness,
        minZ: iface.baseThickness,
        maxZ: deckHeight - trayThickness,
      },
      opening: {
        minX: iface.rimThickness,
        maxX: iface.bodyWidth - iface.rimThickness,
        minY: moduleMinY + iface.rimThickness,
        maxY: moduleMaxY - iface.rimThickness,
        minZ: deckHeight - trayThickness,
        maxZ: deckHeight,
      },
      supportZ: deckHeight - trayThickness,
      clearHeight,
      capacity,
      trayAssembly: {
        minX: iface.rimThickness + iface.assemblyClearance,
        maxX:
          iface.bodyWidth -
          iface.rimThickness -
          iface.assemblyClearance,
        minY: moduleMinY + iface.rimThickness + iface.assemblyClearance,
        maxY: moduleMaxY - iface.rimThickness - iface.assemblyClearance,
        minZ: deckHeight - trayThickness,
        maxZ: deckHeight,
      },
      fingerPulls: [
        {
          side: "left",
          centerY: moduleMinY + iface.moduleDepth / 2,
          centerZ: deckHeight,
          radius: fingerPullRadius,
          minX: 0,
          maxX: iface.lowerWallThickness,
        },
        {
          side: "right",
          centerY: moduleMinY + iface.moduleDepth / 2,
          centerZ: deckHeight,
          radius: fingerPullRadius,
          minX: iface.bodyWidth - iface.lowerWallThickness,
          maxX: iface.bodyWidth,
        },
      ],
      dividerWallToNext: index < stepCount - 1
        ? 2 * iface.lowerWallThickness
        : 0,
    });
  }

  const trays: StorageSteppedDerivedTray[] = params.trays.map((tray) => ({
    stepIndex: tray.stepIndex,
    partId: storageSteppedTrayPartId(tray.stepIndex),
    label: `第 ${tray.stepIndex + 1} 阶托盘`,
    width: traySize.width,
    depth: traySize.depth,
    thickness: trayThickness,
    holeDepth: tray.holeDepth,
    floorThickness: getStorageSteppedFloorThickness(tray, trayThickness),
    slotCount: tray.slots.length,
    slots: tray.slots,
  }));

  const supportLedgeWidth = iface.lowerWallThickness - iface.rimThickness;
  const supportContactCentered = supportLedgeWidth - iface.assemblyClearance;
  return {
    interfaceVersion: params.interfaceVersion,
    heightSpecId,
    firstStepHeight,
    stepRise,
    stepCount,
    bodyWidth: iface.bodyWidth,
    bodyDepth,
    totalHeight: firstStepHeight + stepRise * Math.max(0, stepCount - 1),
    trayWidth: traySize.width,
    trayDepth: traySize.depth,
    trayThickness,
    supportLedgeWidth,
    supportContactCentered,
    supportContactShifted: supportContactCentered - iface.assemblyClearance,
    fingerPullRadius,
    interface: iface,
    steps,
    trays,
    theoreticalCapacity: steps.reduce((total, step) => total + step.capacity, 0),
  };
}

export type StorageSteppedIssueSeverity = "error" | "warning";

/** 托盘底面在居中主体坐标系中的装配位置。 */
export function getStorageSteppedTrayAssemblyOffset(
  plan: StorageSteppedPlan,
  stepIndex: number,
): [number, number, number] {
  const step = plan.steps[stepIndex];
  if (!step) throw new Error(`找不到第 ${stepIndex + 1} 阶装配位置`);
  const centerY = (step.module.minY + step.module.maxY) / 2;
  return [0, centerY - plan.bodyDepth / 2, step.supportZ];
}

export interface StorageSteppedValidationIssue {
  severity: StorageSteppedIssueSeverity;
  /** 影响范围：params 表示全局，body 或 tray-N 表示单个零件 */
  partId: string;
  /** 参数位置，用于测试与导入报告 */
  path: string;
  message: string;
}

export interface StorageSteppedValidation {
  issues: StorageSteppedValidationIssue[];
  errors: StorageSteppedValidationIssue[];
  warnings: StorageSteppedValidationIssue[];
  isValid: boolean;
}

function issue(
  severity: StorageSteppedIssueSeverity,
  partId: string,
  path: string,
  message: string,
): StorageSteppedValidationIssue {
  return { severity, partId, path, message };
}

function requireFinite(
  issues: StorageSteppedValidationIssue[],
  value: unknown,
  path: string,
  label: string,
): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(issue("error", "params", path, `${label}必须是有限数字`));
    return false;
  }
  return true;
}

/**
 * 槽位轮廓采样点（已旋转、已平移到托盘坐标系）。
 * 圆形使用解析半径之外的采样点，供间距校验使用。
 */
export function getStorageSteppedSlotOutline(
  slot: FreeSlot,
  expandBy = 0,
  steps = SLOT_GEOMETRY_SAMPLE_STEPS,
): { x: number; y: number }[] {
  const profile = getFreeSlotProfileGeometry(slot);
  const local = sampleSlotProfilePoints(
    profile.width,
    profile.height,
    slot.shape,
    profile.outerOffset + expandBy,
    steps,
    profile.profileExponent ?? DEFAULT_ELLIPSE_PROFILE_EXPONENT,
  );
  const radians = ((slot.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return local.map((point) => ({
    x: slot.x + point.x * cos - point.y * sin,
    y: slot.y + point.x * sin + point.y * cos,
  }));
}

/** 槽位在托盘坐标系中的外接矩形（含旋转与椭圆外扩）。 */
export function getStorageSteppedSlotBounds(slot: FreeSlot): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const profile = getFreeSlotProfileGeometry(slot);
  if (slot.shape === "circle") {
    const radius = profile.width / 2;
    return {
      minX: slot.x - radius,
      maxX: slot.x + radius,
      minY: slot.y - radius,
      maxY: slot.y + radius,
    };
  }

  const points = getStorageSteppedSlotOutline(
    slot,
    0,
    ELLIPSE_BOUNDS_SAMPLE_STEPS,
  );
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

function validateTraySlots(
  tray: StorageSteppedTrayConfig,
  trayIndex: number,
  trayWidth: number,
  trayDepth: number,
  spacing: number,
  boundarySpacing: number,
): StorageSteppedValidationIssue[] {
  const issues: StorageSteppedValidationIssue[] = [];
  const partId = storageSteppedTrayPartId(tray.stepIndex);
  const basePath = `trays[${trayIndex}]`;
  const seenIds = new Set<string>();
  const validSlots: FreeSlot[] = [];

  if (!Array.isArray(tray.slots)) {
    issues.push(issue("error", partId, `${basePath}.slots`, "槽位列表无效"));
    return issues;
  }

  tray.slots.forEach((slot, slotIndex) => {
    const path = `${basePath}.slots[${slotIndex}]`;
    if (!slot || typeof slot !== "object") {
      issues.push(issue("error", partId, path, "凹槽数据无效"));
      return;
    }
    if (typeof slot.id !== "string" || !slot.id) {
      issues.push(issue("error", partId, `${path}.id`, "槽位缺少唯一标识"));
    } else if (seenIds.has(slot.id)) {
      issues.push(issue("error", partId, `${path}.id`, `槽位标识重复：${slot.id}`));
    } else {
      seenIds.add(slot.id);
    }
    if (slot.shape !== "circle" && slot.shape !== "ellipse") {
      issues.push(issue("error", partId, `${path}.shape`, "槽形必须是圆形或椭圆"));
      return;
    }
    for (const [key, label] of [
      ["x", "槽心 X"],
      ["y", "槽心 Y"],
      ["width", "槽宽"],
      ["height", "槽高"],
      ["rotation", "旋转角"],
    ] as const) {
      if (typeof slot[key] !== "number" || !Number.isFinite(slot[key])) {
        issues.push(issue("error", partId, `${path}.${key}`, `${label}必须是有限数字`));
        return;
      }
    }
    if (slot.width <= 0 || slot.width > 200) {
      issues.push(issue("error", partId, `${path}.width`, "槽宽必须大于 0 且不超过 200mm"));
      return;
    }
    if (slot.height <= 0 || slot.height > 200) {
      issues.push(issue("error", partId, `${path}.height`, "槽高必须大于 0 且不超过 200mm"));
      return;
    }

    const bounds = getStorageSteppedSlotBounds(slot);
    if (
      bounds.minX < boundarySpacing - STORAGE_STEPPED_EPSILON ||
      bounds.maxX > trayWidth - boundarySpacing + STORAGE_STEPPED_EPSILON ||
      bounds.minY < boundarySpacing - STORAGE_STEPPED_EPSILON ||
      bounds.maxY > trayDepth - boundarySpacing + STORAGE_STEPPED_EPSILON
    ) {
      issues.push(
        issue(
          "error",
          partId,
          path,
          `槽位越界：需在 ${trayWidth}×${trayDepth}mm 托盘内保留 ${boundarySpacing}mm 边距`,
        ),
      );
    }
    validSlots.push(slot);
  });

  // 槽间间距：将每个槽形按 spacing/2 外扩后做 SAT 相交判定。
  const expanded = validSlots.map((slot) =>
    getStorageSteppedSlotOutline(slot, spacing / 2),
  );
  for (let leftIndex = 0; leftIndex < validSlots.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < validSlots.length; rightIndex += 1) {
      if (
        !polygonsIntersect(expanded[leftIndex], expanded[rightIndex])
      ) {
        continue;
      }
      const leftId = validSlots[leftIndex].id;
      const rightId = validSlots[rightIndex].id;
      issues.push(
        issue(
          "error",
          partId,
          `trays[${trayIndex}].slots`,
          `槽位间距不足 ${spacing}mm：${leftId} 与 ${rightId}`,
        ),
      );
    }
  }

  return issues;
}

function validateTray(
  tray: StorageSteppedTrayConfig,
  trayIndex: number,
  plan: StorageSteppedPlan,
  params: StorageSteppedParams,
): StorageSteppedValidationIssue[] {
  const issues: StorageSteppedValidationIssue[] = [];
  const partId = storageSteppedTrayPartId(tray.stepIndex);
  const path = `trays[${trayIndex}]`;

  if (!Number.isInteger(tray.stepIndex) || tray.stepIndex < 0 || tray.stepIndex >= plan.stepCount) {
    issues.push(
      issue("error", "params", `${path}.stepIndex`, `第 ${trayIndex + 1} 个托盘配置的阶索引无效`),
    );
    return issues;
  }

  if (!requireFinite(issues, tray.holeDepth, `${path}.holeDepth`, "槽深")) {
    return issues;
  }
  const { min, max } = STORAGE_STEPPED_LIMITS.holeDepth;
  if (tray.holeDepth < min || tray.holeDepth > max) {
    issues.push(
      issue(
        "error",
        partId,
        `${path}.holeDepth`,
        `槽深必须在 ${min}–${max}mm 之间`,
      ),
    );
    return issues;
  }

  const floorThickness = getStorageSteppedFloorThickness(tray, plan.trayThickness);
  if (!isBaseHoleStructure(tray.baseHoleStructure)) {
    issues.push(
      issue("error", partId, `${path}.baseHoleStructure`, "底板孔位结构无效"),
    );
  } else {
    const required = getStorageSteppedTrayRequiredSupportingThickness(tray);
    if (required > 0 && floorThickness < required - STORAGE_STEPPED_EPSILON) {
      issues.push(
        issue(
          "error",
          partId,
          `${path}.holeDepth`,
          `槽深 ${tray.holeDepth}mm 后只剩 ${floorThickness.toFixed(1)}mm 槽底，` +
            `无法容纳需要 ${required.toFixed(1)}mm 底壁的底孔`,
        ),
      );
    }
    if (tray.baseHoleStructure !== "none") {
      const baseHolePlan = createStorageSteppedTrayBaseHolePlan(
        tray,
        plan.trayWidth,
        plan.trayDepth,
        plan.trayThickness,
      );
      const blockingReason = getStorageSteppedBaseHoleBlockingReason(baseHolePlan);
      if (blockingReason) {
        issues.push(
          issue("error", partId, `${path}.baseHoleStructure`, blockingReason),
        );
      }
    }
  }

  if (!Array.isArray(tray.slots)) {
    issues.push(issue("error", partId, `${path}.slots`, "槽位列表无效"));
    return issues;
  }

  issues.push(
    ...validateTraySlots(
      tray,
      trayIndex,
      plan.trayWidth,
      plan.trayDepth,
      params.slotSpacing,
      params.slotBoundarySpacing,
    ),
  );

  return issues;
}

function collectInterfaceDeviations(
  value: StorageSteppedInterfaceParams,
): string[] {
  const labels: Record<keyof StorageSteppedInterfaceParams, string> = {
    bodyWidth: "主体宽度",
    moduleDepth: "单阶深度",
    stepCount: "阶数",
    trayThickness: "托盘总厚度",
    lowerWallThickness: "下部壁厚",
    rimThickness: "上沿厚度",
    fingerPullDiameter: "指扣直径",
    baseThickness: "底板厚度",
    assemblyClearance: "装配间隙",
  };
  return (Object.keys(labels) as Array<keyof StorageSteppedInterfaceParams>)
    .filter((key) => {
      const actual = value[key];
      const expected = STORAGE_STEPPED_INTERFACE_DEFAULTS[key];
      return (
        typeof actual !== "number" ||
        !Number.isFinite(actual) ||
        Math.abs(actual - expected) > STORAGE_STEPPED_EPSILON
      );
    })
    .map((key) => labels[key]);
}

/** 参数、派生尺寸与槽位的完整校验；区分阻断错误与打样提示。 */
export function validateStorageSteppedParams(
  params: StorageSteppedParams,
): StorageSteppedValidation {
  const issues: StorageSteppedValidationIssue[] = [];
  const plan = deriveStorageSteppedPlan(params);

  if (params.interfaceVersion !== STORAGE_STEPPED_INTERFACE_VERSION) {
    issues.push(
      issue(
        "error",
        "params",
        "interfaceVersion",
        `未知接口版本 ${String(params.interfaceVersion)}，当前只支持版本 ${STORAGE_STEPPED_INTERFACE_VERSION}`,
      ),
    );
  }

  if (!isStorageSteppedHeightSpecId(params.heightSpecId)) {
    issues.push(
      issue("error", "params", "heightSpecId", "主体高度规格未知"),
    );
  } else {
    const spec = STORAGE_STEPPED_HEIGHT_SPECS[params.heightSpecId];
    if (
      !requireFinite(issues, params.firstStepHeight, "firstStepHeight", "首阶台面高度") ||
      Math.abs(params.firstStepHeight - spec.firstStepHeight) > STORAGE_STEPPED_EPSILON
    ) {
      if (Number.isFinite(params.firstStepHeight)) {
        issues.push(
          issue(
            "error",
            "params",
            "firstStepHeight",
            `首阶台面高度 ${params.firstStepHeight}mm 与所选规格「${spec.label}」不一致`,
          ),
        );
      }
    }
    if (
      !requireFinite(issues, params.stepRise, "stepRise", "台阶步进高度") ||
      Math.abs(params.stepRise - spec.stepRise) > STORAGE_STEPPED_EPSILON
    ) {
      if (Number.isFinite(params.stepRise)) {
        issues.push(
          issue(
            "error",
            "params",
            "stepRise",
            `台阶步进高度 ${params.stepRise}mm 与所选规格「${spec.label}」不一致`,
          ),
        );
      }
    }
  }

  const iface = params.interface;
  const interfaceLabels: Array<[keyof StorageSteppedInterfaceParams, string]> = [
    ["bodyWidth", "主体宽度"],
    ["moduleDepth", "单阶深度"],
    ["stepCount", "阶数"],
    ["trayThickness", "托盘总厚度"],
    ["lowerWallThickness", "下部壁厚"],
    ["rimThickness", "上沿厚度"],
    ["fingerPullDiameter", "指扣直径"],
    ["baseThickness", "主体底板厚度"],
    ["assemblyClearance", "单边装配间隙"],
  ];
  let interfaceFinite = true;
  for (const [key, label] of interfaceLabels) {
    if (!requireFinite(issues, iface[key], `interface.${key}`, label)) {
      interfaceFinite = false;
    }
  }

  if (interfaceFinite) {
    if (iface.stepCount !== 3) {
      issues.push(
        issue("error", "params", "interface.stepCount", "首版固定为 3 阶"),
      );
    }
    if (Math.abs(iface.trayThickness - 6) > STORAGE_STEPPED_EPSILON) {
      issues.push(
        issue(
          "error",
          "params",
          "interface.trayThickness",
          "托盘总厚度固定为 6mm，不能通过加厚托盘回避底孔冲突",
        ),
      );
    }
    if (iface.bodyWidth <= 0 || iface.moduleDepth <= 0) {
      issues.push(issue("error", "params", "interface", "主体宽度与单阶深度必须为正"));
    }
    if (iface.lowerWallThickness <= 0) {
      issues.push(issue("error", "params", "interface.lowerWallThickness", "下部壁厚必须为正"));
    }
    if (iface.rimThickness <= 0) {
      issues.push(issue("error", "params", "interface.rimThickness", "上沿厚度必须为正"));
    }
    if (iface.rimThickness >= iface.lowerWallThickness) {
      issues.push(
        issue(
          "error",
          "params",
          "interface.rimThickness",
          "上沿厚度必须小于下部壁厚，才能形成承托台阶",
        ),
      );
    }
    if (iface.assemblyClearance < 0) {
      issues.push(
        issue("error", "params", "interface.assemblyClearance", "装配间隙不能为负"),
      );
    }
    if (iface.baseThickness <= 0) {
      issues.push(issue("error", "params", "interface.baseThickness", "主体底板厚度必须为正"));
    }
    if (iface.fingerPullDiameter <= 0) {
      issues.push(issue("error", "params", "interface.fingerPullDiameter", "指扣直径必须为正"));
    }
    if (plan.trayWidth <= 0 || plan.trayDepth <= 0) {
      issues.push(
        issue("error", "params", "interface", "当前接口推导出的托盘尺寸无效"),
      );
    }
    if (plan.supportContactCentered <= STORAGE_STEPPED_EPSILON) {
      issues.push(
        issue(
          "error",
          "params",
          "interface.assemblyClearance",
          "当前壁厚和间隙使托盘居中时没有平底承托面",
        ),
      );
    } else if (plan.supportContactShifted <= STORAGE_STEPPED_EPSILON) {
      issues.push(
        issue(
          "error",
          "params",
          "interface.assemblyClearance",
          "托盘移到装配间隙极限时，对侧没有平底承托面",
        ),
      );
    }
    for (const step of plan.steps) {
      if (step.clearHeight <= 0) {
        issues.push(
          issue(
            "error",
            "params",
            "interface.baseThickness",
            `第 ${step.index + 1} 阶仓室净高 ${step.clearHeight.toFixed(1)}mm 不为正`,
          ),
        );
      }
    }

    const deviations = collectInterfaceDeviations(iface);
    if (deviations.length > 0) {
      issues.push(
        issue(
          "warning",
          "params",
          "interface",
          `接口参数已偏离打样默认值（${deviations.join("、")}），生成结果不能与默认接口视为可互换`,
        ),
      );
    }
    if (plan.supportContactCentered < 1) {
      issues.push(
        issue(
          "warning",
          "params",
          "interface.rimThickness",
          `直边段承托接触宽度仅 ${plan.supportContactCentered.toFixed(2)}mm，承重结论仍需实物验证`,
        ),
      );
    }
    const lowestFingerPull = plan.steps.reduce<number | null>((lowest, step) => {
      const value = step.deckHeight - plan.fingerPullRadius;
      return lowest === null ? value : Math.min(lowest, value);
    }, null);
    if (lowestFingerPull !== null && lowestFingerPull < iface.baseThickness) {
      issues.push(
        issue(
          "warning",
          "params",
          "interface.fingerPullDiameter",
          "指扣最低点低于主体底板顶面，会局部削入底板侧边",
        ),
      );
    }
  }

  for (const [key, label] of [
    ["slotSpacing", "槽位间距"],
    ["slotBoundarySpacing", "槽位边距"],
  ] as const) {
    if (!requireFinite(issues, params[key], key, label)) {
      continue;
    }
    if (params[key] < 0) {
      issues.push(issue("error", "params", key, `${label}不能为负`));
    }
  }

  if (!Array.isArray(params.trays)) {
    issues.push(issue("error", "params", "trays", "托盘配置必须是数组"));
  } else {
    const seenSteps = new Set<number>();
    for (const tray of params.trays) {
      if (seenSteps.has(tray.stepIndex)) {
        issues.push(
          issue("error", "params", "trays", `第 ${tray.stepIndex + 1} 阶存在重复托盘配置`),
        );
      }
      seenSteps.add(tray.stepIndex);
    }
    if (params.trays.length !== plan.stepCount) {
      issues.push(
        issue(
          "error",
          "params",
          "trays",
          `需要 ${plan.stepCount} 块托盘配置，当前为 ${params.trays.length} 块`,
        ),
      );
    }
    params.trays.forEach((tray, trayIndex) => {
      issues.push(...validateTray(tray, trayIndex, plan, params));
    });
  }

  const errors = issues.filter((entry) => entry.severity === "error");
  const warnings = issues.filter((entry) => entry.severity === "warning");
  return { issues, errors, warnings, isValid: errors.length === 0 };
}

/** 单个零件的阻断原因；无关托盘的错误不会阻断其他零件。 */
export function getStorageSteppedPartBlockingReason(
  validation: StorageSteppedValidation,
  partId: string,
): string | null {
  const blocking = validation.errors.filter(
    (entry) => entry.partId === "params" || entry.partId === partId,
  );
  if (blocking.length === 0) return null;
  const first = blocking[0];
  const remaining = blocking.length - 1;
  return `${first.message}${remaining > 0 ? `（另有 ${remaining} 项）` : ""}`;
}

/** 整套模型是否可生成/导出。 */
export function getStorageSteppedBlockingReason(
  validation: StorageSteppedValidation,
): string | null {
  const first = validation.errors[0];
  if (!first) return null;
  const remaining = validation.errors.length - 1;
  return `${first.message}${remaining > 0 ? `（另有 ${remaining} 项）` : ""}`;
}

/** 当前参数应生成的零件身份，按主体、第一阶、第二阶、第三阶排序。 */
export function getStorageSteppedExpectedPartIds(
  params: StorageSteppedParams,
): string[] {
  return [
    STORAGE_STEPPED_BODY_PART_ID,
    ...params.trays
      .slice()
      .sort((left, right) => left.stepIndex - right.stepIndex)
      .map((tray) => storageSteppedTrayPartId(tray.stepIndex)),
  ];
}

/**
 * 单件几何指纹：只包含真正影响该零件几何的参数。
 *
 * - 主体：接口参数 + 实际主体高度；与槽位无关；
 * - 托盘：接口参数 + 该阶托盘配置 + 槽位间距；与主体高度无关。
 *
 * 因此切换高度只重建主体，修改某阶槽位只重建该托盘，接口变化使全部零件失效。
 */
export function getStorageSteppedPartFingerprint(
  params: StorageSteppedParams,
  partId: string,
): string {
  if (partId === STORAGE_STEPPED_BODY_PART_ID) {
    return JSON.stringify({
      partId,
      interfaceVersion: params.interfaceVersion,
      interface: params.interface,
      heightSpecId: params.heightSpecId,
      firstStepHeight: params.firstStepHeight,
      stepRise: params.stepRise,
    });
  }
  const stepIndex = Number(/^tray-(\d+)$/.exec(partId)?.[1]) - 1;
  const tray = params.trays.find((candidate) => candidate.stepIndex === stepIndex);
  if (!tray) {
    return JSON.stringify({ partId, missing: true });
  }
  return JSON.stringify({
    partId,
    interfaceVersion: params.interfaceVersion,
    interface: params.interface,
    slotSpacing: params.slotSpacing,
    slotBoundarySpacing: params.slotBoundarySpacing,
    tray,
  });
}
