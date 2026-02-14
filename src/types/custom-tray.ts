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
  /** 兼容旧数据 (可选) */
  diameter?: number; 
}

/** 自定义布局参数（完全独立） */
export interface CustomLayoutParams {
  /** 托盘宽度 (mm) */
  trayWidth: number;
  /** 托盘深度 (mm) */
  trayDepth: number;
  /** 凹槽列表 */
  slots: FreeSlot[];
  /** 边距 (mm)，凹槽距托盘边缘的最小距离 */
  spacing: number;
  /** 底板厚度 (mm) */
  baseThickness: number;
  /** 凹槽深度 (mm) */
  holeDepth: number;
  /** 圆角半径 (mm) */
  cornerRadius: number;
}
