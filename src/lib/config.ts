import type { TrayParams, BasePreset } from "@/types/tray";

/**
 * ============================================
 * 托盘配置文件
 * 所有参数集中管理，避免硬编码
 * ============================================
 */

// ---- 公差 (mm)，静默追加到凹槽直径，不在 UI 中显示 ----
export const HOLE_TOLERANCE = 0.4;

// ---- 底座预设 ----
export const BASE_PRESETS: BasePreset[] = [
  { name: "小型步兵 (25mm)", diameter: 25 },
  { name: "中型步兵 (28.5mm)", diameter: 28.5 },
  { name: "标准步兵 (32mm)", diameter: 32 },
  { name: "大型 (40mm)", diameter: 40 },
  { name: "超大型 (50mm)", diameter: 50 },
  { name: "巨型 (60mm)", diameter: 60 },
];

// ---- 默认预设索引（标准步兵 32mm） ----
export const DEFAULT_PRESET_INDEX = 2;

// ---- 默认托盘参数 ----
export const DEFAULT_TRAY_PARAMS: TrayParams = {
  rows: 1,
  columns: 1,
  holeDiameter: BASE_PRESETS[DEFAULT_PRESET_INDEX].diameter,
  spacing: 3,
  baseThickness: 2,
  holeDepth: 5,
  cornerRadius: 2,
};

// ---- 参数范围限制 ----
export const PARAM_LIMITS = {
  rows: { min: 1, max: 6, step: 1 },
  columns: { min: 1, max: 6, step: 1 },
  spacing: { min: 1, max: 10, step: 1 },
  baseThickness: { min: 1, max: 4, step: 1 },
  holeDepth: { min: 1, max: 4, step: 0.2 },
  cornerRadius: { min: 0, max: 10, step: 1 },
} as const;

// ---- 3D 渲染配置 ----
export const RENDER_CONFIG = {
  /** 圆柱体细分段数 */
  cylinderSegments: 32,
  /** 圆角细分段数 */
  cornerSegments: 16,
  /** 参数变化防抖延迟 (ms) */
  debounceMs: 300,
  /** 模型颜色 */
  modelColor: "#b0b0b0",
  /** 模型金属度 */
  modelMetalness: 0.1,
  /** 模型粗糙度 */
  modelRoughness: 0.6,
} as const;
