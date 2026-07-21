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
import mixedRowsArtifact from "@/lib/fixtures/historical-simple-stepped-mixed-rows.json";
import baseHolesArtifact from "@/lib/fixtures/historical-simple-stepped-base-holes.json";
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
function measureOnceMs(fn: () => unknown): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function measureRepeatedMs(fn: () => unknown, repetitions: number): number {
  return measureOnceMs(() => {
    for (let index = 0; index < repetitions; index += 1) {
      fn();
    }
  }) / repetitions;
}

function median(samples: number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function measureBackendPair(
  oldBackend: () => unknown,
  newBackend: () => unknown,
): { oldMedian: number; newMedian: number; ratio: number } {
  for (let warmup = 0; warmup < 2; warmup += 1) {
    oldBackend();
    newBackend();
  }
  const probeDuration = Math.max(
    measureOnceMs(oldBackend),
    measureOnceMs(newBackend),
  );
  const repetitions = Math.min(
    10,
    Math.max(1, Math.ceil(250 / Math.max(probeDuration, 1))),
  );
  const oldSamples: number[] = [];
  const newSamples: number[] = [];

  for (let i = 0; i < 3; i += 1) {
    const oldFirst = i % 2 === 0;
    if (oldFirst) {
      oldSamples.push(measureRepeatedMs(oldBackend, repetitions));
      newSamples.push(measureRepeatedMs(newBackend, repetitions));
    } else {
      newSamples.push(measureRepeatedMs(newBackend, repetitions));
      oldSamples.push(measureRepeatedMs(oldBackend, repetitions));
    }
  }

  const oldMedian = median(oldSamples);
  const newMedian = median(newSamples);
  return {
    oldMedian,
    newMedian,
    ratio: newMedian / Math.max(oldMedian, 0.001),
  };
}

describe("ADR-0002 性能门槛：simple-stepped → stepped rectangular 迁移", () => {
  it("10/30/50 槽与两个历史文件全部满足性能门槛", () => {
    const fixtures: Array<[string, SimpleSteppedLayoutParams]> = [
      ...([10, 30, 50] as const).map(
        (slotCount): [string, SimpleSteppedLayoutParams] => [
          `${slotCount} 槽`,
          buildSimpleSteppedFixture(slotCount),
        ],
      ),
      [
        "历史不等宽行",
        structuredClone(mixedRowsArtifact.params) as unknown as SimpleSteppedLayoutParams,
      ],
      [
        "历史底板孔",
        structuredClone(baseHolesArtifact.params) as unknown as SimpleSteppedLayoutParams,
      ],
    ];
    const results: Array<{ label: string; ratio: number }> = [];

    fixtures.forEach(([label, simpleParams]) => {
      const { params: steppedParams } = convertSimpleSteppedToStepped(simpleParams);
      const simpleGeom = createSimpleSteppedTrayModel(simpleParams);
      const steppedGeom = createSteppedCadTrayModel(steppedParams);
      expect(measureVolume(simpleGeom)).toBeGreaterThan(0);
      expect(measureVolume(steppedGeom)).toBeGreaterThan(0);
      const result = measureBackendPair(
        () => createSimpleSteppedTrayModel(simpleParams),
        () => createSteppedCadTrayModel(steppedParams),
      );
      results.push({ label, ratio: result.ratio });
      console.log(
        `[ADR-0002 perf] sample=${label} simple=${result.oldMedian.toFixed(2)}ms stepped=${result.newMedian.toFixed(2)}ms ratio=${result.ratio.toFixed(3)}`,
      );
    });

    results.forEach((result) => {
      expect(result.ratio, `${result.label} 单样本比率`).toBeLessThanOrEqual(1.5);
    });
    const ratios = results.map((result) => result.ratio);
    const medianRatio = median(ratios);
    console.log(`[ADR-0002 perf] ratios=${ratios.map((ratio) => ratio.toFixed(3)).join(",")} median=${medianRatio.toFixed(3)}`);
    expect(medianRatio).toBeLessThanOrEqual(1.25);
  }, 240000);
});
