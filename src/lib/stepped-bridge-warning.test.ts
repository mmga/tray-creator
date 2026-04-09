import { describe, expect, it } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { buildSteppedBridgeWarning } from "@/lib/stepped-bridge-warning";

describe("stepped bridge warning", () => {
  it("returns null when no group can be merged", () => {
    expect(
      buildSteppedBridgeWarning({
        ...STEPPED_LAYOUT_DEFAULTS,
        slots: [
          {
            id: "slot-1",
            x: 40,
            y: 40,
            shape: "circle",
            width: 25,
            height: 25,
            rotation: 0,
            groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
          },
        ],
      }),
    ).toBeNull();
  });

  it("uses higher-group context and group overrides when emitting warnings", () => {
    const lowGroup = {
      ...STEPPED_LAYOUT_DEFAULTS.groups[0],
      id: "low",
      name: "低层组",
      bottomHeight: 10,
      useGroupSmoothingRadius: true,
      groupSmoothingRadius: 6,
    };
    const highGroup = {
      ...STEPPED_LAYOUT_DEFAULTS.groups[0],
      id: "high",
      name: "高层组",
      bottomHeight: 20,
    };

    expect(
      buildSteppedBridgeWarning({
        ...STEPPED_LAYOUT_DEFAULTS,
        smoothingRadius: 0,
        groups: [lowGroup, highGroup],
        activeGroupId: lowGroup.id,
        slots: [
          {
            id: "low-1",
            x: 0,
            y: 0,
            shape: "circle",
            width: 25,
            height: 25,
            rotation: 0,
            groupId: lowGroup.id,
          },
          {
            id: "high-1",
            x: 39,
            y: 0,
            shape: "circle",
            width: 25,
            height: 25,
            rotation: 0,
            groupId: highGroup.id,
          },
          {
            id: "high-2",
            x: 78,
            y: 0,
            shape: "circle",
            width: 25,
            height: 25,
            rotation: 0,
            groupId: highGroup.id,
          },
        ],
      }),
    ).toEqual({
      groupId: "low",
      groupName: "低层组",
      separatedClusterCount: 3,
      mergedClusterCount: 1,
      effectiveBridgeGap: 6,
    });
  });
});
