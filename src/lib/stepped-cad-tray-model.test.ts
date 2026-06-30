import { describe, expect, it } from "vitest";
import { measureBoundingBox, measureVolume } from "@jscad/modeling/src/measurements";
import { BASE_HOLE_CONFIG } from "@/lib/config";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import {
  createSteppedCadSplitParts,
  createSteppedCadTrayModel,
} from "@/lib/stepped-cad-tray-model";
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
    enableBaseHole: false,
    baseHoleSize: "25",
  };
}

function countCavityWallFacesNear(
  geometry: { polygons: { vertices: number[][] }[] },
  center: { x: number; y: number },
  radius: number,
  zMin: number,
  zMax: number,
) {
  return geometry.polygons.filter((polygon) => {
    const zValues = polygon.vertices.map((vertex) => vertex[2] ?? 0);
    const polygonMinZ = Math.min(...zValues);
    const polygonMaxZ = Math.max(...zValues);
    if (
      polygonMaxZ - polygonMinZ < 0.5 ||
      polygonMinZ < zMin - 0.05 ||
      polygonMaxZ > zMax + 0.05
    ) {
      return false;
    }

    return polygon.vertices.every((vertex) => {
      const dx = (vertex[0] ?? 0) - center.x;
      const dy = (vertex[1] ?? 0) - center.y;
      return Math.abs(Math.hypot(dx, dy) - radius) < 0.2;
    });
  }).length;
}

function countHorizontalFacesNear(
  geometry: { polygons: { vertices: number[][] }[] },
  z: number,
) {
  return geometry.polygons.filter((polygon) => {
    if (polygon.vertices.length < 3) {
      return false;
    }

    return polygon.vertices.every(
      (vertex) => Math.abs((vertex[2] ?? 0) - z) < 0.01,
    );
  }).length;
}

function expectPartHasBaseHoleCavity(
  geometry: { polygons: { vertices: number[][] }[] },
  baseHole: ReturnType<typeof buildSteppedCadFeatureGraph>["baseHoles"][number],
) {
  const preset = BASE_HOLE_CONFIG.presets[baseHole.baseHoleSize];
  const zMin =
    baseHole.baseThickness - BASE_HOLE_CONFIG.topWall - preset.depth;
  const zMax = zMin + preset.depth;

  expect(
    countCavityWallFacesNear(
      geometry,
      { x: baseHole.cx, y: baseHole.cy },
      preset.diameter / 2,
      zMin,
      zMax,
    ),
  ).toBeGreaterThan(0);
}

