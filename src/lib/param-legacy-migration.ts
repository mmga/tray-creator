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

export function migrateGridLegacyShape(params: TrayParams) {
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

export function migrateCustomLegacyShape(params: CustomLayoutParams) {
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

export function migrateSimpleSteppedLegacyShape(params: SimpleSteppedLayoutParams) {
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

export function normalizeSteppedGroups(params: SteppedLayoutParams) {
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

  for (const group of groups) {
    delete group.splitPartGroupId;
  }
}

export function migrateSteppedLegacyShape(params: SteppedLayoutParams) {
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
