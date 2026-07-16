import { describe, expect, it } from "vitest";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import { deriveSimpleSteppedLayout } from "@/lib/simple-stepped-layout";
import { insertSimpleSteppedSlots } from "@/lib/simple-stepped-slot-actions";
import type { IdFactory } from "@/lib/model-ports";
import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";

const fixedIdFactory: IdFactory = {
  createId: () => "mirrored-slot",
};

describe("simple stepped slot actions", () => {
  it("inserts a mirrored canvas slot back into its owning row", () => {
    const params: SimpleSteppedLayoutParams = {
      ...SIMPLE_STEPPED_LAYOUT_DEFAULTS,
      rows: [{ id: "row-a", name: "前排", slotIds: ["source-slot"] }],
      slots: [{
        id: "source-slot",
        rowId: "row-a",
        shape: "circle",
        diameter: 32,
        x: -12,
        y: 2,
      }],
    };
    const derived = deriveSimpleSteppedLayout(params);
    const row = derived.activeRows[0];

    const result = insertSimpleSteppedSlots(params, fixedIdFactory, [{
      rowId: "row-a",
      x: derived.trayWidth - row.slots[0].globalX,
      y: row.slots[0].globalY,
      shape: "circle",
      width: 32,
      height: 32,
      rotation: 0,
    }]);

    expect(result.slots).toHaveLength(2);
    expect(result.slots[1]).toMatchObject({
      id: "mirrored-slot",
      rowId: "row-a",
      diameter: 32,
      y: 2,
    });
  });

  it("ignores inserts whose owning row no longer exists", () => {
    const result = insertSimpleSteppedSlots(
      SIMPLE_STEPPED_LAYOUT_DEFAULTS,
      fixedIdFactory,
      [{
        rowId: "missing-row",
        x: 20,
        y: 20,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
      }],
    );

    expect(result).toBe(SIMPLE_STEPPED_LAYOUT_DEFAULTS);
  });
});
