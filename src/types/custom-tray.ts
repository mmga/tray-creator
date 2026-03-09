export type AppMode = "grid" | "custom" | "stepped";

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

/** 阶梯底座凹槽：继承 FreeSlot，新增每槽独立的生长高度 */
export interface SteppedSlot extends FreeSlot {
  /** 生长高度 (mm)，凹槽柱子从底板向上生长的距离 */
  bottomHeight: number;
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
  /** 凹槽间距 (mm)，同时作为柱子外扩量 */
  spacing: number;
  /** 凹槽深度 (mm)，全局固定，从柱顶向下挖的深度 */
  holeDepth: number;
  /** 平滑半径 (mm)，控制底座轮廓的圆滑程度 */
  smoothingRadius: number;
  /** 调试开关：输出面朝向/体积日志（仅开发调试） */
  debugOrientation?: boolean;
}
