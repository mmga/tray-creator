import type { BaseHolePresetKey } from "@/types/tray";

export type AppMode =
  | "grid"
  | "custom"
  | "base-converter"
  | "simple-stepped"
  | "stepped"
  | "stepped-cad";

export interface BaseConverterParams {
  sourceStandardId: string;
  targetStandardId: string;
  /** 凹槽底部保留厚度 (mm) */
  floorThickness: number;
  /** 从顶面向下挖的凹槽深度，同时也是四向挡边高度 (mm) */
  recessDepth: number;
}

export type SplitGrooveType = "profile" | "inset";

export type BaseHoleStructure =
  | "none"
  | "magnetic-base-hole"
  | "magnet-post-hole";

/** 阶梯底座分组（一组凹槽统一高度，并形成阶梯结构的一层） */
export interface SlotGroup {
  id: string;
  name: string;
  color: string;
  /** 该组所有凹槽柱子从底板向上的高度 (mm)，决定阶梯层的高度边界 */
  bottomHeight: number;
  /** 是否使用该组自己的平滑半径；关闭时跟随全局参数 */
  useGroupSmoothingRadius: boolean;
  /** 该组缓存的平滑半径值；仅在开启独立设置时生效 */
  groupSmoothingRadius: number;
  /** 是否使用该组自己的断链距离；关闭时跟随全局参数 */
  useGroupDisconnectDistance: boolean;
  /** 该组缓存的断链距离值；仅在开启独立设置时生效 */
  groupDisconnectDistance: number;
  /** 拆件导出时并入的目标分组；为空时该组单独拆件 */
  splitPartGroupId?: string;
}

/** 分组轮廓预览（供 2D 编辑器逐组渲染） */
export interface GroupOutlinePreview {
  key: string;
  groupId: string;
  color: string;
  /** 该组的高度（mm），用于 2D 编辑器按高度排序渲染（低组先画，高组后画覆盖） */
  bottomHeight: number;
  /** 采样后的闭合多边形点列（用户坐标系） */
  points: { x: number; y: number }[];
  /** 是否为整体外轮廓（所有凹槽的包络，用于显示整体边界） */
  isOverall?: boolean;
}

/** 自由放置的凹槽 */
export interface FreeSlot {
  id: string; // 唯一标识（UUID）
  x: number; // 中心 X 坐标 (mm)，相对于托盘左下角
  y: number; // 中心 Y 坐标 (mm)，相对于托盘左下角
  shape: "circle" | "ellipse";
  width: number; // 圆形时为直径，椭圆时长轴
  height: number; // 圆形时为直径，椭圆时短轴
  /** 创建该槽位所用的统一凹槽定义 ID；旧数据可能没有 */
  slotDefinitionId?: string;
  /** 最终生成的槽宽快照；圆形时为已内置公差的直径 */
  slotWidth?: number;
  /** 最终生成的槽高快照；圆形时为已内置公差的直径 */
  slotHeight?: number;
  rotation: number; // 旋转角度 (度)
  /** 椭圆凹槽专属：轮廓向外等距扩张的距离 (mm) */
  outerOffset?: number;
  /** 椭圆凹槽专属：2 为标准椭圆，大于 2 会让中段弧线更饱满 */
  profileExponent?: number;
}

/** 阶梯底座凹槽：继承 FreeSlot，通过 groupId 关联到所属分组 */
export interface SteppedSlot extends FreeSlot {
  /** 所属分组 ID */
  groupId: string;
}

/** 简易阶梯模式凹槽：x 为“行本地坐标” */
export interface SimpleSteppedSlot {
  id: string;
  /** 所属行 ID */
  rowId: string;
  /** 第一版仅支持圆形 */
  shape: "circle";
  /** 凹槽直径（mm） */
  diameter: number;
  /** 创建该槽位所用的统一凹槽定义 ID；旧数据可能没有 */
  slotDefinitionId?: string;
  /** 最终生成的凹槽直径快照，已内置公差 */
  effectiveDiameter?: number;
  /** 相对所属行局部坐标系的 X 偏移（mm） */
  x: number;
  /** 相对所属行中心线的 Y 偏移（mm） */
  y: number;
}

/** 简易阶梯模式中的一行 */
export interface SimpleSteppedRow {
  id: string;
  name: string;
  /** 行内凹槽顺序，主要用于编辑态 */
  slotIds: string[];
}

/** 简易阶梯模式 2D 画布行带 */
export interface SimpleSteppedRowBand {
  id: string;
  name: string;
  /** 行带左下角 X（用户坐标系） */
  x: number;
  /** 行带左下角 Y（用户坐标系） */
  y: number;
  width: number;
  depth: number;
  topHeight: number;
  isActive?: boolean;
}

