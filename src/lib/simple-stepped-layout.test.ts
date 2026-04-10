import { describe, expect, it } from "vitest";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import {
  buildSimpleSteppedRowBands,
  calculateSimpleSteppedDimensions,
  calculateSimpleSteppedMinimumTraySize,
  clampSimpleSteppedSlotUpdates,
  deriveSimpleSteppedLayout,
  getSimpleSteppedEffectiveDiameter,
} from "@/lib/simple-stepped-layout";
import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";

function createSimpleSteppedParams(): SimpleSteppedLayoutParams {
  return {
    ...SIMPLE_STEPPED_LAYOUT_DEFAULTS,
    trayWidth: 70,
    trayDepth: 80,
    firstRowHeight: 6,
    stepHeight: 4,
    rowGap: 6,
    spacing: 5,
    outerMarginIndependent: true,
    outerMargin: 8,
    rows: [
      { id: "row-1", name: "前排", slotIds: ["slot-1", "slot-2"] },
      { id: "row-2", name: "后排", slotIds: ["slot-3"] },
    ],
    slots: [
      {
        id: "slot-1",
        rowId: "row-1",
        shape: "circle",
        diameter: 25,
        x: -15,
        y: 0,
      },
      {
        id: "slot-2",
        rowId: "row-1",
        shape: "circle",
        diameter: 32,
        x: 20,
        y: 0,
      },
      {
        id: "slot-3",
        rowId: "row-2",
        shape: "circle",
        diameter: 40,
        x: 0,
        y: 3,
      },
    ],
  };
}

describe("simple stepped layout", () => {
  it("derives stacked rows, row bands, and effective tray dimensions", () => {
    const params = createSimpleSteppedParams();

    expect(getSimpleSteppedEffectiveDiameter({ diameter: 25 })).toBe(25.2);
    expect(getSimpleSteppedEffectiveDiameter({ diameter: 32 })).toBe(32.4);

    const minimumSize = calculateSimpleSteppedMinimumTraySize(params);
    expect(minimumSize.width).toBeCloseTo(79.8, 5);
    expect(minimumSize.depth).toBeCloseTo(110.8, 5);

    const dimensions = calculateSimpleSteppedDimensions(params);
    expect(dimensions.width).toBeCloseTo(79.8, 5);
    expect(dimensions.depth).toBeCloseTo(110.8, 5);
    expect(dimensions.height).toBe(10);

    const derived = deriveSimpleSteppedLayout(params, "row-2");
    expect(derived.trayWidth).toBeCloseTo(79.8, 5);
    expect(derived.trayDepth).toBeCloseTo(110.8, 5);
    expect(derived.minimumTrayWidth).toBeCloseTo(79.8, 5);
    expect(derived.minimumTrayDepth).toBeCloseTo(110.8, 5);
    expect(derived.trayHeight).toBe(10);
    expect(derived.highestTopHeight).toBe(10);
    expect(derived.slotCount).toBe(3);

    expect(derived.activeRows[0]).toMatchObject({
      id: "row-1",
      depth: 48.4,
      topHeight: 6,
      extraHeight: 0,
    });
    expect(derived.activeRows[0]?.length).toBeCloseTo(79.8, 5);
    expect(derived.activeRows[0].slots[0]?.globalX).toBeCloseTo(20.6, 5);
    expect(derived.activeRows[0].slots[0]?.globalY).toBeCloseTo(24.2, 5);

    expect(derived.activeRows[1]).toMatchObject({
      id: "row-2",
      depth: 56.4,
      topHeight: 10,
      extraHeight: 4,
    });
    expect(derived.activeRows[1]?.length).toBeCloseTo(79.8, 5);
    expect(derived.activeRows[1].slots[0]?.globalX).toBeCloseTo(39.9, 5);
    expect(derived.activeRows[1].slots[0]?.globalY).toBeCloseTo(85.6, 5);

    expect(buildSimpleSteppedRowBands(params, "row-2")).toEqual(
      derived.rowBands,
    );
    expect(derived.rowBands[0]).toMatchObject({
      id: "row-1",
      x: 0,
      y: 0,
      depth: 48.4,
      isActive: false,
    });
    expect(derived.rowBands[0]?.width).toBeCloseTo(79.8, 5);
    expect(derived.rowBands[1]).toMatchObject({
      id: "row-2",
      x: 0,
      y: 54.4,
      depth: 56.4,
      topHeight: 10,
      isActive: true,
    });
    expect(derived.rowBands[1]?.width).toBeCloseTo(79.8, 5);
  });

  it("returns stored tray size and empty rows when no active rows exist", () => {
    const derived = deriveSimpleSteppedLayout(SIMPLE_STEPPED_LAYOUT_DEFAULTS);

    expect(derived).toEqual({
      trayWidth: SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayWidth,
      trayDepth: SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayDepth,
      minimumTrayWidth: 0,
      minimumTrayDepth: 0,
      trayHeight: 0,
      highestTopHeight: 0,
      slotCount: 0,
      activeRows: [],
      rowBands: [],
    });
  });

  it("clamps canvas slot updates to the build envelope and row depth", () => {
    const params = createSimpleSteppedParams();

    expect(
      clampSimpleSteppedSlotUpdates(
        params,
        [
          { id: "slot-1", x: 100, y: 100 },
          { id: "slot-3", x: -100, y: 5 },
          { id: "missing", x: 1, y: 1 },
          { id: "slot-2", x: Number.NaN, y: 0 },
        ],
        100,
      ),
    ).toEqual([
      { id: "slot-1", x: 29.4, y: 3.5999999999999996 },
      { id: "slot-3", x: -21.8, y: 0 },
    ]);
  });
});
