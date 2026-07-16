/**
 * 参数归一化的 legacy migration 步骤。
 *
 * 从 param-normalization.ts 提取，专门处理旧版参数格式的迁移：
 * - 缺失字段的默认值填充（如 grid 的 spacingIndependent）
 * - 旧版结构的格式转换（如 stepped 的 bottomHeight → groupId 整组迁移）
 *
 * 与 validate/clamp/fill 的"范围校验/字段填充"性质不同，独立成模块后：
 * - legacy 规则变更只改这一处（locality）
 * - 迁移失败抛异常时，调用方知道是 legacy 数据问题而非校验问题
 */
import type {
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import {
  GROUP_COLORS,
  STEPPED_LAYOUT_DEFAULTS,
} from "@/lib/stepped-config";
import { createGroupStructureOverrides } from "@/lib/stepped-group-params";
import type { ImportNormalizationRecorder } from "@/lib/param-import-report";
import {
  recordBehaviorChange,
  recordDefault,
  recordMigration,
} from "@/lib/param-import-report";

function requireNumber(obj: Record<string, unknown>, key: string) {
  if (typeof obj[key] !== "number") {
    throw new Error(`缺少或无效的字段: ${key}`);
  }
}

export function getRawSteppedSmoothingRadius(obj: Record<string, unknown>): number {
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

export function getRawSteppedDisconnectDistance(obj: Record<string, unknown>): number {
  if (
    typeof obj.disconnectDistance === "number" &&
    Number.isFinite(obj.disconnectDistance)
  ) {
    return obj.disconnectDistance;
  }
  return STEPPED_LAYOUT_DEFAULTS.disconnectDistance;
}

export function migrateGridLegacyShape(
  params: TrayParams,
  recorder?: ImportNormalizationRecorder,
) {
  const obj = params as unknown as Record<string, unknown>;
  if (typeof obj.spacingIndependent !== "boolean") {
    obj.spacingIndependent = false;
    recordDefault(recorder, {
      path: "spacingIndependent",
      label: "横纵间距独立设置",
      normalizedValue: false,
      reason: "旧文件未记录横纵间距是否独立",
    });
  }
  if (typeof obj.spacingX !== "number") {
    obj.spacingX = obj.spacing;
    recordDefault(recorder, {
      path: "spacingX",
      label: "横向间距",
      normalizedValue: obj.spacingX,
      reason: "旧文件未记录横向间距，沿用统一间距",
    });
  }
  if (typeof obj.spacingY !== "number") {
    obj.spacingY = obj.spacing;
    recordDefault(recorder, {
      path: "spacingY",
      label: "纵向间距",
      normalizedValue: obj.spacingY,
      reason: "旧文件未记录纵向间距，沿用统一间距",
    });
  }
  if (typeof obj.boundarySpacing !== "number") {
    obj.boundarySpacing = DEFAULT_TRAY_PARAMS.boundarySpacing;
    recordDefault(recorder, {
      path: "boundarySpacing",
      label: "边界间距",
      normalizedValue: obj.boundarySpacing,
      reason: "旧文件未记录边界间距",
    });
  }
  if (typeof obj.boundarySpacingIndependent !== "boolean") {
    obj.boundarySpacingIndependent = false;
    recordDefault(recorder, {
      path: "boundarySpacingIndependent",
      label: "边界间距独立设置",
      normalizedValue: false,
      reason: "旧文件默认让边界间距跟随凹槽间距",
    });
  }
  if (typeof obj.halfCircleSlots !== "boolean") {
    obj.halfCircleSlots = false;
    recordDefault(recorder, {
      path: "halfCircleSlots",
      label: "半圆凹槽",
      normalizedValue: false,
      reason: "旧文件未记录半圆凹槽选项",
    });
  }
  if (typeof obj.basePlateOnly !== "boolean") {
    obj.basePlateOnly = false;
    recordDefault(recorder, {
      path: "basePlateOnly",
      label: "仅生成底板",
      normalizedValue: false,
      reason: "旧文件未记录仅生成底板选项",
    });
  }
  if (typeof obj.sideBevelWidth !== "number") {
    obj.sideBevelWidth = DEFAULT_TRAY_PARAMS.sideBevelWidth;
    recordDefault(recorder, {
      path: "sideBevelWidth",
      label: "侧面斜角宽度",
      normalizedValue: obj.sideBevelWidth,
      reason: "旧文件未记录侧面斜角宽度",
    });
  }
}

export function migrateCustomLegacyShape(
  params: CustomLayoutParams,
  recorder?: ImportNormalizationRecorder,
) {
  const obj = params as unknown as Record<string, unknown>;
  if (typeof obj.boundarySpacing !== "number") {
    obj.boundarySpacing = obj.spacing;
    recordDefault(recorder, {
      path: "boundarySpacing",
      label: "边界间距",
      normalizedValue: obj.boundarySpacing,
      reason: "旧文件未记录边界间距，沿用凹槽间距",
    });
  }
  if (typeof obj.boundarySpacingIndependent !== "boolean") {
    obj.boundarySpacingIndependent = false;
    recordDefault(recorder, {
      path: "boundarySpacingIndependent",
      label: "边界间距独立设置",
      normalizedValue: false,
      reason: "旧文件默认让边界间距跟随凹槽间距",
    });
  }
  if (typeof obj.sideBevelWidth !== "number") {
    obj.sideBevelWidth = 0;
    recordDefault(recorder, {
      path: "sideBevelWidth",
      label: "侧面斜角宽度",
      normalizedValue: 0,
      reason: "旧文件未记录侧面斜角宽度",
    });
  }

  const slots = obj.slots as Record<string, unknown>[];
  let generatedIdCount = 0;
  for (const slot of slots) {
    if (typeof slot.id !== "string" || !slot.id) {
      slot.id = crypto.randomUUID();
      generatedIdCount += 1;
    }
  }
  if (generatedIdCount > 0) {
    recordDefault(recorder, {
      path: "slots[].id",
      label: "Slot Instance 标识",
      normalizedValue: `已生成 ${generatedIdCount} 个标识`,
      reason: "旧 Slot Instance 未记录稳定标识",
      technical: true,
      count: generatedIdCount,
    });
  }
}

export function migrateSimpleSteppedLegacyShape(
  params: SimpleSteppedLayoutParams,
  recorder?: ImportNormalizationRecorder,
) {
  const obj = params as unknown as Record<string, unknown>;

  if (!Array.isArray(obj.rows)) {
    obj.rows = [];
    recordDefault(recorder, {
      path: "rows",
      label: "简易阶梯行",
      normalizedValue: [],
      reason: "旧文件未记录行结构",
    });
  }
  if (!Array.isArray(obj.slots)) {
    obj.slots = [];
    recordDefault(recorder, {
      path: "slots",
      label: "Slot Instance",
      normalizedValue: [],
      reason: "旧文件未记录 Slot Instance 列表",
    });
  }

  const rows = obj.rows as Record<string, unknown>[];
  const slots = obj.slots as Record<string, unknown>[];
  let generatedRowIdCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || typeof row !== "object") {
      throw new Error(`rows[${index}]: 无效的行数据`);
    }
    if (typeof row.id !== "string" || !row.id) {
      row.id = crypto.randomUUID();
      generatedRowIdCount += 1;
    }
    if (typeof row.name !== "string" || !row.name.trim()) {
      row.name = `行 ${index + 1}`;
      recordDefault(recorder, {
        path: `rows[${index}].name`,
        label: `第 ${index + 1} 行名称`,
        normalizedValue: row.name,
        reason: "旧行未记录可用名称",
        technical: true,
      });
    }
    if (!Array.isArray(row.slotIds)) {
      row.slotIds = [];
      recordDefault(recorder, {
        path: `rows[${index}].slotIds`,
        label: `第 ${index + 1} 行 Slot Instance 关系`,
        normalizedValue: [],
        reason: "旧行未记录 Slot Instance 关系，稍后按 rowId 重建",
        technical: true,
      });
    }
  }

  if (generatedRowIdCount > 0) {
    recordDefault(recorder, {
      path: "rows[].id",
      label: "简易阶梯行标识",
      normalizedValue: `已生成 ${generatedRowIdCount} 个标识`,
      reason: "旧行未记录稳定标识",
      technical: true,
      count: generatedRowIdCount,
    });
  }

  if (rows.length === 0 && slots.length > 0) {
    rows.push({
      id: crypto.randomUUID(),
      name: "行 1",
      slotIds: [],
    });
    recordBehaviorChange(recorder, {
      path: "rows[0]",
      label: "简易阶梯默认行",
      previousValue: undefined,
      normalizedValue: "行 1",
      reason: "旧文件包含 Slot Instance 但没有行，已建立默认归属行",
    });
  }
}

