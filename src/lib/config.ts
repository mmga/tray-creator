import type { TrayParams, BasePreset } from "@/types/tray";

/**
 * ============================================
 * 托盘配置文件
 * 所有参数集中管理，避免硬编码
 * ============================================
 */

// ---- 底座预设 ----
export const BASE_PRESETS: BasePreset[] = [
  { name: "小型步兵 (25mm)", diameter: 25, tolerance: 0.5 },
  { name: "中型步兵 (28.5mm)", diameter: 28.5, tolerance: 0.5 },
  { name: "标准步兵 (32mm)", diameter: 32, tolerance: 0.5 },
  { name: "大型 (40mm)", diameter: 40, tolerance: 0.5 },
  { name: "超大型 (50mm)", diameter: 50, tolerance: 0.6 },
  { name: "巨型 (60mm)", diameter: 60, tolerance: 0.6 },
];

// ---- 默认预设索引（标准步兵 32mm） ----
export const DEFAULT_PRESET_INDEX = 2;

// ---- 默认托盘参数 ----
export const DEFAULT_TRAY_PARAMS: TrayParams = {
  rows: 1,
  columns: 1,
  holeDiameter:
    BASE_PRESETS[DEFAULT_PRESET_INDEX].diameter +
    BASE_PRESETS[DEFAULT_PRESET_INDEX].tolerance,
  spacing: 2,
  wallWidth: 3,
  wallHeight: 8,
  baseThickness: 2,
  holeDepth: 3,
  cornerRadius: 2,
};

// ---- 参数范围限制 ----
export const PARAM_LIMITS = {
  rows: { min: 1, max: 20, step: 1 },
  columns: { min: 1, max: 20, step: 1 },
  holeDiameter: { min: 10, max: 100, step: 0.5 },
  spacing: { min: 0, max: 20, step: 0.5 },
  wallWidth: { min: 1, max: 10, step: 0.5 },
  wallHeight: { min: 2, max: 30, step: 0.5 },
  baseThickness: { min: 0.5, max: 10, step: 0.5 },
  holeDepth: { min: 1, max: 20, step: 0.5 },
  cornerRadius: { min: 0, max: 10, step: 0.5 },
} as const;

// ---- 3D 渲染配置 ----
export const RENDER_CONFIG = {
  /** 圆柱体细分段数 */
  cylinderSegments: 32,
  /** 参数变化防抖延迟 (ms) */
  debounceMs: 300,
  /** 模型颜色 */
  modelColor: "#b0b0b0",
  /** 模型金属度 */
  modelMetalness: 0.1,
  /** 模型粗糙度 */
  modelRoughness: 0.6,
} as const;
