import { describe, expect, it } from "vitest";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import type { SteppedLayoutParams } from "@/types/custom-tray";

function createParams(): SteppedLayoutParams {
  return {
    trayWidth: 260,
    trayDepth: 260,
    slots: [
      {
        id: "slot-low",
        x: 80,
        y: 120,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "group-low",
      },
      {
        id: "slot-high",
        x: 140,
        y: 120,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "group-high",
      },
    ],
    groups: [
      {
        id: "group-low",
        name: "低层",
        color: "#22c55e",
        bottomHeight: 10,
        useGroupSmoothingRadius: false,
        groupSmoothingRadius: 60,
        useGroupDisconnectDistance: false,
        groupDisconnectDistance: 0,
      },
      {
        id: "group-high",
        name: "高层",
        color: "#3b82f6",
        bottomHeight: 20,
        useGroupSmoothingRadius: false,
        groupSmoothingRadius: 60,
        useGroupDisconnectDistance: false,
        groupDisconnectDistance: 0,
      },
    ],
    activeGroupId: "group-low",
    spacing: 5,
    holeDepth: 3,
    smoothingRadius: 60,
    disconnectDistance: 0,
    enableBaseHole: false,
    baseHoleSize: "25",
  };
}

describe("stepped cad feature graph", () => {
  it("builds layered additive features by unique group heights", () => {
    const graph = buildSteppedCadFeatureGraph(createParams());

    expect(graph.layers).toHaveLength(2);
    expect(graph.layers[0]).toMatchObject({
      fromHeight: 0,
      toHeight: 10,
      groupIds: ["group-low", "group-high"],
    });
    expect(graph.layers[1]).toMatchObject({
      fromHeight: 10,
      toHeight: 20,
      groupIds: ["group-high"],
    });
  });

  it("emits one slot-hole feature per slot", () => {
    const graph = buildSteppedCadFeatureGraph(createParams());

    expect(graph.slotHoles).toHaveLength(2);
    expect(graph.slotHoles.map((item) => item.id)).toEqual([
      "slot-low",
      "slot-high",
    ]);
    expect(graph.baseHoles).toHaveLength(2);
    expect(graph.maxHeight).toBe(20);
  });
});
