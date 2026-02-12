/**
 * 托盘参数接口
 */
export interface TrayParams {
  /** 行数（凹槽行数） */
  rows: number;
  /** 列数（每行凹槽数量） */
  columns: number;
  /** 凹槽直径 (mm)，不含公差 */
  holeDiameter: number;
  /** 间距 (mm)，边-凹槽、凹槽-凹槽之间的统一间距 */
  spacing: number;
  /** 底板厚度 (mm) */
  baseThickness: number;
  /** 凹槽深度 (mm)，即边框/墙壁高度 */
  holeDepth: number;
  /** 圆角半径 (mm)，仅影响底板四角竖直方向的边 */
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
}
