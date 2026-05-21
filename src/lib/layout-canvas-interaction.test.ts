import { describe, expect, it } from "vitest";
import {
  buildLayoutCanvasDragUpdates,
  calculateLayoutCanvasMinimumTrayBounds,
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

  it("calculates minimum tray bounds from row bands or effective baseplate", () => {
    expect(
      calculateLayoutCanvasMinimumTrayBounds({
        rowBands: [
          { id: "row-1", name: "A", x: 5, y: 10, width: 30, depth: 20, topHeight: 4 },
          { id: "row-2", name: "B", x: 0, y: 35, width: 40, depth: 15, topHeight: 8 },
        ],
        effectiveBaseplate: { width: 100, height: 80 },
      }),
    ).toEqual({ width: 40, depth: 40 });

    expect(
      calculateLayoutCanvasMinimumTrayBounds({
        rowBands: null,
        effectiveBaseplate: { width: 100, height: 80 },
      }),
    ).toEqual({ width: 100, depth: 80 });
  });
});
