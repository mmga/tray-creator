export type AppMode = "grid" | "custom" | "simple-stepped" | "stepped";

/** 阶梯底座分组（一组凹槽统一高度，并形成阶梯结构的一层） */
export interface SlotGroup {
  id: string;
  name: string;
  color: string;
  /** 该组所有凹槽柱子从底板向上的高度 (mm)，决定阶梯层的高度边界 */
  bottomHeight: number;
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
  rotation: number; // 旋转角度 (度)
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
  /** 是否启用底板磁吸孔 */
  enableBaseHole: boolean;
  /** 底板磁吸孔规格: '19.5' (19.5x1mm) | '25' (25x1.2mm) */
  baseHoleSize: "19.5" | "25";
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
  /** 平滑半径 (mm)，控制底座轮廓的圆滑程度 */
  smoothingRadius: number;
  /** 为 0 时沿用平滑半径的自然桥接行为；大于 0 时按显式边缘距离阈值断开槽群 */
  disconnectDistance: number;
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
  /** 行矩形边界安全边距（mm） */
  outerMargin: number;
  /** 凹槽深度（mm） */
  holeDepth: number;
}