export function normalizeSteppedGroups(
  params: SteppedLayoutParams,
  recorder?: ImportNormalizationRecorder,
) {
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
      recordDefault(recorder, {
        path: `groups[${index}].id`,
        label: `第 ${index + 1} 个分组标识`,
        normalizedValue: "已生成稳定标识",
        reason: "旧分组未记录稳定标识",
        technical: true,
      });
    }
    if (typeof group.name !== "string") {
      group.name = `组 ${index + 1}`;
      recordDefault(recorder, {
        path: `groups[${index}].name`,
        label: `第 ${index + 1} 个分组名称`,
        normalizedValue: group.name,
        reason: "旧分组未记录名称",
        technical: true,
      });
    }
    if (typeof group.color !== "string") {
      group.color = GROUP_COLORS[index % GROUP_COLORS.length];
      recordDefault(recorder, {
        path: `groups[${index}].color`,
        label: `第 ${index + 1} 个分组颜色`,
        normalizedValue: group.color,
        reason: "旧分组未记录显示颜色",
        technical: true,
      });
    }
    requireNumber(group as Record<string, unknown>, "bottomHeight");
    if (typeof group.useGroupSmoothingRadius !== "boolean") {
      group.useGroupSmoothingRadius = false;
      recordDefault(recorder, {
        path: `groups[${index}].useGroupSmoothingRadius`,
        label: `第 ${index + 1} 个分组独立平滑设置`,
        normalizedValue: false,
        reason: "旧分组默认使用全局平滑设置",
        technical: true,
      });
    }
    if (
      typeof group.groupSmoothingRadius !== "number" ||
      !Number.isFinite(group.groupSmoothingRadius)
    ) {
      group.groupSmoothingRadius = rawSmoothingRadius;
      recordDefault(recorder, {
        path: `groups[${index}].groupSmoothingRadius`,
        label: `第 ${index + 1} 个分组平滑半径`,
        normalizedValue: rawSmoothingRadius,
        reason: "旧分组未记录独立平滑半径",
        technical: true,
      });
    }
    if (typeof group.useGroupDisconnectDistance !== "boolean") {
      group.useGroupDisconnectDistance = false;
      recordDefault(recorder, {
        path: `groups[${index}].useGroupDisconnectDistance`,
        label: `第 ${index + 1} 个分组独立断开设置`,
        normalizedValue: false,
        reason: "旧分组默认使用全局断开距离",
        technical: true,
      });
    }
    if (
      typeof group.groupDisconnectDistance !== "number" ||
      !Number.isFinite(group.groupDisconnectDistance)
    ) {
      group.groupDisconnectDistance = rawDisconnectDistance;
      recordDefault(recorder, {
        path: `groups[${index}].groupDisconnectDistance`,
        label: `第 ${index + 1} 个分组断开距离`,
        normalizedValue: rawDisconnectDistance,
        reason: "旧分组未记录独立断开距离",
        technical: true,
      });
    }
  }

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if ("splitPartGroupId" in group) {
      recorder?.retire({
        path: `groups[${index}].splitPartGroupId`,
        label: `第 ${index + 1} 个分组的旧分件目标`,
        previousValue: group.splitPartGroupId,
        reason: "该字段已过时且没有当前对应字段",
      });
      delete group.splitPartGroupId;
    }
  }
}

export function migrateSteppedLegacyShape(
  params: SteppedLayoutParams,
  recorder?: ImportNormalizationRecorder,
) {
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
    recordMigration(recorder, {
      path: "groups",
      label: "阶梯高度分组",
      previousValue: hasLegacyBottomHeight
        ? "Slot Instance bottomHeight"
        : "缺少分组",
      normalizedValue: `${sortedGroups.length} 个高度分组`,
      reason: "当前阶梯布局使用分组表达高度关系",
    });
  }

  if (!Array.isArray(obj.groups)) {
    throw new Error("缺少或无效的字段: groups");
  }
  normalizeSteppedGroups(params, recorder);
}
