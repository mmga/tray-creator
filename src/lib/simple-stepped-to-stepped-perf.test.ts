/**
 * ADR-0002 性能门槛验证：simple-stepped 旧后端 vs stepped Rectangular Stepped Footprint 新后端
 *
 * 门槛（ADR-0002 第 11 段）：
 * - 样本：10、30、50 槽 + 至少 2 个真实历史 simple-stepped 文件
 * - 每样本预热后测 3 次取中位数
 * - 比率 = stepped_rectangular_time / simple_stepped_time
 * - 中位数 ≤ 1.25，任一样本 ≤ 1.5
 *
 * 通过后即可删除 simple-stepped 后端（E4）。
 */
import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import { createSimpleSteppedTrayModel } from "@/lib/simple-stepped-tray-model";
import { createSteppedCadTrayModel } from "@/lib/stepped-cad-tray-model";
import { convertSimpleSteppedToStepped } from "@/lib/simple-stepped-to-stepped";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import type { SimpleSteppedLayoutParams, SimpleSteppedSlot, SimpleSteppedRow } from "@/types/custom-tray";

const { measureVolume } = measurements;

/**
 * 构造一个 N 槽的 simple-stepped 参数（5 列网格，每行一个分组）。
 * - 槽位等间距分布在多行上
 * - 每行高度按 stepHeight 递增
 */
function buildSimpleSteppedFixture(slotCount: number): SimpleSteppedLayoutParams {
  const columns = 5;
  const rows = Math.ceil(slotCount / columns);
  const firstRowHeight = 10;
  const stepHeight = 5;
  const rowGap = 2;
  const spacing = 5;
  const diameter = 25;
  const effectiveDiameter = 25.4;
  const cellSize = effectiveDiameter + spacing;
  const trayWidth = cellSize * columns + spacing * 2;
  const trayDepth = cellSize * rows + rowGap * (rows - 1) + spacing * 2;

  const simpleRows: SimpleSteppedRow[] = [];
  const simpleSlots: SimpleSteppedSlot[] = [];

  for (let rowIdx = 0; rowIdx < rows; rowIdx += 1) {
    const rowId = `perf-row-${rowIdx + 1}`;
    const rowSlotIds: string[] = [];
    const startCol = rowIdx * columns;
    const endCol = Math.min(startCol + columns, slotCount);

    // x 是相对 holeCenterX 的偏移；y 是相对行中心线的偏移
    const rowCenterX = (columns - 1) / 2;
    for (let col = startCol; col < endCol; col += 1) {
      const localCol = col - startCol;
      const slotId = `perf-slot-${col + 1}`;
      simpleSlots.push({
        id: slotId,
        rowId,
        shape: "circle",
        diameter,
        x: (localCol - rowCenterX) * cellSize,
        y: 0,
        slotDefinitionId: undefined,
        effectiveDiameter,
      });
      rowSlotIds.push(slotId);
    }
    simpleRows.push({
      id: rowId,
      name: `行 ${rowIdx + 1}`,
      slotIds: rowSlotIds,
    });
  }

  return {
    ...SIMPLE_STEPPED_LAYOUT_DEFAULTS,
    trayWidth,
    trayDepth,
    rows: simpleRows,
    slots: simpleSlots,
    firstRowHeight,
    stepHeight,
    rowGap,
    spacing,
    outerMargin: spacing,
    outerMarginIndependent: false,
    holeDepth: 3,
    cornerRadius: 4,
  };
}

/**
 * 测量一个生成函数的中位耗时（ms）。
 * warmup 次预热后测 iterations 次取中位数。
 */
function measureMedianMs(
  fn: () => unknown,
  options: { warmup?: number; iterations?: number } = {},
): number {
  const warmup = options.warmup ?? 2;
  const iterations = options.iterations ?? 3;
  for (let i = 0; i < warmup; i += 1) {
    fn();
  }
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

describe("ADR-0002 性能门槛：simple-stepped → stepped rectangular 迁移", () => {
  // 用 it.each 覆盖 10/30/50 槽样本
  const slotCounts = [10, 30, 50] as const;

  it.each(slotCounts)(
    "%d 槽样本：stepped rectangular 相对 simple-stepped 的生成时间比率满足门槛",
    (slotCount) => {
      const simpleParams = buildSimpleSteppedFixture(slotCount);
      const { params: steppedParams } = convertSimpleSteppedToStepped(simpleParams);

      // 验证两个后端都产出正体积（语义等价前置检查）
      const simpleGeom = createSimpleSteppedTrayModel(simpleParams);
      const steppedGeom = createSteppedCadTrayModel(steppedParams);
      expect(measureVolume(simpleGeom)).toBeGreaterThan(0);
      expect(measureVolume(steppedGeom)).toBeGreaterThan(0);

      const simpleMedian = measureMedianMs(
        () => createSimpleSteppedTrayModel(simpleParams),
      );
      const steppedMedian = measureMedianMs(
        () => createSteppedCadTrayModel(steppedParams),
      );

      const ratio = steppedMedian / Math.max(simpleMedian, 0.001);

      // 记录数据便于审查（CI 日志可见）
      // eslint-disable-next-line no-console
      console.log(
        `[ADR-0002 perf] slotCount=${slotCount} simple=${simpleMedian.toFixed(2)}ms stepped=${steppedMedian.toFixed(2)}ms ratio=${ratio.toFixed(3)}`,
      );

      // ADR-0002 第 11 段：任一样本不得超过 1.5
      expect(ratio).toBeLessThanOrEqual(1.5);
    },
    60000, // 单测试 60s 超时（每个样本包含 warmup+3 次测量）
  );

  it("所有样本比率的中位数不超过 1.25（ADR-0002 门槛）", () => {
    const ratios: number[] = [];
    for (const slotCount of slotCounts) {
      const simpleParams = buildSimpleSteppedFixture(slotCount);
      const { params: steppedParams } = convertSimpleSteppedToStepped(simpleParams);
      const simpleMedian = measureMedianMs(
        () => createSimpleSteppedTrayModel(simpleParams),
      );
      const steppedMedian = measureMedianMs(
        () => createSteppedCadTrayModel(steppedParams),
      );
      ratios.push(steppedMedian / Math.max(simpleMedian, 0.001));
    }
    ratios.sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)];
    // eslint-disable-next-line no-console
    console.log(`[ADR-0002 perf] ratios=${ratios.map((r) => r.toFixed(3)).join(",")} median=${median.toFixed(3)}`);
    expect(median).toBeLessThanOrEqual(1.25);
  }, 180000); // 中位数汇总测试 180s 超时
});