describe("stepped cad tray model", () => {
  it("builds a non-empty main tray", () => {
    const geometry = createSteppedCadTrayModel(createParams());
    expect(measureVolume(geometry)).toBeGreaterThan(0);
  });

  it("cuts magnetic base holes from the layered CAD main tray", () => {
    const baseParams = createParams();
    const params = {
      ...baseParams,
      groups: [
        {
          ...baseParams.groups[0],
          bottomHeight: 8,
        },
        {
          ...baseParams.groups[1],
          bottomHeight: 12,
        },
      ],
      slots: [
        {
          ...baseParams.slots[0],
          width: 40,
          height: 40,
        },
        {
          ...baseParams.slots[1],
          width: 60,
          height: 60,
        },
      ],
    };
    const plainModel = createSteppedCadTrayModel({
      ...params,
      enableBaseHole: false,
    });
    const magnetModel = createSteppedCadTrayModel({
      ...params,
      enableBaseHole: true,
    });

    expect(measureVolume(magnetModel)).toBeLessThan(measureVolume(plainModel));
  });

  it("builds one split part per isolated split unit", () => {
    const parts = createSteppedCadSplitParts(createParams());
    expect(parts).toHaveLength(2);
    expect(parts.map((part) => part.label)).toEqual(["低层", "高层"]);
    expect(parts.map((part) => part.fromHeight)).toEqual([0, 10]);
    expect(parts.map((part) => part.toHeight)).toEqual([10, 20]);
  });

  it("cuts CAD magnetic cavities in every split part that owns slots", () => {
    const params = {
      ...createParams(),
      slots: createParams().slots.map((slot) => ({
        ...slot,
        width: slot.id === "slot-high" ? 60 : 40,
        height: slot.id === "slot-high" ? 60 : 40,
      })),
    };
    const graph = buildSteppedCadFeatureGraph(params);
    const lowBaseHole = graph.baseHoles.find((hole) => hole.groupId === "group-low");
    const highBaseHole = graph.baseHoles.find((hole) => hole.groupId === "group-high");
    const plainParts = createSteppedCadSplitParts({
      ...params,
      enableBaseHole: false,
    });
    const magnetParts = createSteppedCadSplitParts({
      ...params,
      enableBaseHole: true,
    });

    expect(lowBaseHole).toBeDefined();
    expect(highBaseHole).toBeDefined();
    expect(measureVolume(magnetParts[0].geometry)).toBeLessThan(
      measureVolume(plainParts[0].geometry),
    );
    expect(measureVolume(magnetParts[1].geometry)).toBeLessThan(
      measureVolume(plainParts[1].geometry),
    );
    expectPartHasBaseHoleCavity(
      magnetParts[0].geometry as unknown as { polygons: { vertices: number[][] }[] },
      lowBaseHole!,
    );
    expectPartHasBaseHoleCavity(
      magnetParts[1].geometry as unknown as { polygons: { vertices: number[][] }[] },
      highBaseHole!,
    );
  });

  it("builds inset assembly pockets on lower parts and 2mm tenons on upper parts by default", () => {
    const params = createParams();
    const plainParts = createSteppedCadSplitParts(params, 0);
    const groovedParts = createSteppedCadSplitParts(params, 2);

    expect(plainParts).toHaveLength(2);
    expect(groovedParts).toHaveLength(2);

    expect(measureVolume(groovedParts[0].geometry)).toBeLessThan(
      measureVolume(plainParts[0].geometry),
    );
    const [[, , plainHighMinZ]] = measureBoundingBox(plainParts[1].geometry);
    const [[, , groovedHighMinZ]] = measureBoundingBox(groovedParts[1].geometry);
    expect(groovedHighMinZ).toBeLessThan(plainHighMinZ);
  });

  it("builds printable locator pins when selected", () => {
    const baseParams = createParams();
    const params = {
      ...baseParams,
      enableSplitLocators: true,
      slots: [
        ...baseParams.slots,
        {
          id: "slot-high-2",
          x: 160,
          y: 150,
          shape: "circle" as const,
          width: 25,
          height: 25,
          rotation: 0,
          groupId: "group-high",
        },
      ],
    };
    const plainParts = createSteppedCadSplitParts(params, 0);
    const groovedParts = createSteppedCadSplitParts(params, 2);

    expect(plainParts).toHaveLength(2);
    expect(groovedParts).toHaveLength(2);

    expect(groovedParts[1].geometry.polygons.length).toBeGreaterThan(
      plainParts[1].geometry.polygons.length,
    );

    const [, [, , plainLowMaxZ]] = measureBoundingBox(plainParts[0].geometry);
    const [, [, , groovedLowMaxZ]] = measureBoundingBox(groovedParts[0].geometry);
    const [[, , plainHighMinZ]] = measureBoundingBox(plainParts[1].geometry);
    const [[, , groovedHighMinZ]] = measureBoundingBox(groovedParts[1].geometry);

    expect(groovedLowMaxZ).toBeGreaterThan(plainLowMaxZ);
    expect(groovedHighMinZ).toBeCloseTo(plainHighMinZ, 3);
  });

  it("builds matching 2mm outline recesses and upper tabs when selected", () => {
    const baseParams = createParams();
    const params = {
      ...baseParams,
      enableSplitRecess: true,
      slots: [
        ...baseParams.slots,
        {
          id: "slot-high-2",
          x: 160,
          y: 150,
          shape: "circle" as const,
          width: 25,
          height: 25,
          rotation: 0,
          groupId: "group-high",
        },
      ],
    };
    const plainParts = createSteppedCadSplitParts(params, 0);
    const groovedParts = createSteppedCadSplitParts(params, 2);

    expect(plainParts).toHaveLength(2);
    expect(groovedParts).toHaveLength(2);

    const [[, , plainHighMinZ]] = measureBoundingBox(plainParts[1].geometry);
    const [[, , groovedHighMinZ]] = measureBoundingBox(groovedParts[1].geometry);

    expect(groovedHighMinZ).toBeLessThan(plainHighMinZ - 1.5);
    expect(
      countHorizontalFacesNear(
        groovedParts[0].geometry as unknown as {
          polygons: { vertices: number[][] }[];
        },
        8,
      ),
    ).toBeGreaterThan(0);
  });
});
