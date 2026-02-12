/**
 * 托盘参数接口
 */
export interface TrayParams {
  /** 列数（每行凹槽数量） */
  rows: number;
  /** 行数（凹槽行数） */
  columns: number;
  /** 凹槽直径 (mm) */
  holeDiameter: number;
  /** 凹槽边缘间距 (mm) */
  spacing: number;
  /** 边框宽度 (mm) */
  wallWidth: number;
  /** 边框高度 (mm) */
  wallHeight: number;
  /** 底板厚度 (mm) */
  baseThickness: number;
  /** 凹槽深度 (mm) */
  holeDepth: number;
  /** 边框圆角半径 (mm) */
  cornerRadius: number;
}

/**
 * 底座预设
 */
export interface BasePreset {
  /** 预设名称 */
  name: string;
  /** 底座直径 (mm) */
  diameter: number;
  /** 公差 (mm)，实际凹槽直径 = diameter + tolerance */
  tolerance: number;
}
