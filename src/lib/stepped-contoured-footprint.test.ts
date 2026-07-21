import { describe, expect, it } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { constructSteppedContouredFootprints } from "@/lib/stepped-contoured-footprint";
import type { SteppedLayoutParams } from "@/types/custom-tray";

function createParams(): SteppedLayoutParams {
  const defaultGroup = STEPPED_LAYOUT_DEFAULTS.groups[0];
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    smoothingRadius: 0,
    disconnectDistance: 0,
    groups: [
      { ...defaultGroup, id: "low-a", name: "低 A", bottomHeight: 10 },
      { ...defaultGroup, id: "low-b", name: "低 B", bottomHeight: 10 },
      { ...defaultGroup, id: "high", name: "高", bottomHeight: 20 },
    ],
    slots: [
      {
        id: "slot-low-a",
        groupId: "low-a",
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        rotation: 0,
        shape: "circle",
      },
      {
        id: "slot-low-b",
        groupId: "low-b",
        x: 100,
        y: 0,
        width: 20,
        height: 20,
        rotation: 0,
        shape: "circle",
      },
      {
        id: "slot-high",
        groupId: "high",
        x: 200,
        y: 0,
        width: 20,
        height: 20,
        rotation: 0,
        shape: "circle",
      },
    ],
  };
}

describe("stepped contoured footprint adapter", () => {
  it("为低高度组纳入更高槽位，但排除其他同高度组", () => {
    const construction = constructSteppedContouredFootprints(createParams());
    const slotsByGroup = new Map(construction.groups.map((group) => [
      group.groupId,
      group.footprint.bodies.flatMap((body) => body.slotIds),
    ]));

    expect(slotsByGroup.get("low-a")).toEqual(["slot-high", "slot-low-a"]);
    expect(slotsByGroup.get("low-b")).toEqual(["slot-high", "slot-low-b"]);
    expect(slotsByGroup.get("high")).toEqual(["slot-high"]);
  });

  it("保留托盘编辑坐标，不在 Adapter 内居中", () => {
    const construction = constructSteppedContouredFootprints(createParams());
    const high = construction.groups.find((group) => group.groupId === "high");

    expect(high?.footprint.bounds?.minX).toBeGreaterThan(180);
    expect(high?.footprint.bounds?.maxX).toBeGreaterThan(200);
  });
});
