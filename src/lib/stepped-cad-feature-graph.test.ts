import { describe, expect, it } from "vitest";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import { geometries, measurements } from "@jscad/modeling";
import { RENDER_CONFIG } from "@/lib/config";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
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
    splitGrooveDepth: 2,
    smoothingRadius: 60,
    disconnectDistance: 0,
    baseHoleStructure: "none",
    magnetPostHoleDiameter: 5,
    magnetPostHoleDepth: 2,
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
    expect(graph.magnetPostHoles).toHaveLength(2);
    expect(graph.maxHeight).toBe(20);
  });

  it("uses the ellipse snapshot profile exponent for CAD hole geometry", () => {
    const params = createParams();
    params.slots = [
      {
        id: "ellipse-slot",
        x: 100,
        y: 100,
        shape: "ellipse",
        width: 60,
        height: 35.5,
        rotation: 27,
        outerOffset: 0.4,
        profileExponent: 2.05,
        slotDefinitionId: "ellipse-60x35.5",
        groupId: "group-low",
      },
    ];

    const graph = buildSteppedCadFeatureGraph(params);
    const actual = geometries.geom2.toPoints(graph.slotHoles[0].profile);
    const expected = sampleSlotProfilePoints(
      60,
      35.5,
      "ellipse",
      0.4,
      RENDER_CONFIG.cylinderSegments,
      2.05,
    ).map((point) => [point.x, point.y]);

    expect(actual).toEqual(expected);
    expect(graph.slotHoles[0].rotation).toBe(27);
  });

  it("keeps the outer footprint elliptical for a single ellipse slot", () => {
    const params = createParams();
    params.slots = [
      {
        id: "ellipse-slot",
        x: 100,
        y: 100,
        shape: "ellipse",
        width: 60,
        height: 35.5,
        rotation: 0,
        outerOffset: 0.4,
        profileExponent: 2.05,
        slotDefinitionId: "ellipse-60x35.5",
        groupId: "group-low",
      },
    ];

    const graph = buildSteppedCadFeatureGraph(params);
    const [min, max] = measurements.measureBoundingBox(
      graph.groups[0].footprint,
    );
    const width = max[0] - min[0];
    const depth = max[1] - min[1];

    expect(width).toBeCloseTo(70.8, 0);
    expect(depth).toBeCloseTo(46.3, 0);
    expect(width - depth).toBeGreaterThan(20);

    params.slots[0].rotation = 90;
    const rotatedGraph = buildSteppedCadFeatureGraph(params);
    const [rotatedMin, rotatedMax] = measurements.measureBoundingBox(
      rotatedGraph.groups[0].footprint,
    );
    const rotatedWidth = rotatedMax[0] - rotatedMin[0];
    const rotatedDepth = rotatedMax[1] - rotatedMin[1];

    expect(rotatedWidth).toBeCloseTo(46.3, 0);
    expect(rotatedDepth).toBeCloseTo(70.8, 0);
  });
});
