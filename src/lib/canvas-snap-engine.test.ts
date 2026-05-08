import { describe, expect, it } from "vitest";
import { calculateCanvasDragSnap } from "@/lib/canvas-snap-engine";

describe("canvas snap engine", () => {
  it("returns null when the dragging slot or origin is missing", () => {
    expect(
      calculateCanvasDragSnap({
        draggingSlotId: "missing",
        slots: [],
        dragOrigins: new Map(),
        trayWidth: 100,
        trayDepth: 60,
        currentMouse: { x: 0, y: 0 },
        startMouse: { x: 0, y: 0 },
      }),
    ).toBeNull();
  });

  it("snaps to slot centers and tray center guides", () => {
    const slots = [
      {
        id: "drag",
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        rotation: 0,
        shape: "circle",
      },
      {
        id: "other",
        x: 20,
        y: 30,
        width: 20,
        height: 20,
        rotation: 0,
        shape: "circle",
      },
    ] as const;

    expect(
      calculateCanvasDragSnap({
        draggingSlotId: "drag",
        slots,
        dragOrigins: new Map([["drag", { x: 10, y: 10 }]]),
        trayWidth: 100,
        trayDepth: 60,
        currentMouse: { x: 9.6, y: -20 },
        startMouse: { x: 0, y: 0 },
      }),
    ).toEqual({
      finalX: 20,
      finalY: 30,
      guides: [
        { axis: "x", value: 20 },
        { axis: "y", value: 30 },
      ],
    });
  });

  it("snaps to aligned edges and skips targets outside the threshold", () => {
    const slots = [
      {
        id: "drag",
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        rotation: 0,
        shape: "circle",
      },
      {
        id: "other",
        x: 50,
        y: 40,
        width: 40,
        height: 20,
        rotation: 0,
        shape: "circle",
      },
    ] as const;

    expect(
      calculateCanvasDragSnap({
        draggingSlotId: "drag",
        slots,
        dragOrigins: new Map([["drag", { x: 10, y: 10 }]]),
        trayWidth: 100,
        trayDepth: 60,
        currentMouse: { x: 29.2, y: 0 },
        startMouse: { x: 0, y: 0 },
      }),
    ).toEqual({
      finalX: 40,
      finalY: 10,
      guides: [{ axis: "x", value: 29.8 }],
    });

    expect(
      calculateCanvasDragSnap({
        draggingSlotId: "drag",
        slots,
        dragOrigins: new Map([["drag", { x: 10, y: 10 }]]),
        trayWidth: 100,
        trayDepth: 60,
        currentMouse: { x: 20, y: 0 },
        startMouse: { x: 0, y: 0 },
      }),
    ).toEqual({
      finalX: 30,
      finalY: 10,
      guides: [],
    });
  });
});
