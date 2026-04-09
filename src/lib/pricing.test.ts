import { describe, expect, it } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SlotGroup, SteppedLayoutParams } from "@/types/custom-tray";
import {
  calculateCustomPrice,
  calculateGridPrice,
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
    expect(calculateCustomPrice(CUSTOM_LAYOUT_DEFAULTS, 1000)).toBeCloseTo(
      0.2976,
      5,
    );
  });

  it("prices stepped layouts from footprint, estimated print time, and complexity", () => {
    const sampleA = getSteppedPricingBreakdown(createSampleA(), 142138.53892657714);
    const sampleB = getSteppedPricingBreakdown(createSampleB(), 140478.6680541103);
    const sampleC = getSteppedPricingBreakdown(createSampleC(), 227189.98033932867);

    expect(sampleA.effectiveWidth).toBe(236);
    expect(sampleA.effectiveDepth).toBe(109);
    expect(sampleA.estimatedWeight).toBeCloseTo(112, 5);
    expect(sampleA.estimatedPrintHours).toBeCloseTo(2 + 29 / 60, 2);
    expect(sampleA.complexityFee).toBeCloseTo(7, 5);
    expect(sampleA.price).toBe(39);
    expect(calculateSteppedPrice(createSampleA(), 142138.53892657714)).toBe(39);

    expect(sampleB.effectiveWidth).toBe(188);
    expect(sampleB.effectiveDepth).toBe(107);
    expect(sampleB.estimatedWeight).toBeCloseTo(108, 5);
    expect(sampleB.estimatedPrintHours).toBeCloseTo(2 + 27 / 60, 2);
    expect(sampleB.complexityFee).toBeCloseTo(7, 5);
    expect(sampleB.price).toBe(38);

    expect(sampleC.effectiveWidth).toBe(222);
    expect(sampleC.effectiveDepth).toBe(173);
    expect(sampleC.estimatedWeight).toBeCloseTo(192, 5);
    expect(sampleC.estimatedPrintHours).toBeCloseTo(4, 2);
    expect(sampleC.complexityFee).toBeCloseTo(28.1, 5);
    expect(sampleC.price).toBe(80);
  });
});
