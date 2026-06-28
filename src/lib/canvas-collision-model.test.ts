import { describe, expect, it } from "vitest";
import { buildCanvasCollisionState } from "@/lib/canvas-collision-model";

describe("canvas collision model", () => {
  it("returns empty collision state when there are no slots", () => {
    expect(buildCanvasCollisionState([], 5)).toMatchObject({
      collisionErrorCount: 0,
      connectorPairs: [],
    });
  });

  it("builds overlap maps, connector pairs, and involved ids", () => {
    const state = buildCanvasCollisionState(
      [
        {
          id: "slot-1",
          x: 30,
          y: 30,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-2",
          x: 50,
          y: 30,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-3",
          x: 120,
          y: 30,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
      ] as const,
      5,
    );

    expect(state.collisionErrorCount).toBe(1);
    expect(state.collisionMap.get("slot-1")?.overlapIds).toEqual(["slot-2"]);
    expect(state.collisionMap.get("slot-2")?.overlapIds).toEqual(["slot-1"]);
    expect(state.collisionMap.get("slot-3")?.overlapIds).toEqual([]);
    expect(state.connectorPairs).toEqual([
      {
        key: "slot-1|slot-2",
        firstId: "slot-1",
        secondId: "slot-2",
      },
    ]);
    expect(Array.from(state.involvedIds)).toEqual(["slot-1", "slot-2"]);
    expect(state.slotById.get("slot-3")?.x).toBe(120);
  });

  it("supports wider pair spacing for protected height-group boundaries", () => {
    const slots = [
      {
        id: "low",
        x: 30,
        y: 30,
        width: 25,
        height: 25,
        rotation: 0,
        shape: "circle",
      },
      {
        id: "high",
        x: 60.5,
        y: 30,
        width: 25,
        height: 25,
        rotation: 0,
        shape: "circle",
      },
    ] as const;

    expect(buildCanvasCollisionState(slots, 5).collisionErrorCount).toBe(0);

    const protectedState = buildCanvasCollisionState(slots, 5, undefined, {
      maxSpacing: 6,
      getPairSpacing: () => 6,
    });

    expect(protectedState.collisionErrorCount).toBe(1);
    expect(protectedState.collisionMap.get("low")?.overlapIds).toEqual([
      "high",
    ]);
  });
});
