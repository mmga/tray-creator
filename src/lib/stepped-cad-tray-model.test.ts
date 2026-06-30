import { describe, expect, it } from "vitest";
import { measureBoundingBox } from "@jscad/modeling/src/measurements";
import { measureVolume } from "@jscad/modeling/src/measurements";
import {
  createSteppedCadSplitParts,
  createSteppedCadTrayModel,
} from "@/lib/stepped-cad-tray-model";
import type { SteppedLayoutParams } from "@/types/custom-tray";

function createParams(): SteppedLayoutParams {
  return {
    trayWidth: 260,
    trayDepth: 260,
    slots: [
      {
        id: "slot-low",
        x: 80,
        y: 120,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "group-low",
      },
      {
        id: "slot-high",
        x: 140,
        y: 120,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "group-high",
      },
    ],
    groups: [
      {
        id: "group-low",
        name: "低层",
        color: "#22c55e",
        bottomHeight: 10,
        useGroupSmoothingRadius: false,
        groupSmoothingRadius: 60,
        useGroupDisconnectDistance: false,
        groupDisconnectDistance: 0,
      },
      {
        id: "group-high",
        name: "高层",
        color: "#3b82f6",
        bottomHeight: 20,
        useGroupSmoothingRadius: false,
        groupSmoothingRadius: 60,
        useGroupDisconnectDistance: false,
        groupDisconnectDistance: 0,
      },
    ],
    activeGroupId: "group-low",
    spacing: 5,
    holeDepth: 3,
    splitGrooveDepth: 2,
    smoothingRadius: 60,
    disconnectDistance: 0,
    enableBaseHole: false,
    baseHoleSize: "25",
  };
}

describe("stepped cad tray model", () => {
  it("builds a non-empty main tray", () => {
    const geometry = createSteppedCadTrayModel(createParams());
    expect(measureVolume(geometry)).toBeGreaterThan(0);
  });

  it("builds one split part per isolated split unit", () => {
    const parts = createSteppedCadSplitParts(createParams());
    expect(parts).toHaveLength(2);
    expect(parts.map((part) => part.label)).toEqual(["低层", "高层"]);
    expect(parts.map((part) => part.fromHeight)).toEqual([0, 10]);
    expect(parts.map((part) => part.toHeight)).toEqual([10, 20]);
  });

  it("builds inset assembly pockets on lower parts and 2mm tenons on upper parts", () => {
    const params = createParams();
    const plainParts = createSteppedCadSplitParts(params, 0);
    const groovedParts = createSteppedCadSplitParts(params, 2);

    expect(plainParts).toHaveLength(1);
    expect(groovedParts).toHaveLength(2);

    expect(measureVolume(groovedParts[0].geometry)).toBeLessThan(
      measureVolume(plainParts[0].geometry),
    );

    const [[, , groovedHighMinZ]] = measureBoundingBox(groovedParts[1].geometry);

    expect(groovedHighMinZ).toBeCloseTo(8, 3);
  });
});