/** 自定义布局参数（完全独立） */
export interface CustomLayoutParams {
  /** 托盘尺寸模式；缺失时按自动尺寸兼容旧配置。 */
  traySizingMode?: "auto" | "fixed";
  /** 托盘宽度 (mm) */
  trayWidth: number;
  /** 托盘深度 (mm) */
  trayDepth: number;
  /** 凹槽列表 */
  slots: FreeSlot[];
  /** 凹槽间距 (mm)，凹槽与凹槽之间的最小距离 */
  spacing: number;
  /** 边界间距 (mm)，凹槽到有效底板边界的最小距离 */
  boundarySpacing: number;
  /** 是否独立调整边界间距（false 时跟随 spacing） */
  boundarySpacingIndependent: boolean;
  /** 底板厚度 (mm) */
  baseThickness: number;
  /** 凹槽深度 (mm) */
  holeDepth: number;
  /** 圆角半径 (mm) */
  cornerRadius: number;
  /** 侧面斜面宽度 (mm)，下沿保持有效底板尺寸，上沿向内收缩 */
  sideBevelWidth: number;
  /** 是否启用底板磁吸孔 */
  enableBaseHole: boolean;
  /** 兼容导入/导出保留字段；实际规格由配置自动匹配 */
  baseHoleSize: BaseHolePresetKey;
}

/** 阶梯底座布局参数 */
export interface SteppedLayoutParams {
  /** 托盘宽度 (mm) */
  trayWidth: number;
  /** 托盘深度 (mm) */
  trayDepth: number;
  /** 阶梯底座凹槽列表 */
  slots: SteppedSlot[];
  /** 分组列表（决定阶梯层高，每组凹槽共享相同高度） */
  groups: SlotGroup[];
  /** 当前激活的分组 ID（新添加凹槽自动进入此组） */
  activeGroupId: string;
  /** 凹槽间距 (mm)，同时作为柱子外扩量 */
  spacing: number;
  /** 凹槽深度 (mm)，全局固定，从柱顶向下挖的深度 */
  holeDepth: number;
  /** 拆件装配槽深度 (mm)；0 表示不生成公母装配槽 */
  splitGrooveDepth: number;
  /** CAD 拆件时在下方实体生成上方实体轮廓浅槽 */
  enableSplitRecess?: boolean;
  /** CAD 拆件装配槽型：完整轮廓或内缩轮廓 */
  splitGrooveType?: SplitGrooveType;
  /** CAD 拆件时生成定位柱和定位窝 */
  enableSplitLocators?: boolean;
  /** 旧字段：导入时兼容旧的装配方式选项 */
  splitAssemblyMode?: "profile-tenon" | "locator-recess";
  /** 平滑半径 (mm)，控制底座轮廓的圆滑程度 */
  smoothingRadius: number;
  /** 为 0 时沿用平滑半径的自然桥接行为；大于 0 时按显式边缘距离阈值断开槽群 */
  disconnectDistance: number;
  /** 底板孔位结构；旧参数缺失时由 enableBaseHole 迁移。 */
  baseHoleStructure?: BaseHoleStructure;
  /** 磁铁桩孔最终成品直径 (mm)，不追加内置容差。 */
  magnetPostHoleDiameter?: number;
  /** 磁铁桩孔从凹槽底面向下的深度 (mm)。 */
  magnetPostHoleDepth?: number;
  /** @deprecated 仅用于兼容旧参数导入。 */
  enableBaseHole?: boolean;
  /** 兼容导入/导出保留字段；实际规格由配置自动匹配 */
  baseHoleSize: BaseHolePresetKey;
  /** 调试开关：输出面朝向/体积日志（仅开发调试） */
  debugOrientation?: boolean;
}

/** 简易阶梯模式参数 */
export interface SimpleSteppedLayoutParams {
  /** 当前底板长度（mm），至少不小于内容推导出的最小长度。 */
  trayWidth: number;
  /** 当前底板深度（mm），至少不小于内容推导出的最小深度。 */
  trayDepth: number;
  /** 行列表 */
  rows: SimpleSteppedRow[];
  /** 槽位列表 */
  slots: SimpleSteppedSlot[];
  /** 第一排基础高度（mm） */
  firstRowHeight: number;
  /** 统一阶梯步进高度（mm） */
  stepHeight: number;
  /** 行与行之间的间距（mm） */
  rowGap: number;
  /** 同行凹槽最小边缘间距（mm） */
  spacing: number;
  /** 是否独立调整边界间距（false 时跟随 spacing） */
  outerMarginIndependent: boolean;
  /** 行矩形边界安全边距（mm） */
  outerMargin: number;
  /** 凹槽深度（mm） */
  holeDepth: number;
  /** 底板外边缘圆角（mm） */
  cornerRadius: number;
}
