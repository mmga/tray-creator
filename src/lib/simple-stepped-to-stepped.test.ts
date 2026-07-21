import { describe, expect, it } from "vitest";
import { convertSimpleSteppedToStepped } from "@/lib/simple-stepped-to-stepped";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";

function makeRow(id: string, name: string) {
  return { id, name, slotIds: [] as string[] };
}

function makeSlot(id: string, rowId: string, x: number, y: number, diameter = 25) {
  return {
    id,
    rowId,
    shape: "circle" as const,
    diameter,
    x,
    y,
  };
}

function createSimpleParams(): SimpleSteppedLayoutParams {
  const row1 = makeRow("row-1", "行 1");
  const row2 = makeRow("row-2", "行 2");
  const slot1 = makeSlot("s1", row1.id, 0, 0, 25);
  const slot2 = makeSlot("s2", row1.id, 30, 0, 25);
  const slot3 = makeSlot("s3", row2.id, 0, 0, 25);
  row1.slotIds = [slot1.id, slot2.id];
  row2.slotIds = [slot3.id];

  return {
    ...SIMPLE_STEPPED_LAYOUT_DEFAULTS,
    rows: [row1, row2],
    slots: [slot1, slot2, slot3],
    firstRowHeight: 10,
    stepHeight: 5,
    rowGap: 2,
    spacing: 5,
    outerMargin: 5,
    outerMarginIndependent: false,
    holeDepth: 3,
    cornerRadius: 4,
    trayWidth: 100,
    trayDepth: 80,
  };
}

describe("simple-stepped to stepped converter", () => {
  it("非空行按原顺序转换为高度组，行高随步进递增", () => {
    const { params, report } = convertSimpleSteppedToStepped(createSimpleParams());

    expect(report.groupCount).toBe(2);
    expect(report.slotCount).toBe(3);
    expect(params.footprintStyle).toBe("rectangular");
    expect(params.traySizingMode).toBe("fixed");

    // 第一组高度 = firstRowHeight = 10；第二组 = 10 + 5 = 15
    expect(params.groups[0].bottomHeight).toBe(10);
    expect(params.groups[1].bottomHeight).toBe(15);
    // 组顺序保持 simple-stepped 行顺序
    expect(params.groups.map((g) => g.id)).toEqual(["row-1", "row-2"]);
    expect(params.groups.map((group) => group.legacyRectangularFootprint)).toEqual([
      { centerX: 50, centerY: 17.6, width: 65.2, depth: 35.2 },
      { centerX: 50, centerY: 54.800000000000004, width: 65.2, depth: 35.2 },
    ]);
  });

  it("空行不生成组且不消耗高度步进（CONTEXT:584）", () => {
    const emptyRow = makeRow("row-empty", "空行");
    const params = {
      ...createSimpleParams(),
      rows: [
        makeRow("row-1", "行 1"),
        emptyRow, // 中间插入空行
        makeRow("row-2", "行 2"),
      ],
    };
    // 第一行两个槽，第三行一个槽；空行不消耗高度
    const { report } = convertSimpleSteppedToStepped(params);
    expect(report.groupCount).toBe(2);
    expect(report.emptyRowCount).toBe(1);
    expect(report.slotCount).toBe(3);
  });

  it("保留 trayWidth/Depth/cornerRadius/holeDepth 与底板孔位结构", () => {
    const params = {
      ...createSimpleParams(),
      trayWidth: 200,
      trayDepth: 150,
      cornerRadius: 8,
      holeDepth: 5,
      baseHoleStructure: "magnetic-base-hole" as const,
      baseHoleSize: "25" as const,
    };
    const { params: stepped } = convertSimpleSteppedToStepped(params);

    expect(stepped.trayWidth).toBe(200);
    expect(stepped.trayDepth).toBe(150);
    expect(stepped.cornerRadius).toBe(8);
    expect(stepped.holeDepth).toBe(5);
    expect(stepped.baseHoleStructure).toBe("magnetic-base-hole");
  });

  it("转换后的槽位保留最终几何并使用全局坐标（CONTEXT:582）", () => {
    const { params } = convertSimpleSteppedToStepped(createSimpleParams());

    // 所有槽位都有 groupId 且 shape 为 circle
    expect(params.slots.every((s) => s.groupId && s.shape === "circle")).toBe(true);
    // slotWidth/Height 应等于 effectiveDiameter（已内置公差）
    expect(params.slots[0].slotWidth).toBeGreaterThan(0);
    expect(params.slots[0].slotHeight).toBe(params.slots[0].slotWidth);

    // 第一行的两个槽位 y 坐标应接近（同一行内），第二行的槽位 y 应更大
    const row1Slots = params.slots.filter((s) => s.groupId === "row-1");
    const row2Slots = params.slots.filter((s) => s.groupId === "row-2");
    expect(Math.abs(row1Slots[0].y - row1Slots[1].y)).toBeLessThan(1);
    expect(row2Slots[0].y).toBeGreaterThan(row1Slots[0].y);
  });

  it("禁用分件装配（CONTEXT:581）", () => {
    const { params } = convertSimpleSteppedToStepped(createSimpleParams());
    expect(params.enableSplitAssembly).toBe(false);
    expect(params.enableSplitRecess).toBe(false);
    expect(params.enableSplitLocators).toBe(false);
  });
});
