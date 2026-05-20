import { describe, expect, it } from "vitest";
import {
  applyFreeSlotUpdates,
  duplicateFreeSlots,
  insertFreeSlots,
  removeFreeSlot,
  trimFreeSlotBaseplate,
  updateFreeSlotPosition,
  updateFreeSlotRotation,
} from "@/lib/free-slot-editing";
import type { IdFactory } from "@/lib/model-ports";

interface TestSlot {
  id: string;
  x: number;
  y: number;
  rotation: number;
  groupId?: string;
}

interface TestParams {
  trayWidth: number;
  trayDepth: number;
  slots: TestSlot[];
}

function createIdFactory(...ids: string[]): IdFactory {
  let index = 0;
  return {
    createId: () => ids[index++] ?? `generated-${index}`,
  };
}

function createParams(): TestParams {
  return {
    trayWidth: 200,
    trayDepth: 160,
    slots: [{ id: "slot-1", x: 20, y: 30, rotation: 0, groupId: "group-a" }],
  };
}

describe("free slot editing", () => {
  it("updates and removes slots by id", () => {
    const moved = updateFreeSlotPosition(createParams(), "slot-1", 40, 50);
    const rotated = updateFreeSlotRotation(moved, "slot-1", 90);
    const applied = applyFreeSlotUpdates(rotated, [
      { id: "slot-1", x: 60, y: 70 },
    ]);
    const removed = removeFreeSlot(applied, "slot-1");

    expect(applied.slots[0]).toMatchObject({
      id: "slot-1",
      x: 60,
      y: 70,
      rotation: 90,
      groupId: "group-a",
    });
    expect(removed.slots).toEqual([]);
  });

  it("inserts, duplicates, and recenters slots while preserving metadata", () => {
    const inserted = insertFreeSlots<TestSlot, TestParams, Omit<TestSlot, "id">>(
      createParams(),
      createIdFactory("slot-2"),
      [{ x: 80, y: 90, rotation: 15, groupId: "group-b" }],
      (source, id) => ({ ...source, id }),
    );
    const duplicated = duplicateFreeSlots(
      inserted,
      createIdFactory("copy-1"),
      ["slot-2"],
    );
    const trimmed = trimFreeSlotBaseplate(duplicated.params, {
      width: 120,
      depth: 90,
      minX: 20,
      maxX: 80,
      minY: 10,
      maxY: 60,
    });

    expect(inserted.slots[1]).toMatchObject({
      id: "slot-2",
      groupId: "group-b",
    });
    expect(duplicated.newIds).toEqual(["copy-1"]);
    expect(duplicated.params.slots.at(-1)).toMatchObject({
      id: "copy-1",
      x: 90,
      y: 80,
      groupId: "group-b",
    });
    expect(trimmed).toMatchObject({
      trayWidth: 120,
      trayDepth: 90,
      slots: [
        { id: "slot-1", x: 30, y: 40 },
        { id: "slot-2", x: 90, y: 100 },
        { id: "copy-1", x: 100, y: 90 },
      ],
    });
  });
});
