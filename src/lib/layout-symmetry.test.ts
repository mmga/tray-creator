import { describe, expect, it } from "vitest";
import {
  buildMirrorInsertSlots,
  buildMirrorMoveUpdates,
  checkLayoutSymmetry,
  countOutOfBoundsSlots,
  getSelectionBounds,
  getSlotBounds,
  mirrorSlot,
  resolveMirrorAxis,
  roundToStep,
} from "@/lib/layout-symmetry";

const trayWidth = 100;
const trayDepth = 80;

const baseSlot = {
  id: "slot-1",
  x: 20,
  y: 25,
  shape: "ellipse" as const,
  width: 30,
  height: 20,
  rotation: 30,
};

describe("layout symmetry", () => {
  it("rounds values to the configured canvas step", () => {
    expect(roundToStep(10.11)).toBeCloseTo(10.2, 10);
    expect(roundToStep(10.09)).toBe(10);
  });

  it("computes slot and selection bounds with tolerance-aware rotation", () => {
    const bounds = getSlotBounds(baseSlot);
    expect(bounds.halfW).toBeGreaterThan(10);
    expect(bounds.halfH).toBeGreaterThan(10);

    const selectionBounds = getSelectionBounds([
      baseSlot,
      { ...baseSlot, id: "slot-2", x: 60, y: 45, rotation: 0 },
    ]);
    expect(selectionBounds).not.toBeNull();
    expect(selectionBounds?.minX).toBeLessThan(10);
    expect(selectionBounds?.maxX).toBeGreaterThan(70);
    expect(selectionBounds?.minY).toBeLessThan(15);
    expect(selectionBounds?.maxY).toBeGreaterThan(55);
  });

  it("resolves mirror axes from tray center or selection bounds", () => {
    expect(resolveMirrorAxis([], trayWidth, trayDepth, "tray", "mirror-x")).toBe(
      50,
    );
    expect(
      resolveMirrorAxis([baseSlot], trayWidth, trayDepth, "selection", "mirror-y"),
    ).toBe(25);
  });

  it("mirrors slot positions and rotations for both axes", () => {
    expect(mirrorSlot(baseSlot, 50, "mirror-x")).toMatchObject({
      x: 80,
      y: 25,
      rotation: 150,
    });
    expect(mirrorSlot(baseSlot, 40, "mirror-y")).toMatchObject({
      x: 20,
      y: 55,
      rotation: -30,
    });
  });

  it("builds mirrored insert slots and move updates preserving group ids", () => {
    const selected = [
      { ...baseSlot, groupId: "group-a" },
      { ...baseSlot, id: "slot-2", x: 30, y: 35, rotation: 0 },
    ];

    const inserts = buildMirrorInsertSlots(
      selected,
      trayWidth,
      trayDepth,
      "tray",
      "mirror-x",
    );
    const updates = buildMirrorMoveUpdates(
      selected,
      trayWidth,
      trayDepth,
      "tray",
      "mirror-y",
    );

    expect(inserts[0]).toMatchObject({
      x: 80,
      y: 25,
      rotation: 150,
      groupId: "group-a",
    });
    expect(updates[1]).toMatchObject({
      id: "slot-2",
      x: 30,
      y: 45,
      rotation: 0,
    });
  });

  it("counts out-of-bounds slots based on tolerance-aware bounds", () => {
    const slots = [
      baseSlot,
      { ...baseSlot, id: "slot-2", x: 2, y: 20 },
      { ...baseSlot, id: "slot-3", x: 96, y: 75 },
    ];

    expect(countOutOfBoundsSlots(slots, trayWidth, trayDepth)).toBe(2);
  });

  it("reports mirror-x symmetry when slots are paired across the tray center", () => {
    const slots = [
      { ...baseSlot, id: "a", x: 20, rotation: 0 },
      { ...baseSlot, id: "b", x: 80, rotation: 180 },
    ];

    const result = checkLayoutSymmetry(slots, trayWidth, trayDepth, "tray", "mirror-x");

    expect(result.symmetric).toBe(true);
    expect(result.unmatchedIds).toEqual([]);
    expect(result.matchedPairCount).toBe(1);
  });

  it("reports unmatched slots when symmetry is broken", () => {
    const slots = [
      { ...baseSlot, id: "a", x: 20, rotation: 0 },
      { ...baseSlot, id: "b", x: 80, rotation: 180 },
      { ...baseSlot, id: "c", x: 30, rotation: 0 },
    ];

    const result = checkLayoutSymmetry(slots, trayWidth, trayDepth, "tray", "mirror-x");

    expect(result.symmetric).toBe(false);
    expect(result.unmatchedIds).toContain("c");
    expect(result.matchedPairCount).toBe(1);
  });

  it("treats a slot lying exactly on the mirror axis as self-symmetric", () => {
    const slots = [
      { ...baseSlot, id: "axis", x: 50, rotation: 0 },
    ];

    const result = checkLayoutSymmetry(slots, trayWidth, trayDepth, "tray", "mirror-x");

    expect(result.symmetric).toBe(true);
    expect(result.unmatchedIds).toEqual([]);
    expect(result.matchedPairCount).toBe(0);
  });

  it("checks mirror-y against the tray's vertical center", () => {
    const slots = [
      { ...baseSlot, id: "a", x: 20, y: 20, rotation: 0 },
      { ...baseSlot, id: "b", x: 20, y: 60, rotation: 0 },
    ];

    const result = checkLayoutSymmetry(slots, trayWidth, trayDepth, "tray", "mirror-y");

    expect(result.symmetric).toBe(true);
    expect(result.matchedPairCount).toBe(1);
  });

  it("ignores rotation for circle slots since it is visually identical", () => {
    const slots = [
      { ...baseSlot, id: "a", shape: "circle" as const, width: 20, height: 20, x: 20, rotation: 0 },
      { ...baseSlot, id: "b", shape: "circle" as const, width: 20, height: 20, x: 80, rotation: 0 },
    ];

    const result = checkLayoutSymmetry(slots, trayWidth, trayDepth, "tray", "mirror-x");

    expect(result.symmetric).toBe(true);
  });
});
