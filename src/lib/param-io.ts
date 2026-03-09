import type { TrayParams } from "@/types/tray";
import type { CustomLayoutParams, SteppedLayoutParams, AppMode } from "@/types/custom-tray";
import { PARAM_CONFIG, CUSTOM_LIMITS, STEPPED_LIMITS, STEPPED_SLOT_DEFAULTS } from "@/lib/config";

// ═══════════════════════════════════════════
// 参数导入导出工具
// ═══════════════════════════════════════════

interface ParamFile {
  version: number;
  mode: AppMode;
  params: TrayParams | CustomLayoutParams | SteppedLayoutParams;
}

const CURRENT_VERSION = 1;

// ── 导出 ──────────────────────────────────

/** 将参数序列化为 JSON 并触发浏览器下载 */
export function exportParams(
  mode: AppMode,
  params: TrayParams | CustomLayoutParams | SteppedLayoutParams,
) {
  const data: ParamFile = { version: CURRENT_VERSION, mode, params };
  // 使用 replacer 函数将导出的数字截断至最多 3 位小数，避免浮点数精度溢出（如 27.400000000000006 => 27.4）
  const json = JSON.stringify(
    data,
    (key, value) => {
      if (typeof value === "number") {
        return Math.round(value * 1000) / 1000;
      }
      return value;
    },
    2,
  );
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `tray-${mode}-config.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 导入 ──────────────────────────────────

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
        const data = JSON.parse(text) as ParamFile;

        if (!data || typeof data !== "object") {
          throw new Error("文件内容无效");
        }
        if (data.version !== CURRENT_VERSION) {
          throw new Error(`不支持的版本号: ${data.version}`);
        }

        // 支持 custom → stepped 自动迁移
        if (data.mode === "custom" && expectedMode === "stepped") {
          const customParams = data.params as CustomLayoutParams;
          validateCustomParams(customParams);
          const steppedParams: SteppedLayoutParams = {
            trayWidth: customParams.trayWidth,
            trayDepth: customParams.trayDepth,
            slots: customParams.slots.map((s) => ({
              ...s,
              wallHeight: customParams.holeDepth || STEPPED_SLOT_DEFAULTS.wallHeight,
              bottomHeight: customParams.baseThickness || STEPPED_SLOT_DEFAULTS.bottomHeight,
            })),
            spacing: customParams.spacing,
            boundarySpacing: customParams.boundarySpacing,
            boundarySpacingIndependent: customParams.boundarySpacingIndependent,
            baseThickness: customParams.baseThickness,
            cornerRadius: customParams.cornerRadius,
            bottomExpandMargin: 1.0,
            enableBaseHole: customParams.enableBaseHole,
            baseHoleSize: customParams.baseHoleSize,
          };
          validateSteppedParams(steppedParams);
          resolve(steppedParams);
          return;
        }

        if (data.mode !== expectedMode) {
          const modeNames: Record<string, string> = {
            grid: "网格",
            custom: "自定义",
            stepped: "自定义阶梯底座",
          };
          throw new Error(
            `模式不匹配：文件为「${modeNames[data.mode] || data.mode}」模式，当前为「${modeNames[expectedMode] || expectedMode}」模式`,
          );
        }

        // 校验并钳位参数
        if (expectedMode === "grid") {
          validateGridParams(data.params as TrayParams);
        } else if (expectedMode === "stepped") {
          validateSteppedParams(data.params as SteppedLayoutParams);
        } else {
          validateCustomParams(data.params as CustomLayoutParams);
        }

        resolve(data.params);
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
  const numFields = [
    "trayWidth",
    "trayDepth",
    "spacing",
    "baseThickness",
    "cornerRadius",
    "bottomExpandMargin",
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

  // 校验每个 slot
  const slots = obj.slots as Record<string, unknown>[];
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
      throw new Error(`slots[${i}].shape: 必须是 "circle" 或 "ellipse"`);
    }
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
    // 自动补齐 wallHeight / bottomHeight
    if (typeof slot.wallHeight !== "number" || !Number.isFinite(slot.wallHeight as number) || (slot.wallHeight as number) <= 0) {
      slot.wallHeight = STEPPED_SLOT_DEFAULTS.wallHeight;
    }
    if (typeof slot.bottomHeight !== "number" || !Number.isFinite(slot.bottomHeight as number) || (slot.bottomHeight as number) <= 0) {
      slot.bottomHeight = STEPPED_SLOT_DEFAULTS.bottomHeight;
    }
    // 钳位
    slot.wallHeight = Math.max(STEPPED_LIMITS.wallHeight.min, Math.min(STEPPED_LIMITS.wallHeight.max, slot.wallHeight as number));
    slot.bottomHeight = Math.max(STEPPED_LIMITS.bottomHeight.min, Math.min(STEPPED_LIMITS.bottomHeight.max, slot.bottomHeight as number));
  }

  // 钳位全局参数
  clampField(obj, "trayWidth", STEPPED_LIMITS.trayWidth);
  clampField(obj, "trayDepth", STEPPED_LIMITS.trayDepth);
  clampField(obj, "spacing", STEPPED_LIMITS.spacing);
  clampField(obj, "boundarySpacing", STEPPED_LIMITS.boundarySpacing);
  clampField(obj, "baseThickness", STEPPED_LIMITS.baseThickness);
  clampField(obj, "cornerRadius", STEPPED_LIMITS.cornerRadius);
  clampField(obj, "bottomExpandMargin", STEPPED_LIMITS.bottomExpandMargin);

  if (!obj.boundarySpacingIndependent) {
    obj.boundarySpacing = obj.spacing;
  }
}
