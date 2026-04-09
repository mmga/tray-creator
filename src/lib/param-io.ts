import type { TrayParams } from "@/types/tray";
import type {
  CustomLayoutParams,
  SteppedLayoutParams,
  AppMode,
} from "@/types/custom-tray";
import {
  DEFAULT_TRAY_PARAMS,
  PARAM_CONFIG,
} from "@/lib/grid-config";
import { CUSTOM_LIMITS } from "@/lib/custom-config";
import {
  GROUP_COLORS,
  STEPPED_LAYOUT_DEFAULTS,
  STEPPED_LIMITS,
} from "@/lib/stepped-config";
import { createGroupStructureOverrides } from "@/lib/stepped-group-params";

// ═══════════════════════════════════════════
// 参数导入导出工具
// ═══════════════════════════════════════════

export type ExportableParams =
  | TrayParams
  | CustomLayoutParams
  | SteppedLayoutParams;

interface ParamFile {
  version: number;
  mode: AppMode;
  params: ExportableParams;
}

const CURRENT_VERSION = 1;

function getRawSteppedSmoothingRadius(
  obj: Record<string, unknown>,
): number {
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

function getRawSteppedDisconnectDistance(
  obj: Record<string, unknown>,
): number {
  if (
    typeof obj.disconnectDistance === "number" &&
    Number.isFinite(obj.disconnectDistance)
  ) {
    return obj.disconnectDistance;
  }
  return STEPPED_LAYOUT_DEFAULTS.disconnectDistance;
}

// ── 导出 ──────────────────────────────────

function precisionReplacer(_key: string, value: unknown) {
  if (typeof value === "number") {
    return Math.round(value * 1000) / 1000;
  }
  return value;
}

export function buildParamFile(
  mode: AppMode,
  params: ExportableParams,
): ParamFile {
  return { version: CURRENT_VERSION, mode, params };
}

export function serializeParamFile(
  mode: AppMode,
  params: ExportableParams,
): string {
  return JSON.stringify(buildParamFile(mode, params), precisionReplacer, 2);
}

export function createParamBlob(mode: AppMode, params: ExportableParams): Blob {
  return new Blob([serializeParamFile(mode, params)], {
    type: "application/json",
  });
}

export function downloadParamFile(
  mode: AppMode,
  params: ExportableParams,
  filename: string = `tray-${mode}-config.json`,
) {
  const blob = createParamBlob(mode, params);
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 将参数序列化为 JSON 并触发浏览器下载 */
export function exportParams(mode: AppMode, params: ExportableParams) {
  downloadParamFile(mode, params);
}

// ── 导入 ──────────────────────────────────

/**
 * 纯数据层：接收已解析的 JSON 对象，校验并返回合法参数。
 * 供文件导入和本地草稿加载共用，避免两套校验逻辑。
 */
export function parseParamFileObject(
  data: unknown,
  expectedMode: AppMode,
): TrayParams | CustomLayoutParams | SteppedLayoutParams {
  if (!data || typeof data !== "object") {
    throw new Error("文件内容无效");
  }
  const paramFile = data as ParamFile;
  if (paramFile.version !== CURRENT_VERSION) {
    throw new Error(`不支持的版本号: ${paramFile.version}`);
  }

  // 支持 custom → stepped 自动迁移
  if (paramFile.mode === "custom" && expectedMode === "stepped") {
    const customParams = paramFile.params as CustomLayoutParams;
    validateCustomParams(customParams);
    const defaultGroupId = crypto.randomUUID();
    const steppedParams: SteppedLayoutParams = {
      trayWidth: customParams.trayWidth,
      trayDepth: customParams.trayDepth,
      slots: customParams.slots.map((s) => ({
        ...s,
        shape: "circle" as const,
        height: s.width,
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
    };
    validateSteppedParams(steppedParams);
    return steppedParams;
  }

  if (paramFile.mode !== expectedMode) {
    const modeNames: Record<string, string> = {
      grid: "网格",
      custom: "自定义",
      stepped: "自定义阶梯底座",
    };
    throw new Error(
      `模式不匹配：文件为「${modeNames[paramFile.mode] || paramFile.mode}」模式，当前为「${modeNames[expectedMode] || expectedMode}」模式`,
    );
  }

  // 校验并钳位参数
  if (expectedMode === "grid") {
    validateGridParams(paramFile.params as TrayParams);
  } else if (expectedMode === "stepped") {
    validateSteppedParams(paramFile.params as SteppedLayoutParams);
  } else {
    validateCustomParams(paramFile.params as CustomLayoutParams);
  }

  return paramFile.params;
}

/** 读取 JSON 文件并校验，返回解析后的参数 */
export function importParams(
  file: File,
  expectedMode: AppMode,
): Promise<TrayParams | CustomLayoutParams | SteppedLayoutParams> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const data = JSON.parse(text);
        resolve(parseParamFileObject(data, expectedMode));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}

// ── 校验 & 钳位 ──────────────────────────────

function requireNumber(obj: Record<string, unknown>, key: string) {
  if (typeof obj[key] !== "number") {
    throw new Error(`缺少或无效的字段: ${key}`);
  }
}

/** 将值钳位到 [min, max] 范围 */
function clampField(
  obj: Record<string, unknown>,
  key: string,
  config: { min: number; max: number },
) {
  const v = obj[key] as number;
  obj[key] = Math.max(config.min, Math.min(config.max, v));
}

function validateGridParams(p: TrayParams) {
  const obj = p as unknown as Record<string, unknown>;
  const numFields = [
    "rows",
    "columns",
    "holeDiameter",
    "spacing",
    "baseThickness",
    "holeDepth",
    "cornerRadius",
  ];
  for (const f of numFields) requireNumber(obj, f);

  // holeDiameter 范围校验（不在 PARAM_CONFIG 中，单独处理）
  const hd = obj.holeDiameter as number;
  if (hd <= 0 || hd > 200) {
    throw new Error(`holeDiameter: 超出合理范围 (0, 200]`);
  }

  // 钳位到允许范围
  clampField(obj, "columns", PARAM_CONFIG.columns);
  clampField(obj, "rows", PARAM_CONFIG.rows);
  clampField(obj, "spacing", PARAM_CONFIG.spacing);
  clampField(obj, "baseThickness", PARAM_CONFIG.baseThickness);
  clampField(obj, "holeDepth", PARAM_CONFIG.holeDepth);
  clampField(obj, "cornerRadius", PARAM_CONFIG.cornerRadius);

  // 边界间距字段（可选，旧版文件可能不含，使用默认值兜底）
  if (typeof obj.boundarySpacing !== "number")
    obj.boundarySpacing = DEFAULT_TRAY_PARAMS.boundarySpacing;
  if (typeof obj.boundarySpacingIndependent !== "boolean")
    obj.boundarySpacingIndependent = false;
  clampField(obj, "boundarySpacing", PARAM_CONFIG.boundarySpacing);
}

function validateCustomParams(p: CustomLayoutParams) {
  const obj = p as unknown as Record<string, unknown>;
  const numFields = [
    "trayWidth",
    "trayDepth",
    "spacing",
    "baseThickness",
    "holeDepth",
    "cornerRadius",
  ];
  for (const f of numFields) requireNumber(obj, f);
  if (typeof obj.boundarySpacing !== "number") {
    obj.boundarySpacing = obj.spacing;
  }
  if (typeof obj.boundarySpacingIndependent !== "boolean") {
    obj.boundarySpacingIndependent = false;
  }
  if (!Array.isArray(obj.slots)) {
    throw new Error("缺少或无效的字段: slots");
  }

  // 校验每个 slot 的结构与值
  const slots = obj.slots as Record<string, unknown>[];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || typeof slot !== "object") {
      throw new Error(`slots[${i}]: 无效的凹槽数据`);
    }
    // 必填字段校验
    for (const key of ["x", "y", "width", "height", "rotation"] as const) {
      if (
        typeof slot[key] !== "number" ||
        !Number.isFinite(slot[key] as number)
      ) {
        throw new Error(`slots[${i}].${key}: 缺少或无效（需要有限数字）`);
      }
    }
    // shape 校验
    if (slot.shape !== "circle" && slot.shape !== "ellipse") {
      throw new Error(`slots[${i}].shape: 必须是 "circle" 或 "ellipse"`);
    }
    // 值范围校验
    const w = slot.width as number;
    const h = slot.height as number;
    if (w <= 0 || w > 200) {
      throw new Error(`slots[${i}].width: 超出合理范围 (0, 200]`);
    }
    if (h <= 0 || h > 200) {
      throw new Error(`slots[${i}].height: 超出合理范围 (0, 200]`);
    }
    // 旋转钳位到 [0, 360)
    slot.rotation = (((slot.rotation as number) % 360) + 360) % 360;
    // 确保有 id
    if (typeof slot.id !== "string" || !slot.id) {
      slot.id = crypto.randomUUID();
    }
  }

  // 钳位到允许范围
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
}

function validateSteppedParams(p: SteppedLayoutParams) {
  const obj = p as unknown as Record<string, unknown>;
  for (const f of ["trayWidth", "trayDepth", "spacing", "holeDepth"])
    requireNumber(obj, f);
  if (!Array.isArray(obj.slots)) {
    throw new Error("缺少或无效的字段: slots");
  }

  const slots = obj.slots as Record<string, unknown>[];

  // 检测旧格式（slots 有 bottomHeight 但无 groupId / 没有 groups 数组）
  const hasLegacyBottomHeight = slots.some(
    (s) => typeof s.bottomHeight === "number" && !s.groupId,
  );
  const hasMissingGroups =
    !Array.isArray(obj.groups) || (obj.groups as unknown[]).length === 0;
  const rawSmoothingRadius = getRawSteppedSmoothingRadius(obj);
  const rawDisconnectDistance = getRawSteppedDisconnectDistance(obj);

  if (hasLegacyBottomHeight || hasMissingGroups) {
    // 迁移：按 bottomHeight 分组，相同高度入同一组
    const heightGroupMap = new Map<
      number,
      { id: string; name: string; color: string; bottomHeight: number }
    >();
    const migratedSlots = slots.map((slot) => {
      const bh =
        typeof slot.bottomHeight === "number"
          ? (slot.bottomHeight as number)
          : 10;
      let group = heightGroupMap.get(bh);
      if (!group) {
        const colorIdx = heightGroupMap.size % GROUP_COLORS.length;
        group = {
          id: crypto.randomUUID(),
          name: `组 ${heightGroupMap.size + 1}`,
          color: GROUP_COLORS[colorIdx],
          bottomHeight: bh,
          ...createGroupStructureOverrides({
            smoothingRadius: rawSmoothingRadius,
            disconnectDistance: rawDisconnectDistance,
          }),
        };
        heightGroupMap.set(bh, group);
      }
      return { ...slot, groupId: group.id };
    });
    const sortedGroups = [...heightGroupMap.values()].sort(
      (a, b) => a.bottomHeight - b.bottomHeight,
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
  }

  // 校验 groups 数组
  if (!Array.isArray(obj.groups)) {
    throw new Error("缺少或无效的字段: groups");
  }
  const groups = obj.groups as Record<string, unknown>[];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (!g || typeof g !== "object")
      throw new Error(`groups[${i}]: 无效的分组数据`);
    if (typeof g.id !== "string" || !g.id) g.id = crypto.randomUUID();
    if (typeof g.name !== "string") g.name = `组 ${i + 1}`;
    if (typeof g.color !== "string")
      g.color = GROUP_COLORS[i % GROUP_COLORS.length];
    requireNumber(g as Record<string, unknown>, "bottomHeight");
    if (typeof g.useGroupSmoothingRadius !== "boolean") {
      g.useGroupSmoothingRadius = false;
    }
    if (
      typeof g.groupSmoothingRadius !== "number" ||
      !Number.isFinite(g.groupSmoothingRadius)
    ) {
      g.groupSmoothingRadius = rawSmoothingRadius;
    }
    if (typeof g.useGroupDisconnectDistance !== "boolean") {
      g.useGroupDisconnectDistance = false;
    }
    if (
      typeof g.groupDisconnectDistance !== "number" ||
      !Number.isFinite(g.groupDisconnectDistance)
    ) {
      g.groupDisconnectDistance = rawDisconnectDistance;
    }
    clampField(
      g as Record<string, unknown>,
      "bottomHeight",
      STEPPED_LIMITS.bottomHeight,
    );
    clampField(
      g as Record<string, unknown>,
      "groupSmoothingRadius",
      STEPPED_LIMITS.smoothingRadius,
    );
    clampField(
      g as Record<string, unknown>,
      "groupDisconnectDistance",
      STEPPED_LIMITS.disconnectDistance,
    );
  }

  // activeGroupId 安全备用
  const groupIds = new Set((obj.groups as { id: string }[]).map((g) => g.id));
  if (
    typeof obj.activeGroupId !== "string" ||
    !groupIds.has(obj.activeGroupId as string)
  ) {
    obj.activeGroupId = (obj.groups as { id: string }[])[0]?.id ?? "";
  }

  // 校验 slots
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || typeof slot !== "object") {
      throw new Error(`slots[${i}]: 无效的凹槽数据`);
    }
    for (const key of ["x", "y", "width", "height", "rotation"] as const) {
      if (
        typeof slot[key] !== "number" ||
        !Number.isFinite(slot[key] as number)
      ) {
        throw new Error(`slots[${i}].${key}: 缺少或无效（需要有限数字）`);
      }
    }
    if (slot.shape !== "circle" && slot.shape !== "ellipse") {
      slot.shape = "circle";
    }
    slot.shape = "circle";
    slot.height = slot.width;
    const w = slot.width as number;
    const h = slot.height as number;
    if (w <= 0 || w > 200) {
      throw new Error(`slots[${i}].width: 超出合理范围 (0, 200]`);
    }
    if (h <= 0 || h > 200) {
      throw new Error(`slots[${i}].height: 超出合理范围 (0, 200]`);
    }
    slot.rotation = (((slot.rotation as number) % 360) + 360) % 360;
    if (typeof slot.id !== "string" || !slot.id) {
      slot.id = crypto.randomUUID();
    }
    // groupId 归属校验
    if (
      typeof slot.groupId !== "string" ||
      !groupIds.has(slot.groupId as string)
    ) {
      slot.groupId = (obj.groups as { id: string }[])[0]?.id ?? "";
    }
    // 删除旧版 bottomHeight
    delete slot.bottomHeight;
  }

  // 钳位全局参数
  clampField(obj, "trayWidth", STEPPED_LIMITS.trayWidth);
  clampField(obj, "trayDepth", STEPPED_LIMITS.trayDepth);
  clampField(obj, "spacing", STEPPED_LIMITS.spacing);
  clampField(obj, "holeDepth", STEPPED_LIMITS.holeDepth);

  // smoothingRadius 兼容旧版 bridgeRadius
  if (
    typeof obj.smoothingRadius !== "number" ||
    !Number.isFinite(obj.smoothingRadius as number)
  ) {
    obj.smoothingRadius = rawSmoothingRadius;
  }
  delete obj.bridgeRadius;
  clampField(obj, "smoothingRadius", STEPPED_LIMITS.smoothingRadius);

  if (
    typeof obj.disconnectDistance !== "number" ||
    !Number.isFinite(obj.disconnectDistance as number)
  ) {
    obj.disconnectDistance = rawDisconnectDistance;
  }
  clampField(obj, "disconnectDistance", STEPPED_LIMITS.disconnectDistance);
}
