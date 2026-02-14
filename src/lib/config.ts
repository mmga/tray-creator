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
  rows: 5,
  columns: 2,
  holeDiameter: BASE_PRESETS[DEFAULT_PRESET_INDEX].diameter,
  spacing: 2,
  baseThickness: 3,
  holeDepth: 2,
  cornerRadius: 6,
};

// ---- 参数范围限制 ----
export const PARAM_LIMITS = {
  rows: { min: 1, max: 6, step: 1 },
  columns: { min: 1, max: 6, step: 1 },
  spacing: { min: 2, max: 10, step: 1 },
  baseThickness: { min: 2, max: 4, step: 1 },
  holeDepth: { min: 2, max: 4, step: 0.2 },
  cornerRadius: { min: 0, max: 10, step: 1 },
} as const;

// ---- 3D 渲染配置 ----
export const RENDER_CONFIG = {
  /** 圆柱体细分段数 */
  cylinderSegments: 64,
  /** 圆角细分段数 */
  cornerSegments: 32,
  /** 模型颜色（黑灰色，接近实物 3D 打印色） */
  modelColor: "#2a2a2e",
  /** 模型金属度（较高以在深色表面产生高光） */
  modelMetalness: 0.3,
  /** 模型粗糙度 */
  modelRoughness: 0.5,
  /** 边缘线阈值角度 */
  edgeThreshold: 15,
  /** 摄像机初始配置 */
  camera: {
    position: [120, 120, 120],
    fov: 45,
  },
} as const;

// ---- 自定义布局配置 ----
import type { CustomLayoutParams } from "@/types/custom-tray";

export const CUSTOM_LAYOUT_DEFAULTS: CustomLayoutParams = {
  trayWidth: 150,
  trayDepth: 100,
  slots: [],
  spacing: 5,
  baseThickness: 3,
  holeDepth: 2,
  cornerRadius: 6,
};


export const CUSTOM_LIMITS = {
  trayWidth: { min: 50, max: 260, step: 1 },
  trayDepth: { min: 50, max: 260, step: 1 },
  spacing: { min: 2, max: 20, step: 1 },
  // 复用 PARAM_LIMITS 的其他限制
  baseThickness: PARAM_LIMITS.baseThickness,
  holeDepth: PARAM_LIMITS.holeDepth,
  cornerRadius: PARAM_LIMITS.cornerRadius,
} as const;

// ---- 凹槽颜色映射 (用于 2D 编辑器) ----
export const SLOT_COLORS: Record<number, string> = {
  25: "#ef4444", // red-500
  28.5: "#f97316", // orange-500
  32: "#eab308", // yellow-500
  40: "#84cc16", // lime-500
  50: "#06b6d4", // cyan-500
  60: "#8b5cf6", // violet-500
};
