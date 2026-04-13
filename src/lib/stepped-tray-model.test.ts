import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import {
  calculateSteppedTrayDimensions,
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

describe("stepped tray model", () => {
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
});
