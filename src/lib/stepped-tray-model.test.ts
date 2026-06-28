import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import {
  calculateSteppedTrayDimensions,
  createSteppedSplitParts,
  createSteppedTrayModel,
} from "@/lib/stepped-tray-model";

const { measureBoundingBox, measureVolume } = measurements;

function createParams(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    spacing: 5,
    holeDepth: 2,
    groups: [
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "low",
        name: "低组",
        bottomHeight: 2,
      },
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "high",
        name: "高组",
        color: "#3b82f6",
        bottomHeight: 12,
      },
    ],
    activeGroupId: "low",
    slots: [
      {
        id: "slot-low",
        groupId: "low",
        x: -10,
        y: 0,
        width: 25,
        height: 25,
        rotation: 0,
        shape: "circle",
      },
      {
        id: "slot-high",
        groupId: "high",
        x: 35,
        y: 8,
        width: 40,
        height: 40,
        rotation: 0,
        shape: "circle",
      },
    ],
  };
}

describe("stepped tray model", { timeout: 15000 }, () => {
  it("returns a thin placeholder body when slots or groups are missing", () => {
    const model = createSteppedTrayModel({
      ...STEPPED_LAYOUT_DEFAULTS,
      slots: [],
    });

    const [[minX, minY, minZ], [maxX, maxY, maxZ]] = measureBoundingBox(model);
    expect(maxX - minX).toBeGreaterThan(0);
    expect(maxY - minY).toBeGreaterThan(0);
    expect(maxZ - minZ).toBeCloseTo(0.1, 5);
  });

  it("derives dimensions from the occupied slot bounds and clamps minimum group height", () => {
    const lowOnlyParams: SteppedLayoutParams = {
      ...createParams(),
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "low",
          name: "低组",
          bottomHeight: 2,
        },
      ],
      slots: [
        {
          id: "slot-low",
          groupId: "low",
          x: -10,
          y: 0,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
      ],
    };

    expect(calculateSteppedTrayDimensions(lowOnlyParams)).toEqual({
      width: 36,
      depth: 36,
      height: 3,
    });
  });

  it("keeps positive volume and removes more material when holes get deeper", () => {
    const shallowModel = createSteppedTrayModel({
      ...createParams(),
      holeDepth: 1,
    });
    const deepModel = createSteppedTrayModel({
      ...createParams(),
      holeDepth: 6,
    });

    const shallowVolume = measureVolume(shallowModel);
    const deepVolume = measureVolume(deepModel);

    expect(shallowVolume).toBeGreaterThan(0);
    expect(deepVolume).toBeGreaterThan(0);
    expect(deepVolume).toBeLessThan(shallowVolume);
  });

  it("creates one split part per group with connector sockets", () => {
    const parts = createSteppedSplitParts(createParams());

    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({
      filenameLabel: "part_01_low",
      label: "低组",
      fromHeight: 0,
      toHeight: 3,
    });
    expect(parts[1]).toMatchObject({
      filenameLabel: "part_02_high",
      label: "高组",
      fromHeight: 0,
      toHeight: 12,
    });
    expect(parts[0].connectorCount).toBeGreaterThan(0);
    expect(measureVolume(parts[0].geometry)).toBeGreaterThan(0);
    expect(measureVolume(parts[1].geometry)).toBeGreaterThan(0);
  });

  it("cuts assembly grooves at different-height group interfaces", () => {
    const groovedParts = createSteppedSplitParts(createParams());
    const plainParts = createSteppedSplitParts(createParams(), {
      interfaceGrooveDepth: 0,
    });

    expect(groovedParts).toHaveLength(plainParts.length);
    expect(measureVolume(groovedParts[0].geometry)).toBeLessThan(
      measureVolume(plainParts[0].geometry),
    );
    expect(measureVolume(groovedParts[1].geometry)).toBeLessThan(
      measureVolume(plainParts[1].geometry),
    );
  });

  it("keeps same-height groups as separate split parts", () => {
    const parts = createSteppedSplitParts({
      ...createParams(),
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "left",
          name: "左组",
          bottomHeight: 10,
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "right",
          name: "右组",
          color: "#3b82f6",
          bottomHeight: 10,
        },
      ],
      slots: [
        {
          id: "slot-left",
          groupId: "left",
          x: -35,
          y: 0,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-right",
          groupId: "right",
          x: 35,
          y: 0,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
      ],
    });

    expect(parts.map((part) => part.label)).toEqual(["左组", "右组"]);
    expect(parts.map((part) => part.toHeight)).toEqual([10, 10]);
  });

  it("does not let same-height horizontal groups cut each other's slot holes", () => {
    const parts = createSteppedSplitParts({
      ...createParams(),
      spacing: 12,
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "left",
          name: "左组",
          bottomHeight: 10,
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "right",
          name: "右组",
          color: "#3b82f6",
          bottomHeight: 10,
        },
      ],
      slots: [
        {
          id: "slot-left",
          groupId: "left",
          x: -18,
          y: 0,
          width: 30,
          height: 30,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-right",
          groupId: "right",
          x: 18,
          y: 0,
          width: 30,
          height: 30,
          rotation: 0,
          shape: "circle",
        },
      ],
    }, {
      enabled: false,
      interfaceGrooveDepth: 0,
    });

    expect(parts.map((part) => part.label)).toEqual(["左组", "右组"]);
    const leftVolume = measureVolume(parts[0].geometry);
    const rightVolume = measureVolume(parts[1].geometry);
    expect(leftVolume).toBeGreaterThan(0);
    expect(rightVolume).toBeGreaterThan(0);
    expect(Math.abs(leftVolume - rightVolume) / leftVolume).toBeLessThan(0.03);
  });

  it("splits a higher group's assembly groove across same-height support groups", () => {
    const params: SteppedLayoutParams = {
      ...createParams(),
      spacing: 12,
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "left",
          name: "左组",
          bottomHeight: 6,
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "right",
          name: "右组",
          color: "#3b82f6",
          bottomHeight: 6,
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "high",
          name: "高组",
          color: "#22c55e",
          bottomHeight: 14,
        },
      ],
      slots: [
        {
          id: "slot-left",
          groupId: "left",
          x: -25,
          y: 0,
          width: 30,
          height: 30,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-right",
          groupId: "right",
          x: 25,
          y: 0,
          width: 30,
          height: 30,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-high",
          groupId: "high",
          x: 0,
          y: 0,
          width: 32,
          height: 32,
          rotation: 0,
          shape: "circle",
        },
      ],
    };
    const groovedParts = createSteppedSplitParts(params, { enabled: false });
    const plainParts = createSteppedSplitParts(params, {
      enabled: false,
      interfaceGrooveDepth: 0,
    });
    const leftReduction =
      measureVolume(plainParts[0].geometry) -
      measureVolume(groovedParts[0].geometry);
    const rightReduction =
      measureVolume(plainParts[1].geometry) -
      measureVolume(groovedParts[1].geometry);

    expect(leftReduction).toBeGreaterThan(0);
    expect(rightReduction).toBeGreaterThan(0);
    expect(Math.abs(leftReduction - rightReduction) / leftReduction).toBeLessThan(
      0.08,
    );
  });
});
