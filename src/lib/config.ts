import type { BasePreset } from "@/types/tray";

/**
 * 共享配置：
 * - 与具体模式无关，或被多个模式复用
 * - 模式专属默认值/范围放到各自的 *-config 文件
 */

/** 默认凹槽公差 (mm)，静默追加到凹槽直径，不在 UI 中显示 */
const DEFAULT_HOLE_TOLERANCE = 0.4;

/** 特定直径的公差映射表 */
const SLOT_TOLERANCE_MAP: Record<number, number> = {
  25: 0.2,
};

/** 根据凹槽直径获取公差 */
export function getSlotTolerance(diameter: number): number {
  return SLOT_TOLERANCE_MAP[diameter] ?? DEFAULT_HOLE_TOLERANCE;
}

export const BASE_HOLE_CONFIG = {
  presets: {
    "19.5": { diameter: 19.5, depth: 1.2 },
    "25": { diameter: 25, depth: 1.2 },
  },
  tolerance: 0.2,
  topWall: 0.6,
  minBottomWall: 0.6,
  minBaseThickness: 2.4,
} as const;

export const BASE_PRESETS: BasePreset[] = [
  { name: "小型步兵 (25mm)", diameter: 25 },
  { name: "中型步兵 (28.5mm)", diameter: 28.5 },
  { name: "标准步兵 (32mm)", diameter: 32 },
  { name: "大型 (40mm)", diameter: 40 },
  { name: "超大型 (50mm)", diameter: 50 },
  { name: "巨型 (60mm)", diameter: 60 },
];

/** 网格 / 自定义模式共用的结构参数范围 */
export const SHARED_LAYOUT_LIMITS = {
  baseThickness: { label: "底板厚度", min: 2, max: 4, step: 0.2, unit: "mm" },
  holeDepth: { label: "凹槽深度", min: 2, max: 4, step: 0.2, unit: "mm" },
  cornerRadius: { label: "圆角半径", min: 0, max: 10, step: 1, unit: "mm" },
} as const;

/** 最大构建尺寸 (mm)，超过此值会警告 */
export const MAX_BUILD_SIZE = 260;

export const RENDER_CONFIG = {
  cylinderSegments: 64,
  cornerSegments: 32,
  modelColor: "#2a2a2e",
  modelMetalness: 0.3,
  modelRoughness: 0.5,
  edgeThreshold: 45,
  camera: {
    position: [120, 120, 120],
    fov: 45,
  },
} as const;

export const SLOT_COLORS: Record<number, string> = {
  25: "#ef4444",
  28.5: "#f97316",
  32: "#eab308",
  40: "#84cc16",
  50: "#06b6d4",
  60: "#8b5cf6",
  75: "#ec4899",
  90: "#d946ef",
  105: "#a855f7",
  120: "#6366f1",
  150: "#3b82f6",
  170: "#0ea5e9",
};
