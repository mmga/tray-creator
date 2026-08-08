import { describe, expect, it } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { IdFactory } from "@/lib/model-ports";
import {
  addSteppedSlot,
  applySteppedSlotUpdates,
  duplicateSteppedSlots,
  insertSteppedSlots,
  removeSteppedSlot,
  trimSteppedBaseplate,
  updateSteppedLayoutParam,
  updateSteppedSlotPosition,
  updateSteppedSlotRotation,
} from "@/lib/stepped-layout-slot-actions";
import { ELLIPSE_SLOT_DEFINITIONS } from "@/lib/slot-definitions";

function createIdFactory(...ids: string[]): IdFactory {
  let index = 0;
  return {
    createId: () => ids[index++] ?? `generated-${index}`,
  };
}

function createParams() {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    trayWidth: 200,
    trayDepth: 160,
    slots: [
      {
        id: "slot-1",
        x: 100,
        y: 80,
        shape: "circle" as const,
        width: 25,
        height: 25,
        rotation: 0,
        groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
      },
    ],
  };
}

describe("stepped slot actions", () => {
  it("updates params and adds slots into the active group", () => {
    const updated = updateSteppedLayoutParam(
      STEPPED_LAYOUT_DEFAULTS,
      "spacing",
      8,
    );
    expect(updated.spacing).toBe(8);

    const added = addSteppedSlot(createParams(), createIdFactory("slot-2"), 25);
    expect(added.slots[1]).toMatchObject({
      id: "slot-2",
      x: 130.4,
      y: 80,
      groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    });
  });

  it("adds a shared ellipse definition with its complete geometry snapshot", () => {
    const preset = ELLIPSE_SLOT_DEFINITIONS[0];
    const added = addSteppedSlot(
      createParams(),
      createIdFactory("ellipse-1"),
      preset.width,
      preset.height,
      {
        slotDefinitionId: preset.id,
        outerOffset: preset.outerOffset,
        profileExponent: preset.profileExponent,
      },
    );

    const rotated = updateSteppedSlotRotation(added, "ellipse-1", 42);

    expect(rotated.slots[1]).toMatchObject({
      id: "ellipse-1",
      x: 147.9,
      y: 80,
      shape: "ellipse",
      width: preset.width,
      height: preset.height,
      rotation: 42,
      slotDefinitionId: preset.id,
      outerOffset: preset.outerOffset,
      profileExponent: preset.profileExponent,
      groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    });
  });

  it("updates, applies, rotates, and removes slots", () => {
    const moved = updateSteppedSlotPosition(createParams(), "slot-1", 40, 50);
    const rotated = updateSteppedSlotRotation(moved, "slot-1", 45);
    const applied = applySteppedSlotUpdates(rotated, [
      { id: "slot-1", x: 60, y: 70, rotation: 90 },
    ]);
    const removed = removeSteppedSlot(applied, "slot-1");

    expect(applied.slots[0]).toMatchObject({ x: 60, y: 70, rotation: 90 });
    expect(removed.slots).toEqual([]);
  });

  it("inserts, duplicates, and trims stepped slots", () => {
    const inserted = insertSteppedSlots(
      createParams(),
      createIdFactory("slot-2"),
      [
        {
          x: 30,
          y: 30,
          shape: "circle",
          width: 32,
          height: 32,
          rotation: 0,
        },
      ],
    );
    expect(inserted.slots[1]).toMatchObject({
      id: "slot-2",
      groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    });

    const duplicated = duplicateSteppedSlots(
      inserted,
      createIdFactory("copy-1"),
      ["slot-1"],
    );
    expect(duplicated.newIds).toEqual(["copy-1"]);
    expect(duplicated.params.slots.at(-1)).toMatchObject({
      id: "copy-1",
      x: 110,
      y: 70,
    });

    expect(
      trimSteppedBaseplate(inserted, {
        width: 120,
        depth: 90,
        minX: 20,
        maxX: 80,
        minY: 10,
        maxY: 60,
      }),
    ).toMatchObject({
      trayWidth: 120,
      trayDepth: 90,
      slots: [
        { id: "slot-1", x: 110, y: 90 },
        { id: "slot-2", x: 40, y: 40 },
      ],
    });
  });

  it("preserves ellipse snapshots when symmetry slots are inserted", () => {
    const preset = ELLIPSE_SLOT_DEFINITIONS[1];
    const inserted = insertSteppedSlots(
      createParams(),
      createIdFactory("ellipse-mirror"),
      [
        {
          x: 40,
          y: 50,
          shape: "ellipse",
          width: preset.width,
          height: preset.height,
          rotation: 35,
          slotDefinitionId: preset.id,
          outerOffset: preset.outerOffset,
          profileExponent: preset.profileExponent,
        },
      ],
    );

    expect(inserted.slots[1]).toMatchObject({
      id: "ellipse-mirror",
      shape: "ellipse",
      rotation: 35,
      slotDefinitionId: preset.id,
      outerOffset: preset.outerOffset,
      profileExponent: preset.profileExponent,
    });
  });
});
