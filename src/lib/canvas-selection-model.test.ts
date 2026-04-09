import { describe, expect, it } from "vitest";
import {
  collectCanvasSelection,
  getCanvasSelectionBoxRect,
  sanitizeCanvasSelectedIds,
  shouldApplyCanvasSelectionBox,
} from "@/lib/canvas-selection-model";

describe("canvas selection model", () => {
  it("filters selected ids that are no longer present", () => {
    const selectedIds = new Set(["slot-a", "slot-b", "slot-c"]);
    const slots = [{ id: "slot-a" }, { id: "slot-c" }];

    expect(Array.from(sanitizeCanvasSelectedIds(selectedIds, slots))).toEqual([
      "slot-a",
      "slot-c",
    ]);
  });

  it("builds a rectangle and collects projected slots inside it", () => {
    const selectionRect = getCanvasSelectionBoxRect({
      start: { x: 10, y: 20 },
      current: { x: 50, y: 70 },
    });

    expect(selectionRect).toEqual({
      left: 10,
      top: 20,
      right: 50,
      bottom: 70,
      width: 40,
      height: 50,
    });
    expect(shouldApplyCanvasSelectionBox(selectionRect)).toBe(true);

    const selectedIds = collectCanvasSelection({
      slots: [{ id: "slot-a" }, { id: "slot-b" }, { id: "slot-c" }],
      selectionRect,
      initialSelection: new Set(["slot-z"]),
      projectSlotToScreen: (slot) =>
        ({
          "slot-a": { x: 25, y: 35 },
          "slot-b": { x: 51, y: 35 },
          "slot-c": { x: 30, y: 68 },
        })[slot.id] ?? null,
    });

    expect(Array.from(selectedIds)).toEqual(["slot-z", "slot-a", "slot-c"]);
  });
});
