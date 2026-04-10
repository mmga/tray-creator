import { describe, expect, it } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SlotGroup, SteppedLayoutParams } from "@/types/custom-tray";
import {
  calculateCustomPrice,
  calculateGridPrice,
  calculateSimpleSteppedPrice,
  calculateSteppedPrice,
  calculateWeight,
  getSteppedPricingBreakdown,
} from "@/lib/pricing";

function createGroup(
  id: string,
  bottomHeight: number,
  overrides: Partial<SlotGroup> = {},
): SlotGroup {
  return {
    id,
    name: id,
    color: "#ef4444",
    bottomHeight,
    useGroupSmoothingRadius: false,
    groupSmoothingRadius: 15,
    useGroupDisconnectDistance: false,
    groupDisconnectDistance: 0,
    ...overrides,
  };
}

function createSlot(
  id: string,
  x: number,
  y: number,
  width: number,
  groupId: string,
) {
  return {
    id,
    x,
    y,
    shape: "circle" as const,
    width,
    height: width,
    rotation: 0,
    groupId,
  };
}

function createSampleA(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    slots: [
      createSlot("a-1", 33.4, 116.8, 32, "g15"),
      createSlot("a-2", 71.2, 128, 32, "g15"),
      createSlot("a-3", 109.8, 134.8, 32, "g5"),
      createSlot("a-4", 42, 158, 40, "g25"),
      createSlot("a-5", 130, 179.4, 40, "g25b"),
      createSlot("a-6", 90.2, 167, 32, "g35"),
      createSlot("a-7", 226.6, 116.8, 32, "g15"),
      createSlot("a-8", 188.8, 128, 32, "g15"),
      createSlot("a-9", 150.2, 134.8, 32, "g5"),
      createSlot("a-10", 218, 158, 40, "g25"),
      createSlot("a-11", 169.8, 167, 32, "g35"),
    ],
    groups: [
      createGroup("g5", 5, { groupSmoothingRadius: 7, groupDisconnectDistance: 10 }),
      createGroup("g15", 15, { groupSmoothingRadius: 7, groupDisconnectDistance: 10 }),
      createGroup("g25", 25, { groupSmoothingRadius: 7, groupDisconnectDistance: 10 }),
      createGroup("g25b", 25, { groupSmoothingRadius: 7, groupDisconnectDistance: 10 }),
      createGroup("g35", 35, { groupSmoothingRadius: 7, groupDisconnectDistance: 10 }),
    ],
    activeGroupId: "g25b",
    spacing: 5,
    holeDepth: 3,
    smoothingRadius: 7,
    disconnectDistance: 10,
  };
}

function createSampleB(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    slots: [
      createSlot("b-1", 93.6, 131, 32, "g5"),
      createSlot("b-2", 57, 123.2, 32, "g15"),
      createSlot("b-3", 57, 161.8, 32, "g30"),
      createSlot("b-4", 91.8, 179.4, 32, "g40"),
      createSlot("b-5", 130, 144.6, 32, "g5"),
      createSlot("b-6", 129.2, 187.8, 32, "g50"),
      createSlot("b-7", 166.4, 131, 32, "g5"),
      createSlot("b-8", 203, 123.2, 32, "g15"),
      createSlot("b-9", 203, 161.8, 32, "g30"),
      createSlot("b-10", 168.2, 179.4, 32, "g40"),
    ],
    groups: [
      createGroup("g5", 5),
      createGroup("g15", 15),
      createGroup("g30", 30),
      createGroup("g40", 40),
      createGroup("g50", 50),
    ],
    activeGroupId: "g15",
    spacing: 5,
    holeDepth: 3,
    smoothingRadius: 15,
    disconnectDistance: 0,
  };
}

function createSampleC(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    slots: [
      createSlot("c-1", 93.6, 131, 32, "g5"),
      createSlot("c-2", 57, 123.2, 32, "g15"),
      createSlot("c-3", 57, 161.8, 32, "g30"),
      createSlot("c-4", 91.8, 179.4, 32, "g40"),
      createSlot("c-5", 130, 144.6, 32, "g5"),
      createSlot("c-6", 129.2, 187.8, 32, "g50"),
      createSlot("c-7", 166.4, 131, 32, "g5"),
      createSlot("c-8", 203, 123.2, 32, "g15"),
      createSlot("c-9", 203, 161.8, 32, "g30"),
      createSlot("c-10", 168.2, 179.4, 32, "g40"),
      createSlot("c-11", 54.2, 213.6, 60, "g25"),
      createSlot("c-12", 205.8, 213.6, 60, "g25"),
      createSlot("c-13", 129.2, 239.6, 60, "g25"),
    ],
    groups: [
      createGroup("g5", 5),
      createGroup("g15", 15),
      createGroup("g25", 25),
      createGroup("g30", 30),
      createGroup("g40", 40),
      createGroup("g50", 50),
    ],
    activeGroupId: "g25",
    spacing: 5,
    holeDepth: 3,
    smoothingRadius: 15,
    disconnectDistance: 0,
  };
}

