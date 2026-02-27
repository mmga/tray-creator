export type AppMode = "grid" | "custom";

/** 自由放置的凹槽 */
export interface FreeSlot {
  id: string; // 唯一标识（UUID）
  x: number; // 中心 X 坐标 (mm)，相对于托盘左下角
  y: number; // 中心 Y 坐标 (mm)，相对于托盘左下角
  shape: 'circle' | 'ellipse';
  width: number;  // 圆形时为直径，椭圆时长轴
  height: number; // 圆形时为直径，椭圆时短轴
  rotation: number; // 旋转角度 (度)
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
