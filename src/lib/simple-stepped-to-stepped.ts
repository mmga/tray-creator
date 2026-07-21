/**
 * Historical Simple Stepped Artifact → Stepped Tray 转换器
 *
 * 把历史 simple-stepped 参数转换为当前 stepped 参数，遵循 CONTEXT:580-587 与 ADR-0002：
 * - 非空行按原顺序转换为高度组（行序 = 组高度序）
 * - 行内 (x, y) 投影为全局槽位坐标，行间距固化在位置中（CONTEXT:582）
 * - 空行不生成组且不消耗高度步进（CONTEXT:584）
 * - 输出固定尺寸的 Rectangular Stepped Footprint（CONTEXT:593）
 * - 保留 trayWidth/Depth、cornerRadius、holeDepth、baseHoleStructure；disable split assembly
 * - 行高度：firstRowHeight + activeRowIndex × stepHeight
 *
 * 转换必须保留：关键尺寸、槽位最终几何、最低层圆角、各高度顶面、凹槽深度、
 * 底孔结构、可打印实体数量和可制造性；关键线性误差 ≤ 0.1mm，体积差 ≤ 1%（CONTEXT:585-586）。
 */
import { deriveSimpleSteppedLayout } from "@/lib/simple-stepped-layout";
import { STEPPED_LAYOUT_DEFAULTS, GROUP_COLORS } from "@/lib/stepped-config";
import { createGroupStructureOverrides } from "@/lib/stepped-group-params";
import type {
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
  SteppedSlot,
} from "@/types/custom-tray";

export interface SimpleSteppedConversionReport {
  /** 生成的 stepped 分组数（等于 simple-stepped 的非空行数） */
  groupCount: number;
  /** 被跳过的空行数 */
  emptyRowCount: number;
  /** 转换后的槽位数 */
  slotCount: number;
}

export interface SimpleSteppedConversionResult {
  params: SteppedLayoutParams;
  report: SimpleSteppedConversionReport;
}

/**
 * 把历史 simple-stepped 参数转换为当前 stepped 参数。
 *
 * 调用方应在 Historical Param Artifact Reader 识别到 simple-stepped 结构后调用此函数，
 * 然后把结果交给 stepped 的 Param Normalization Pipeline 做最终校验与补全。
 */
export function convertSimpleSteppedToStepped(
  simpleParams: SimpleSteppedLayoutParams,
): SimpleSteppedConversionResult {
  const derived = deriveSimpleSteppedLayout(simpleParams);
  const activeRows = derived.activeRows;

  // 每个非空行 → 一个高度分组（按原顺序）
  // 空行已在 deriveSimpleSteppedLayout 中被 activeRows 过滤掉，因此 index 即有效行序
  const groups = activeRows.map((row, index) => ({
    id: row.id,
    name: row.name || `组 ${index + 1}`,
    color: GROUP_COLORS[index % GROUP_COLORS.length],
    bottomHeight: row.topHeight,
    ...createGroupStructureOverrides({
      smoothingRadius: STEPPED_LAYOUT_DEFAULTS.smoothingRadius,
      disconnectDistance: STEPPED_LAYOUT_DEFAULTS.disconnectDistance,
    }),
  }));

  // 每个槽位的全局坐标投影（包含行间距固化）
  const slots: SteppedSlot[] = [];
  for (const row of activeRows) {
    for (const derivedSlot of row.slots) {
      slots.push({
        id: derivedSlot.id,
        // 行内 (x, y) → 全局坐标：globalX/globalY 已由 deriveSimpleSteppedLayout 计算
        x: derivedSlot.globalX,
        y: derivedSlot.globalY,
        shape: "circle",
        width: derivedSlot.diameter,
        height: derivedSlot.diameter,
        rotation: 0,
        slotDefinitionId: undefined,
        slotWidth: derivedSlot.effectiveDiameter,
        slotHeight: derivedSlot.effectiveDiameter,
        groupId: row.id,
      });
    }
  }

  const steppedParams: SteppedLayoutParams = {
    // 显式使用 Rectangular Stepped Footprint（CONTEXT:593）
    footprintStyle: "rectangular",
    // 保留原托盘尺寸作为最低连续层固定尺寸（CONTEXT:581 "preserves its stored tray dimensions"）
    traySizingMode: "fixed",
    trayWidth: derived.trayWidth,
    trayDepth: derived.trayDepth,
    slots,
    groups,
    activeGroupId: groups[0]?.id ?? "",
    spacing: simpleParams.spacing,
    // simple-stepped 的 outerMargin 对应 stepped 的 boundarySpacing（行带外缘到托盘边缘）
    boundarySpacing: simpleParams.outerMarginIndependent
      ? simpleParams.outerMargin
      : simpleParams.spacing,
    boundarySpacingIndependent: simpleParams.outerMarginIndependent,
    // 保留最低层圆角（CONTEXT:585）
    cornerRadius: simpleParams.cornerRadius,
    holeDepth: simpleParams.holeDepth,
    splitGrooveDepth: STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth,
    // 转换后的 simple-stepped 默认禁用分件装配（CONTEXT:581）
    enableSplitAssembly: false,
    enableSplitRecess: false,
    splitGrooveType: "profile",
    enableSplitLocators: false,
    smoothingRadius: STEPPED_LAYOUT_DEFAULTS.smoothingRadius,
    disconnectDistance: STEPPED_LAYOUT_DEFAULTS.disconnectDistance,
    // 保留底板孔位结构（CONTEXT:585）
    baseHoleStructure: simpleParams.baseHoleStructure,
    magnetPostHoleDiameter: simpleParams.magnetPostHoleDiameter,
    magnetPostHoleDepth: simpleParams.magnetPostHoleDepth,
    baseHoleSize: simpleParams.baseHoleSize,
  };

  // 原始行数 - 活跃行数 = 被跳过的空行数（CONTEXT:584）
  const emptyRowCount = Math.max(0, simpleParams.rows.length - activeRows.length);

  return {
    params: steppedParams,
    report: {
      groupCount: groups.length,
      emptyRowCount,
      slotCount: slots.length,
    },
  };
}
