import { describe, expect, it } from "vitest";
import { GROUP_COLORS, STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { IdFactory } from "@/lib/model-ports";
import {
  addSteppedGroup,
  moveSteppedSlotsToGroup,
  removeSteppedGroup,
  reorderSteppedGroups,
  setSteppedActiveGroup,
  updateSteppedGroupDisconnectDistance,
  updateSteppedGroupDisconnectOverride,
  updateSteppedGroupHeight,
  updateSteppedGroupSmoothingOverride,
  updateSteppedGroupSmoothingRadius,
} from "@/lib/stepped-layout-group-actions";

function createIdFactory(...ids: string[]): IdFactory {
  let index = 0;
  return {
    createId: () => ids[index++] ?? `generated-${index}`,
  };
}

function createParams() {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    smoothingRadius: 70,
    disconnectDistance: 12,
    groups: [
      { ...STEPPED_LAYOUT_DEFAULTS.groups[0] },
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "group-2",
        name: "组 2",
        color: GROUP_COLORS[1],
        bottomHeight: 18,
      },
    ],
    activeGroupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    slots: [
      {
        id: "slot-1",
        x: 20,
        y: 20,
        shape: "circle" as const,
        width: 25,
        height: 25,
        rotation: 0,
        groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
      },
      {
        id: "slot-2",
        x: 60,
        y: 20,
        shape: "circle" as const,
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "group-2",
      },
    ],
  };
}

describe("stepped group actions", () => {
  it("adds a group with copied structure defaults and the next available color", () => {
    const next = addSteppedGroup(createParams(), createIdFactory("group-3"));
    const added = next.groups.at(-1);

    expect(added).toMatchObject({
      id: "group-3",
      name: "组 3",
      color: GROUP_COLORS[2],
      bottomHeight: 23,
      useGroupSmoothingRadius: false,
      groupSmoothingRadius: 70,
      useGroupDisconnectDistance: false,
      groupDisconnectDistance: 12,
    });
    expect(next.activeGroupId).toBe("group-3");
  });

  it("removes groups, their slots, and protects the last remaining group", () => {
    const singleGroup = removeSteppedGroup(STEPPED_LAYOUT_DEFAULTS, "missing");
    expect(singleGroup).toBe(STEPPED_LAYOUT_DEFAULTS);

    const removed = removeSteppedGroup(createParams(), "group-2");
    expect(removed.groups.map((group) => group.id)).toEqual([
      STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    ]);
    expect(removed.slots.map((slot) => slot.id)).toEqual(["slot-1"]);
    expect(removed.activeGroupId).toBe(STEPPED_LAYOUT_DEFAULTS.groups[0].id);
  });

  it("updates group properties, selection target, and ordering", () => {
    const base = createParams();
    const updated = updateSteppedGroupDisconnectDistance(
      updateSteppedGroupDisconnectOverride(
        updateSteppedGroupSmoothingRadius(
          updateSteppedGroupSmoothingOverride(
            updateSteppedGroupHeight(base, "group-2", 30),
            "group-2",
            true,
          ),
          "group-2",
          95,
        ),
        "group-2",
        true,
      ),
      "group-2",
      8,
    );
    const activated = setSteppedActiveGroup(updated, "group-2");
    const moved = moveSteppedSlotsToGroup(activated, ["slot-1"], "group-2");
    const reordered = reorderSteppedGroups(moved, 1, 0);

    expect(updated.groups[1]).toMatchObject({
      bottomHeight: 30,
      useGroupSmoothingRadius: true,
      groupSmoothingRadius: 95,
      useGroupDisconnectDistance: true,
      groupDisconnectDistance: 8,
    });
    expect(activated.activeGroupId).toBe("group-2");
    expect(moved.slots[0].groupId).toBe("group-2");
    expect(reordered.groups.map((group) => group.id)).toEqual([
      "group-2",
      STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    ]);
    expect(reorderSteppedGroups(moved, -1, 0)).toBe(moved);
  });
});
