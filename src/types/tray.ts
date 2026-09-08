export type BaseHolePresetKey = "20" | "25" | "40";
export type SmallBaseHolePresetKey = "20" | "25";
export type GridSlotShape = "circle" | "rectangle";
export type BaseHoleStructure =
  | "none"
  | "magnetic-base-hole"
  | "magnet-post-hole";

export interface BaseHoleParams {
  baseHoleStructure: BaseHoleStructure;
  magnetPostHoleDiameter: number;
  magnetPostHoleDepth: number;
  /** 兼容导入/导出保留字段；实际规格按每个 Slot Instance 自动匹配。 */
  baseHoleSize: BaseHolePresetKey;
  /** 25mm 小底盘使用的磁片规格；缺失时默认使用 20mm 小铁片。 */
  smallBaseHoleSize?: SmallBaseHolePresetKey;
  /** @deprecated 仅作为历史参数输入，由规范化流程迁移后删除。 */
  enableBaseHole?: boolean;
}

/**
 * 堆叠盒体结构参数。
 *
 * 作为可选快照挂载在 TrayParams 与 CustomLayoutParams 上（StackableBoxCapableParams），
 * 缺失或 enabled=false 时全部走普通托盘路径。运行时统一通过 resolver 补全，
 * 业务代码不散落 `??` 默认值。
 */
export interface StackableBoxParams {
  /** 是否启用堆叠盒体结构 */
  enabled: boolean;
  /** 盒体真实外部长度 (mm) */
  outerWidth: number;
  /** 盒体真实外部深度 (mm) */
  outerDepth: number;
  /** 盒体真实外部高度 (mm)，从底部最低点量到盒口最高点 */
  outerHeight: number;
  /** 最小内壁间距 (mm)，槽位到盒体安全边界的最小距离 */
  minimumWallClearance: number;
  /** XY 配合间隙 (mm)，底部外倒角与顶部内倒角之间的每侧间隙 */
  xyFitClearance: number;
  /** 盖板厚度 (mm) */
  lidThickness: number;
}

/** 允许携带可选堆叠盒体参数快照的参数接口。 */
export interface StackableBoxCapableParams {
  stackableBox?: StackableBoxParams;
}

/**
 * 托盘参数接口
 */
export interface TrayParams extends BaseHoleParams, StackableBoxCapableParams {
  /** 行数（凹槽行数） */
  rows: number;
  /** 列数（每行凹槽数量） */
  columns: number;
  /** 凹槽直径 (mm)，不含公差 */
  holeDiameter: number;
  /** 创建该凹槽规格所用的统一凹槽定义 ID */
  slotDefinitionId?: string;
  /** 网格凹槽轮廓类型；旧文件缺失时按圆形处理 */
  slotShape?: GridSlotShape;
  /** 最终生成的凹槽直径 (mm)，已内置公差 */
  slotDiameter?: number;
  /** 矩形凹槽的名义宽度 (mm)，仅 slotShape=rectangle 时生效 */
  slotBaseWidth?: number;
  /** 矩形凹槽的名义深度 (mm)，仅 slotShape=rectangle 时生效 */
  slotBaseHeight?: number;
  /** 矩形凹槽的最终宽度快照 (mm)，已内置公差 */
  slotWidth?: number;
  /** 矩形凹槽的最终深度快照 (mm)，已内置公差 */
  slotHeight?: number;
  /** 间距 (mm)，X/Y 未独立时作为统一间距；也是兼容旧文件的共享值 */
  spacing: number;
  /** 是否分别设置 X / Y 轴凹槽间距 */
  spacingIndependent: boolean;
  /** X 轴凹槽间距 (mm)，仅在 spacingIndependent=true 时生效 */
  spacingX: number;
  /** Y 轴凹槽间距 (mm)，仅在 spacingIndependent=true 时生效 */
  spacingY: number;
  /** 底板厚度 (mm) */
  baseThickness: number;
  /** 凹槽深度 (mm)，即边框/墙壁高度 */
  holeDepth: number;
  /** 圆角半径 (mm)，仅影响底板四角竖直方向的边 */
  cornerRadius: number;
  /** 侧面斜面宽度 (mm)，下沿保持外形尺寸，上沿向内收缩 */
  sideBevelWidth: number;
  /** 边界间距 (mm)，凹槽到底板边缘的距离；仅在 boundarySpacingIndependent=true 时生效 */
  boundarySpacing: number;
  /** 是否独立调整边界间距（false 时 X/Y 两轴分别跟随对应的 spacing） */
  boundarySpacingIndependent: boolean;
  /** 单轴排列是否使用半圆槽；仅 rows=1 或 columns=1 时生效 */
  halfCircleSlots: boolean;
  /** 是否只生成带底板磁吸孔的底板，不生成上层凹槽 */
  basePlateOnly: boolean;
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
