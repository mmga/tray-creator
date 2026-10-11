import type { BaseHolePresetKey, BasePreset } from "@/types/tray";
import {
  CIRCLE_SLOT_DEFINITIONS,
  DEFAULT_CIRCLE_SLOT_TOLERANCE,
  DEFAULT_ELLIPSE_OUTER_OFFSET,
  DEFAULT_ELLIPSE_PROFILE_EXPONENT,
  findCircleSlotDefinitionByBaseDiameter,
} from "@/lib/slot-definitions";

/**
 * 共享配置：
 * - 与具体模式无关，或被多个模式复用
 * - 模式专属默认值/范围放到各自的 *-config 文件
 */

type SlotShape = "circle" | "ellipse";

/** 默认凹槽公差 (mm)，静默追加到凹槽直径，不在 UI 中显示 */
const DEFAULT_HOLE_TOLERANCE = DEFAULT_CIRCLE_SLOT_TOLERANCE;

/** 椭圆凹槽轮廓向外等距扩张的距离 (mm) */
export const ELLIPSE_OUTER_OFFSET = DEFAULT_ELLIPSE_OUTER_OFFSET;

/**
 * 椭圆轮廓丰满度。
 * 2 = 标准椭圆；大于 2 会把中段弧线撑得更饱满，同时保持长短轴端点不变。
 */
export const ELLIPSE_PROFILE_EXPONENT = DEFAULT_ELLIPSE_PROFILE_EXPONENT;

/** 根据凹槽直径获取公差 */
export function getSlotTolerance(diameter: number, shape?: SlotShape): number {
  if (shape === "ellipse") {
    return ELLIPSE_OUTER_OFFSET * 2;
  }

  return (
    findCircleSlotDefinitionByBaseDiameter(diameter)?.tolerance ??
    DEFAULT_HOLE_TOLERANCE
  );
}

/** 获取凹槽轮廓向外等距扩张的距离。 */
export function getSlotOuterOffset(
  width: number,
  height: number = width,
  shape?: SlotShape,
  ellipseOuterOffset?: number,
): number {
  if (shape === "ellipse") {
    return ellipseOuterOffset ?? ELLIPSE_OUTER_OFFSET;
  }

  return getSlotTolerance(Math.max(width, height), shape) / 2;
}

export const BASE_HOLE_CONFIG = {
  defaultPreset: "25" as BaseHolePresetKey,
  presets: {
    "20": { label: "20mm 磁片", diameter: 20.2, depth: 1, minBottomWall: 0.6 },
    "25": { label: "标准磁片", diameter: 25.2, depth: 1.2, minBottomWall: 0.6 },
    "40": { label: "大地盘磁片", diameter: 40.4, depth: 1.4, minBottomWall: 0.4 },
  },
  topWall: 0.6,
} as const;

export function getBaseHolePreset(baseHoleSize: BaseHolePresetKey) {
  return BASE_HOLE_CONFIG.presets[baseHoleSize];
}

export function getBaseHoleMinBottomWall(baseHoleSize: BaseHolePresetKey) {
  return BASE_HOLE_CONFIG.presets[baseHoleSize].minBottomWall;
}

export function getBaseHoleMinBaseThickness(baseHoleSize: BaseHolePresetKey) {
  return (
    BASE_HOLE_CONFIG.topWall +
    BASE_HOLE_CONFIG.presets[baseHoleSize].depth +
    getBaseHoleMinBottomWall(baseHoleSize)
  );
}

export const BASE_PRESETS: BasePreset[] = CIRCLE_SLOT_DEFINITIONS
  .filter((definition) => definition.id !== "circle-10")
  .map((definition) => ({
    name: definition.name,
    diameter: definition.baseDiameter,
  }));

/** 网格 / 自定义模式共用的结构参数范围 */
export const SHARED_LAYOUT_LIMITS = {
  baseThickness: { label: "底板厚度", min: 1, max: 4, step: 0.2, unit: "mm" },
  holeDepth: { label: "凹槽深度", min: 1, max: 4, step: 0.2, unit: "mm" },
  cornerRadius: { label: "圆角半径", min: 0, max: 10, step: 1, unit: "mm" },
  sideBevelWidth: { label: "侧面斜面宽度", min: 0, max: 10, step: 0.5, unit: "mm" },
} as const;

/** 最大构建尺寸 (mm)，超过此值会警告 */
export const MAX_BUILD_SIZE = 260;

/** 参数输入允许的最大托盘尺寸；打印尺寸只作为提示，不阻断建模。 */
export const MAX_TRAY_SIZE = 5000;

/**
 * 视图共享调色板：阶梯模式分组色与拆件预览零件色统一使用此配色。
 * 首色刻意排除红色，避免与 2D 画布的碰撞/越界警示红混淆。
 */
export const VIEW_PALETTE = [
  "#c8a84e",
  "#8cb880",
  "#7fb0c8",
  "#c88f6a",
  "#b38cc8",
  "#c87f96",
] as const;

export const RENDER_CONFIG = {
  cylinderSegments: 64,
  cornerSegments: 32,
  modelColor: "#b7b0a2",
  modelMetalness: 0.3,
  modelRoughness: 0.5,
  edgeThreshold: 45,
  camera: {
    position: [120, 120, 120],
    fov: 45,
  },
} as const;
