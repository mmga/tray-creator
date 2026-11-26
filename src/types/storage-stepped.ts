import type { FreeSlot } from "@/types/custom-tray";
import type { BaseHoleParams, SmallBaseHolePresetKey } from "@/types/tray";

/**
 * 阶梯收纳展示台：产品语义
 *
 * - 一个三级空心阶梯主体，每阶下方是一个独立收纳仓；
 * - 每阶一块可互换的整宽托盘，托盘负责模型槽位与可选底孔；
 * - 主体与托盘共享同一套接口尺寸，接口版本与实际尺寸必须一起持久化。
 *
 * 与“自定义阶梯底座”不同：本模式的托盘总厚度、底板厚度和台阶高度由产品规格固定，
 * 不继承普通阶梯的“底厚 + 槽深”语义，也不使用槽位分组。
 */

/** 接口版本；接口实际参数变化时版本与基准测试必须同步更新。 */
export const STORAGE_STEPPED_INTERFACE_VERSION = 1;

/** 主体高度规格：首阶台面高度不同，台阶步进统一 40 mm。 */
export type StorageSteppedHeightSpecId = "standard" | "storage";

/**
 * 接口实际参数快照。
 *
 * 这些数值同时驱动主体开口、托盘外形、二维边界与校验；
 * 界面可调整打样参数，但不得让接口两侧尺寸各自漂移。
 */
export interface StorageSteppedInterfaceParams {
  /** 主体总宽 (mm) */
  bodyWidth: number;
  /** 单阶标称深度 (mm) */
  moduleDepth: number;
  /** 阶数；首版固定 3 */
  stepCount: number;
  /** 托盘总厚度 (mm)；首版固定 6 */
  trayThickness: number;
  /** 下部壁厚 (mm) */
  lowerWallThickness: number;
  /** 上沿壁厚 (mm)，等于承托台阶宽度 */
  rimThickness: number;
  /** 指扣直径 (mm) */
  fingerPullDiameter: number;
  /** 主体底板厚度 (mm) */
  baseThickness: number;
  /** 单边装配间隙 (mm) */
  assemblyClearance: number;
}

/**
 * 单阶托盘配置。
 *
 * 槽位使用 FreeSlot 的实际几何快照（slotWidth/slotHeight 已含加工公差）；
 * 底孔参数作用于所属托盘，不传播到其他阶。
 */
export interface StorageSteppedTrayConfig extends BaseHoleParams {
  /** 所属阶索引，从 0 开始 */
  stepIndex: number;
  /** 最近一次应用的预设 ID；"custom" 表示手工编辑过布局。仅作说明，不用于重建几何。 */
  presetId: string;
  /** 槽位列表；空列表表示平板托盘 */
  slots: FreeSlot[];
  /** 槽深 (mm)，从托盘顶面向下 */
  holeDepth: number;
  /** 25mm 小底盘使用的磁片规格 */
  smallBaseHoleSize: SmallBaseHolePresetKey;
}

/** 阶梯收纳展示台完整参数。 */
export interface StorageSteppedParams {
  /** 接口版本 */
  interfaceVersion: number;
  /** 主体高度规格 */
  heightSpecId: StorageSteppedHeightSpecId;
  /** 首阶实际台面高度 (mm)，必须与高度规格一致 */
  firstStepHeight: number;
  /** 实际台阶步进高度 (mm) */
  stepRise: number;
  /** 接口实际参数快照 */
  interface: StorageSteppedInterfaceParams;
  /** 三阶托盘配置，按 stepIndex 升序保存 */
  trays: StorageSteppedTrayConfig[];
  /** 槽位最小边缘间距 (mm) */
  slotSpacing: number;
  /** 槽位到托盘边界最小距离 (mm) */
  slotBoundarySpacing: number;
}