describe("pricing", () => {
  it("calculates printed weight from model volume", () => {
    expect(calculateWeight(0)).toBe(0);
    expect(calculateWeight(1000)).toBeCloseTo(0.744, 5);
  });

  it("prices grid layouts by slot count, diameter tier and base holes", () => {
    expect(
      calculateGridPrice({
        ...DEFAULT_TRAY_PARAMS,
        rows: 2,
        columns: 3,
        holeDiameter: 25,
        enableBaseHole: false,
      }),
    ).toBe(3);

    expect(
      calculateGridPrice({
        ...DEFAULT_TRAY_PARAMS,
        rows: 2,
        columns: 3,
        holeDiameter: 50,
        enableBaseHole: true,
      }),
    ).toBeCloseTo(9.6, 5);
  });

  it("returns zero for non-positive volume and scales custom prices from weight", () => {
    expect(calculateCustomPrice(CUSTOM_LAYOUT_DEFAULTS, 0)).toBe(0);
    expect(calculateSteppedPrice(STEPPED_LAYOUT_DEFAULTS, -1)).toBe(0);
    expect(
      calculateSimpleSteppedPrice(SIMPLE_STEPPED_LAYOUT_DEFAULTS, 0),
    ).toBe(0);
    expect(calculateCustomPrice(CUSTOM_LAYOUT_DEFAULTS, 1000)).toBeCloseTo(
      0.2976,
      5,
    );
    expect(
      calculateSimpleSteppedPrice(SIMPLE_STEPPED_LAYOUT_DEFAULTS, 1000),
    ).toBeCloseTo(0.2976, 5);
  });

  it("returns a zeroed stepped breakdown when no printable geometry exists", () => {
    const breakdown = getSteppedPricingBreakdown(STEPPED_LAYOUT_DEFAULTS, 120000);

    expect(breakdown.price).toBe(0);
    expect(breakdown.rawPrice).toBe(0);
    expect(breakdown.materialFee).toBe(0);
    expect(breakdown.printFee).toBe(0);
    expect(breakdown.footprintFee).toBe(0);
    expect(breakdown.complexityFee).toBe(0);
    expect(breakdown.estimatedWeight).toBe(0);
    expect(breakdown.estimatedPrintHours).toBe(0);
    expect(breakdown.materialDensityGPerCm3).toBeCloseTo(0.34, 5);
  });

  it("uses effective group overrides when determining stepped pricing complexity flags", () => {
    const params: SteppedLayoutParams = {
      ...STEPPED_LAYOUT_DEFAULTS,
      slots: [createSlot("slot-1", 120, 120, 32, "g-1")],
      groups: [
        createGroup("g-1", 10, {
          useGroupSmoothingRadius: true,
          groupSmoothingRadius: 14,
          useGroupDisconnectDistance: true,
          groupDisconnectDistance: 6,
        }),
      ],
      smoothingRadius: 7,
      disconnectDistance: 0,
      activeGroupId: "g-1",
    };

    const breakdown = getSteppedPricingBreakdown(params, 150000);

    expect(breakdown.hasWideSmoothing).toBe(true);
    expect(breakdown.hasDisconnectDistance).toBe(true);
    expect(breakdown.complexityFee).toBeCloseTo(4.5, 5);
  });

  it("prices stepped layouts from formula inputs and rounds the final quote", () => {
    const sampleA = getSteppedPricingBreakdown(createSampleA(), 318150.1025655966);
    const sampleB = getSteppedPricingBreakdown(createSampleB(), 316356.25431361876);
    const sampleC = getSteppedPricingBreakdown(createSampleC(), 609970.6591252618);

    expect(sampleA.effectiveWidth).toBe(236);
    expect(sampleA.effectiveDepth).toBe(109);
    expect(sampleA.materialDensityGPerCm3).toBeCloseTo(0.352, 5);
    expect(sampleA.estimatedWeight).toBeCloseTo(
      (318150.1025655966 / 1000) * sampleA.materialDensityGPerCm3,
      5,
    );
    expect(sampleA.estimatedPrintHours).toBeCloseTo(
      0.25 + sampleA.estimatedWeight / 50,
      5,
    );
    expect(sampleA.complexityFee).toBeCloseTo(7, 5);
    expect(sampleA.price).toBe(39);
    expect(calculateSteppedPrice(createSampleA(), 318150.1025655966)).toBe(39);
    expect(sampleA.rawPrice).toBeCloseTo(
      sampleA.baseFee +
        sampleA.materialFee +
        sampleA.printFee +
        sampleA.footprintFee +
        sampleA.complexityFee,
      5,
    );

    expect(sampleB.effectiveWidth).toBe(189);
    expect(sampleB.effectiveDepth).toBe(107);
    expect(sampleB.materialDensityGPerCm3).toBeCloseTo(0.34, 5);
    expect(sampleB.estimatedWeight).toBeCloseTo(
      (316356.25431361876 / 1000) * sampleB.materialDensityGPerCm3,
      5,
    );
    expect(sampleB.estimatedPrintHours).toBeCloseTo(
      0.25 + sampleB.estimatedWeight / 50 + 0.041,
      5,
    );
    expect(sampleB.complexityFee).toBeCloseTo(7, 5);
    expect(sampleB.price).toBe(38);
    expect(sampleB.rawPrice).toBeCloseTo(
      sampleB.baseFee +
        sampleB.materialFee +
        sampleB.printFee +
        sampleB.footprintFee +
        sampleB.complexityFee,
      5,
    );

    expect(sampleC.effectiveWidth).toBe(222);
    expect(sampleC.effectiveDepth).toBe(173);
    expect(sampleC.materialDensityGPerCm3).toBeCloseTo(0.316, 5);
    expect(sampleC.estimatedWeight).toBeCloseTo(
      (609970.6591252618 / 1000) * sampleC.materialDensityGPerCm3,
      5,
    );
    expect(sampleC.estimatedPrintHours).toBeCloseTo(
      0.25 + sampleC.estimatedWeight / 50 + 0.041 * 2 - 0.03 * 3,
      5,
    );
    expect(sampleC.complexityFee).toBeCloseTo(27.95, 5);
    expect(sampleC.price).toBe(80);
    expect(sampleC.rawPrice).toBeCloseTo(
      sampleC.baseFee +
        sampleC.materialFee +
        sampleC.printFee +
        sampleC.footprintFee +
        sampleC.complexityFee,
      5,
    );
  });
});
