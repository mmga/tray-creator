import { describe, expect, it } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import type { IdFactory } from "@/lib/model-ports";
import {
  addCustomSlot,
  applyCustomSlotUpdates,
  duplicateCustomSlots,
  insertCustomSlots,
  removeCustomSlot,
  trimCustomBaseplate,
  updateCustomLayoutParam,
  updateCustomSlotPosition,
  updateCustomSlotRotation,
} from "@/lib/custom-layout-actions";

function createIdFactory(...ids: string[]): IdFactory {
  let index = 0;
  return {
    createId: () => ids[index++] ?? `generated-${index}`,
  };
}

describe("custom layout actions", () => {
  it("keeps spacing and boundary spacing in sync when required", () => {
    const base = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      spacing: 5,
      boundarySpacing: 9,
      boundarySpacingIndependent: false,
    };

    expect(updateCustomLayoutParam(base, "spacing", 8)).toMatchObject({
      spacing: 8,
      boundarySpacing: 8,
    });

    expect(
      updateCustomLayoutParam(
        { ...base, boundarySpacingIndependent: true, boundarySpacing: 12 },
        "boundarySpacingIndependent",
        false,
      ),
    ).toMatchObject({
      boundarySpacingIndependent: false,
      boundarySpacing: 5,
    });
  });

  it("adds, removes, and updates custom slots", () => {
    const empty = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      trayWidth: 200,
      trayDepth: 160,
    };
    const withFirst = addCustomSlot(empty, createIdFactory("slot-1"), 25);
    const withSecond = addCustomSlot(withFirst, createIdFactory("slot-2"), 25);

    expect(withFirst.slots[0]).toMatchObject({
      id: "slot-1",
      x: 100,
      y: 80,
      shape: "circle",
      slotDefinitionId: "circle-25",
      slotWidth: 25.2,
      slotHeight: 25.2,
    });
    expect(withSecond.slots[1].x).toBeCloseTo(130.2, 5);

    const moved = updateCustomSlotPosition(withSecond, "slot-1", 20, 30);
    const rotated = updateCustomSlotRotation(moved, "slot-2", 45);
    const applied = applyCustomSlotUpdates(rotated, [
      { id: "slot-1", x: 40, y: 50, rotation: 90 },
    ]);
    const removed = removeCustomSlot(applied, "slot-2");

    expect(applied.slots[0]).toMatchObject({ x: 40, y: 50, rotation: 90 });
    expect(removed.slots.map((slot) => slot.id)).toEqual(["slot-1"]);
  });

  it("stores ellipse preset geometry on the slot instance", () => {
    const empty = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      trayWidth: 200,
      trayDepth: 160,
    };

    const withEllipse = addCustomSlot(
      empty,
      createIdFactory("ellipse-1"),
      60,
      35.5,
      {
        outerOffset: 0.4,
        profileExponent: 2.05,
      },
    );

    expect(withEllipse.slots[0]).toMatchObject({
      id: "ellipse-1",
      shape: "ellipse",
      width: 60,
      height: 35.5,
      slotDefinitionId: "ellipse-60x35.5",
      outerOffset: 0.4,
      profileExponent: 2.05,
    });
  });

  it("inserts and duplicates slots with generated ids", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      slots: [
        {
          id: "slot-1",
          x: 20,
          y: 30,
          shape: "ellipse" as const,
          width: 30,
          height: 20,
          rotation: 0,
          outerOffset: 0.45,
          profileExponent: 3.2,
        },
      ],
    };

    const inserted = insertCustomSlots(
      params,
      createIdFactory("slot-2", "slot-3"),
      [
        {
          x: 60,
          y: 70,
          shape: "ellipse",
          width: 30,
          height: 20,
          rotation: 15,
          outerOffset: 0.6,
          profileExponent: 3.4,
        },
        {
          x: 90,
          y: 100,
          shape: "circle",
          width: 32,
          height: 32,
          rotation: 0,
        },
      ],
    );

    expect(inserted.slots.slice(1)).toEqual([
      {
        id: "slot-2",
        x: 60,
        y: 70,
        shape: "ellipse",
        width: 30,
        height: 20,
        rotation: 15,
        outerOffset: 0.6,
        profileExponent: 3.4,
      },
      {
        id: "slot-3",
        x: 90,
        y: 100,
        shape: "circle",
        width: 32,
        height: 32,
        rotation: 0,
      },
    ]);

    const duplicated = duplicateCustomSlots(
      inserted,
      createIdFactory("copy-1"),
      ["slot-1"],
    );

    expect(duplicated.newIds).toEqual(["copy-1"]);
    expect(duplicated.params.slots.at(-1)).toMatchObject({
      id: "copy-1",
      x: 30,
      y: 20,
      outerOffset: 0.45,
      profileExponent: 3.2,
    });
  });

  it("trims the baseplate and recenters slots", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      trayWidth: 200,
      trayDepth: 160,
      slots: [
        {
          id: "slot-1",
          x: 30,
          y: 40,
          shape: "circle" as const,
          width: 25,
          height: 25,
          rotation: 0,
        },
      ],
    };

    expect(
      trimCustomBaseplate(params, {
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
      slots: [{ id: "slot-1", x: 40, y: 50 }],
    });
  });
});
