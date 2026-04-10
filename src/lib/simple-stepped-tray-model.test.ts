import { describe, expect, it } from "vitest";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import {
  calculateSimpleSteppedTrayDimensions,
  calculateSimpleSteppedTrayVolume,
} from "@/lib/simple-stepped-tray-model";

function createSimpleSteppedParams() {
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
    holeDepth: 3,
    rows: [
      { id: "row-1", name: "前排", slotIds: ["slot-1", "slot-2"] },
      { id: "row-2", name: "后排", slotIds: ["slot-3"] },
    ],
    slots: [
      {
        id: "slot-1",
        rowId: "row-1",
        shape: "circle" as const,
        diameter: 25,
        x: -15,
        y: 0,
      },
      {
        id: "slot-2",
        rowId: "row-1",
        shape: "circle" as const,
        diameter: 32,
        x: 20,
        y: 0,
      },
      {
        id: "slot-3",
        rowId: "row-2",
        shape: "circle" as const,
        diameter: 40,
        x: 0,
        y: 3,
      },
    ],
  };
}

describe("simple stepped tray model", () => {
  it("reports tray dimensions from the derived simple stepped layout", () => {
    const dimensions = calculateSimpleSteppedTrayDimensions(
      createSimpleSteppedParams(),
    );

    expect(dimensions.width).toBeCloseTo(79.8, 5);
    expect(dimensions.depth).toBeCloseTo(110.8, 5);
    expect(dimensions.height).toBe(10);
  });

  it("produces positive volume and removes more material when holes get deeper", () => {
    const shallowParams = {
      ...createSimpleSteppedParams(),
      holeDepth: 1,
    };
    const deepParams = {
      ...createSimpleSteppedParams(),
      holeDepth: 3,
    };

    const shallowVolume = calculateSimpleSteppedTrayVolume(shallowParams);
    const deepVolume = calculateSimpleSteppedTrayVolume(deepParams);
    const outerBoxVolume =
      79.8 * 110.8 * calculateSimpleSteppedTrayDimensions(deepParams).height;

    expect(shallowVolume).toBeGreaterThan(0);
    expect(deepVolume).toBeGreaterThan(0);
    expect(deepVolume).toBeLessThan(shallowVolume);
    expect(deepVolume).toBeLessThan(outerBoxVolume);
  });
});
