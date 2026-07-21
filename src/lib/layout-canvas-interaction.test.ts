import { describe, expect, it } from "vitest";
import {
  buildLayoutCanvasDragUpdates,
  resolveLayoutCanvasDragStart,
} from "@/lib/layout-canvas-interaction";
import type { LayoutEditorSlot } from "@/viewports/layout-editor/types";

function createSlot(id: string, x: number, y: number): LayoutEditorSlot {
  return {
    id,
    x,
    y,
    shape: "circle",
    width: 25,
    height: 25,
    rotation: 0,
  };
}

describe("layout canvas interaction", () => {
  it("resolves scoped drag origins from selection and slot lookup", () => {
    const slotById = new Map<string, LayoutEditorSlot>([
      ["slot-1", createSlot("slot-1", 10, 20)],
      ["slot-2", createSlot("slot-2", 30, 40)],
    ]);

    const dragStart = resolveLayoutCanvasDragStart({
      draggingId: "slot-1",
      selectedIds: ["slot-1", "slot-2"],
      slotById,
      slotMoveScopeResolver: () => ["slot-2", "missing"],
    });

    expect(dragStart).toEqual({
      draggingId: "slot-1",
      origins: new Map([["slot-2", { x: 30, y: 40 }]]),
    });
    expect(
      resolveLayoutCanvasDragStart({
        draggingId: "missing",
        selectedIds: ["missing"],
        slotById,
      }),
    ).toBeNull();
  });

  it("builds live drag updates from a final dragging position", () => {
    expect(
      buildLayoutCanvasDragUpdates({
        draggingId: "slot-1",
        dragOrigins: new Map([
          ["slot-1", { x: 10, y: 20 }],
          ["slot-2", { x: 30, y: 40 }],
        ]),
        finalDraggingPosition: { x: 15, y: 17 },
      }),
    ).toEqual([
      { id: "slot-1", x: 15, y: 17 },
      { id: "slot-2", x: 35, y: 37 },
    ]);
  });

});
