import type { TrayParams, BasePreset } from "@/types/tray";
import type { CustomLayoutParams } from "@/types/custom-tray";

/**
 * ============================================
 * 托盘配置文件
 * 所有参数集中管理，避免硬编码
 * ============================================
 */

// ═══════════════════════════════════════════
// 1. 建模公差
// ═══════════════════════════════════════════

/** 默认凹槽公差 (mm)，静默追加到凹槽直径，不在 UI 中显示 */
export const DEFAULT_HOLE_TOLERANCE = 0.4;

/** 特定直径的公差映射表 */
export const SLOT_TOLERANCE_MAP: Record<number, number> = {
  25: 0.2,
};

/** 根据凹槽直径获取公差 */
export function getSlotTolerance(diameter: number): number {
  return SLOT_TOLERANCE_MAP[diameter] ?? DEFAULT_HOLE_TOLERANCE;
}

// ═══════════════════════════════════════════
// 2. 磁吸孔配置
// ═══════════════════════════════════════════

export const BASE_HOLE_CONFIG = {
  /** 规格预设 */
  presets: {
    "19.5": { diameter: 19.5, depth: 1.2 },
    "25": { diameter: 25, depth: 1.2 },
  },
  /** 建模公差 (mm)，仅用于建模，不显示在 UI */
  tolerance: 0.2,
  /** 距凹槽底部固定壁厚 (mm) */
  topWall: 0.6,
  /** 底部最小壁厚 (mm) */
  minBottomWall: 0.6,
  /** 启用磁吸孔时的最小底板厚度 (mm) */
  minBaseThickness: 2.4,
} as const;

// ═══════════════════════════════════════════
// 3. 底座 & 椭圆预设
// ═══════════════════════════════════════════

export const BASE_PRESETS: BasePreset[] = [
  { name: "小型步兵 (25mm)", diameter: 25 },
  { name: "中型步兵 (28.5mm)", diameter: 28.5 },
  { name: "标准步兵 (32mm)", diameter: 32 },
  { name: "大型 (40mm)", diameter: 40 },
  { name: "超大型 (50mm)", diameter: 50 },
  { name: "巨型 (60mm)", diameter: 60 },
];

export const ELLIPSE_PRESETS = [
  { name: "60x35.5mm", width: 60, height: 35.5 },
  { name: "75x42mm", width: 75, height: 42 },
  { name: "90x52mm", width: 90, height: 52 },
  { name: "105x70mm", width: 105, height: 70 },
  { name: "120x92mm", width: 120, height: 92 },
  { name: "150x95mm", width: 150, height: 95 },
  { name: "170x105mm", width: 170, height: 105 },
];

// ═══════════════════════════════════════════
// 4. 默认参数
// ═══════════════════════════════════════════

/** 默认预设索引（标准步兵 32mm） */
export const DEFAULT_PRESET_INDEX = 2;

/** 网格模式默认托盘参数 */
export const DEFAULT_TRAY_PARAMS: TrayParams = {
  rows: 5,
  columns: 2,
  holeDiameter: BASE_PRESETS[DEFAULT_PRESET_INDEX].diameter,
  spacing: 5,
  baseThickness: 3,
  holeDepth: 2.6,
  cornerRadius: 4,
  enableBaseHole: false,
  baseHoleSize: "25",
};

/** 自定义布局默认参数 */
export const CUSTOM_LAYOUT_DEFAULTS: CustomLayoutParams = {
  trayWidth: 150,
  trayDepth: 100,
  slots: [],
  spacing: 5,
  baseThickness: 3,
  holeDepth: 2.6,
  cornerRadius: 6,
  enableBaseHole: false,
  baseHoleSize: "25",
};

// ═══════════════════════════════════════════
// 5. 参数范围与元数据（网格模式）
// ═══════════════════════════════════════════

/**
 * 集中管理每个参数的 label / min / max / step / unit，
 * 同时供 UI 渲染和校验使用。
 */
export const PARAM_CONFIG = {
  columns: { label: "列数", min: 1, max: 6, step: 1, unit: "个" },
  rows: { label: "行数", min: 1, max: 6, step: 1, unit: "个" },
  spacing: { label: "间距", min: 2, max: 10, step: 1, unit: "mm" },
  baseThickness: { label: "底板厚度", min: 2, max: 4, step: 0.2, unit: "mm" },
  holeDepth: { label: "凹槽深度", min: 2, max: 4, step: 0.2, unit: "mm" },
  cornerRadius: { label: "圆角半径", min: 0, max: 10, step: 1, unit: "mm" },
} as const;

// ═══════════════════════════════════════════
// 6. 自定义布局参数范围
// ═══════════════════════════════════════════

export const CUSTOM_LIMITS = {
  trayWidth: { label: "宽度", min: 50, max: 260, step: 1, unit: "mm" },
  trayDepth: { label: "深度", min: 50, max: 260, step: 1, unit: "mm" },
  spacing: { label: "边距", min: 2, max: 20, step: 1, unit: "mm" },
  // 共享参数：复用 PARAM_CONFIG 的范围与元数据
  baseThickness: PARAM_CONFIG.baseThickness,
  holeDepth: PARAM_CONFIG.holeDepth,
  cornerRadius: PARAM_CONFIG.cornerRadius,
} as const;

// ═══════════════════════════════════════════
// 7. 构建限制
// ═══════════════════════════════════════════

/** 最大构建尺寸 (mm)，超过此值会警告 */
export const MAX_BUILD_SIZE = 260;

// ═══════════════════════════════════════════
// 8. 3D 渲染配置
// ═══════════════════════════════════════════

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
  edgeThreshold: 45,
  /** 摄像机初始配置 */
  camera: {
    position: [120, 120, 120],
    fov: 45,
  },
} as const;

// ═══════════════════════════════════════════
// 9. 凹槽颜色映射（2D 编辑器）
// ═══════════════════════════════════════════

// 使用直径或长轴作为 Key
export const SLOT_COLORS: Record<number, string> = {
  25: "#ef4444", // red-500
  28.5: "#f97316", // orange-500
  32: "#eab308", // yellow-500
  40: "#84cc16", // lime-500
  50: "#06b6d4", // cyan-500
  60: "#8b5cf6", // violet-500
  // 椭圆长轴
  75: "#ec4899", // pink-500
  90: "#d946ef", // fuchsia-500
  105: "#a855f7", // purple-500
  120: "#6366f1", // indigo-500
  150: "#3b82f6", // blue-500
  170: "#0ea5e9", // sky-500
};
