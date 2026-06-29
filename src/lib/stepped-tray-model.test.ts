import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import steppedMergedSplitFragmentFixture from "@/lib/fixtures/tray-stepped-merged-split-fragments.json";
import steppedSplitFragmentFixture from "@/lib/fixtures/tray-stepped-split-fragments.json";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import {
  calculateSteppedTrayDimensions,
  createSteppedSplitParts,
  createSteppedTrayModel,
} from "@/lib/stepped-tray-model";

const { measureBoundingBox, measureVolume } = measurements;

function hasBottomCylinderWallNear(
  geometry: { polygons: { vertices: number[][] }[] },
  center: { x: number; y: number },
  radius: number,
) {
  return geometry.polygons.some((polygon) => {
    const zValues = polygon.vertices.map((vertex) => vertex[2] ?? 0);
    const minZ = Math.min(...zValues);
    const maxZ = Math.max(...zValues);
    if (Math.abs(minZ) > 0.001 || maxZ < 0.2) {
      return false;
    }

    return polygon.vertices.every((vertex) => {
      const dx = (vertex[0] ?? 0) - center.x;
      const dy = (vertex[1] ?? 0) - center.y;
      return Math.hypot(dx, dy) <= radius;
    });
  });
}

function polygonArea2d(polygon: { vertices: number[][] }) {
  let area = 0;
  for (let i = 0; i < polygon.vertices.length; i += 1) {
    const current = polygon.vertices[i];
    const next = polygon.vertices[(i + 1) % polygon.vertices.length];
    area += (current[0] ?? 0) * (next[1] ?? 0);
    area -= (next[0] ?? 0) * (current[1] ?? 0);
  }
  return Math.abs(area) / 2;
}

function countSmallHorizontalTopFaces(
  geometry: { polygons: { vertices: number[][] }[] },
  z: number,
) {
  return geometry.polygons.filter((polygon) => {
    if (polygon.vertices.length < 3) {
      return false;
    }
    const onPlane = polygon.vertices.every(
      (vertex) => Math.abs((vertex[2] ?? 0) - z) < 0.001,
    );
    return onPlane && polygonArea2d(polygon) < 5;
  }).length;
}

function createParams(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    spacing: 5,
    holeDepth: 2,
    groups: [
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "low",
        name: "低组",
        bottomHeight: 2,
      },
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "high",
        name: "高组",
        color: "#3b82f6",
        bottomHeight: 12,
      },
    ],
    activeGroupId: "low",
    slots: [
      {
        id: "slot-low",
        groupId: "low",
        x: -10,
        y: 0,
        width: 25,
        height: 25,
        rotation: 0,
        shape: "circle",
      },
      {
        id: "slot-high",
        groupId: "high",
        x: 35,
        y: 8,
        width: 40,
        height: 40,
        rotation: 0,
        shape: "circle",
      },
    ],
  };
}

function createMagnetParams(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    enableBaseHole: true,
    groups: [
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "low",
        name: "低组",
        bottomHeight: 8,
      },
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "high",
        name: "高组",
        color: "#3b82f6",
        bottomHeight: 11,
      },
    ],
    activeGroupId: "low",
    holeDepth: 3,
    slots: [
      {
        id: "slot-low",
        groupId: "low",
        x: -18,
        y: 0,
        width: 40,
        height: 40,
        rotation: 0,
        shape: "circle",
      },
      {
        id: "slot-high",
        groupId: "high",
        x: 18,
        y: 0,
        width: 60,
        height: 60,
        rotation: 0,
        shape: "circle",
      },
    ],
  };
}

describe("stepped tray model", { timeout: 15000 }, () => {
  it("returns a thin placeholder body when slots or groups are missing", () => {
    const model = createSteppedTrayModel({
      ...STEPPED_LAYOUT_DEFAULTS,
      slots: [],
    });

    const [[minX, minY, minZ], [maxX, maxY, maxZ]] = measureBoundingBox(model);
    expect(maxX - minX).toBeGreaterThan(0);
    expect(maxY - minY).toBeGreaterThan(0);
    expect(maxZ - minZ).toBeCloseTo(0.1, 5);
  });

  it("derives dimensions from the occupied slot bounds and clamps minimum group height", () => {
    const lowOnlyParams: SteppedLayoutParams = {
      ...createParams(),
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "low",
          name: "低组",
          bottomHeight: 2,
        },
      ],
      slots: [
        {
          id: "slot-low",
          groupId: "low",
          x: -10,
          y: 0,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
      ],
    };

    expect(calculateSteppedTrayDimensions(lowOnlyParams)).toEqual({
      width: 36,
      depth: 36,
      height: 3,
    });
  });

  it("keeps positive volume and removes more material when holes get deeper", () => {
    const shallowModel = createSteppedTrayModel({
      ...createParams(),
      holeDepth: 1,
    });
    const deepModel = createSteppedTrayModel({
      ...createParams(),
      holeDepth: 6,
    });

    const shallowVolume = measureVolume(shallowModel);
    const deepVolume = measureVolume(deepModel);

    expect(shallowVolume).toBeGreaterThan(0);
    expect(deepVolume).toBeGreaterThan(0);
    expect(deepVolume).toBeLessThan(shallowVolume);
  });

  it("cuts base magnetic holes using each group's available support thickness", () => {
    const plainModel = createSteppedTrayModel({
      ...createMagnetParams(),
      enableBaseHole: false,
    });
    const magnetModel = createSteppedTrayModel(createMagnetParams());

    expect(measureVolume(magnetModel)).toBeLessThan(measureVolume(plainModel));
  });

  it("creates one split part per group", () => {
    const parts = createSteppedSplitParts(createParams());

    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({
      filenameLabel: "part_01_low",
      label: "低组",
      fromHeight: 0,
      toHeight: 3,
    });
    expect(parts[1]).toMatchObject({
      filenameLabel: "part_02_high",
      label: "高组",
      fromHeight: 0,
      toHeight: 12,
    });
    expect(measureVolume(parts[0].geometry)).toBeGreaterThan(0);
    expect(measureVolume(parts[1].geometry)).toBeGreaterThan(0);
  });

  it("keeps magnetic holes on bottom-most stepped split parts only", () => {
    const plainParts = createSteppedSplitParts({
      ...createMagnetParams(),
      enableBaseHole: false,
    });
    const magnetParts = createSteppedSplitParts(createMagnetParams());

    expect(measureVolume(magnetParts[0].geometry)).toBeLessThan(
      measureVolume(plainParts[0].geometry),
    );
    expect(measureVolume(magnetParts[1].geometry)).toBeCloseTo(
      measureVolume(plainParts[1].geometry),
      5,
    );
  });

  it("merges different-height groups into one split part when configured", () => {
    const parts = createSteppedSplitParts({
      ...createParams(),
      groups: [
        {
          ...createParams().groups[0],
          splitPartGroupId: "high",
        },
        createParams().groups[1],
      ],
    });

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      filenameLabel: "part_01_low_high",
      label: "低组 + 高组",
      fromHeight: 0,
      toHeight: 12,
    });
    expect(measureVolume(parts[0].geometry)).toBeGreaterThan(0);
  });

  it("keeps each split part bottom solid without connector piercings", () => {
    // 回归测试：移除接触面圆柱形插销后，较高零件的底面不应再被插销孔穿透。
    const parts = createSteppedSplitParts({
      ...createParams(),
      spacing: 12,
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "low",
          name: "低组",
          bottomHeight: 3,
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "high",
          name: "高组",
          color: "#3b82f6",
          bottomHeight: 12,
        },
      ],
      slots: [
        {
          id: "slot-low",
          groupId: "low",
          x: -25,
          y: 0,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-high",
          groupId: "high",
          x: 25,
          y: 0,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
      ],
    });

    for (const part of parts) {
      expect(
        hasBottomCylinderWallNear(part.geometry, { x: 0, y: 0 }, 2.5),
      ).toBe(false);
    }
  });

  it("creates female grooves below and male tenons above different-height interfaces", () => {
    const groovedParts = createSteppedSplitParts(createParams());
    const plainParts = createSteppedSplitParts(createParams(), {
      interfaceGrooveDepth: 0,
    });

    expect(groovedParts).toHaveLength(plainParts.length);
    expect(measureVolume(groovedParts[0].geometry)).toBeLessThan(
      measureVolume(plainParts[0].geometry),
    );
    expect(measureVolume(groovedParts[1].geometry)).toBeGreaterThan(
      measureVolume(plainParts[1].geometry),
    );
    const [[, , groovedHighMinZ]] = measureBoundingBox(groovedParts[1].geometry);
    const [[, , plainHighMinZ]] = measureBoundingBox(plainParts[1].geometry);
    expect(groovedHighMinZ).toBeLessThan(plainHighMinZ);
  });

  it("removes intermediate split part residue below the assembly groove", () => {
    const params = (steppedSplitFragmentFixture as unknown as {
      params: SteppedLayoutParams;
    }).params;
    const middlePart = createSteppedSplitParts(params).find(
      (part) => part.label === "组 2",
    );

    expect(middlePart).toBeDefined();
    const [[, , minZ]] = measureBoundingBox(middlePart!.geometry);
    expect(minZ).toBeGreaterThanOrEqual(7.9);
  });

  it("removes lower-island residue from merged different-height split parts", () => {
    const params = (steppedMergedSplitFragmentFixture as unknown as {
      params: SteppedLayoutParams;
    }).params;
    const mergedPart = createSteppedSplitParts(params).find(
      (part) => part.label === "组 4 + 组 2",
    );

    expect(mergedPart).toBeDefined();
    const [[, , minZ]] = measureBoundingBox(mergedPart!.geometry);
    expect(minZ).toBeGreaterThanOrEqual(7.9);
  });

  it("does not leave duplicate groove fragments on the lowest merged-support top", () => {
    const params = (steppedMergedSplitFragmentFixture as unknown as {
      params: SteppedLayoutParams;
    }).params;
    const lowPart = createSteppedSplitParts(params).find(
      (part) => part.label === "组 1",
    );

    expect(lowPart).toBeDefined();
    expect(countSmallHorizontalTopFaces(lowPart!.geometry, 10)).toBeLessThan(700);
  });

  it("keeps same-height groups as separate split parts", () => {
    const parts = createSteppedSplitParts({
      ...createParams(),
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "left",
          name: "左组",
          bottomHeight: 10,
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "right",
          name: "右组",
          color: "#3b82f6",
          bottomHeight: 10,
        },
      ],
      slots: [
        {
          id: "slot-left",
          groupId: "left",
          x: -35,
          y: 0,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-right",
          groupId: "right",
          x: 35,
          y: 0,
          width: 25,
          height: 25,
          rotation: 0,
          shape: "circle",
        },
      ],
    });

    expect(parts.map((part) => part.label)).toEqual(["左组", "右组"]);
    expect(parts.map((part) => part.toHeight)).toEqual([10, 10]);
  });

  it("does not let same-height horizontal groups cut each other's slot holes", () => {
    const parts = createSteppedSplitParts({
      ...createParams(),
      spacing: 12,
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "left",
          name: "左组",
          bottomHeight: 10,
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "right",
          name: "右组",
          color: "#3b82f6",
          bottomHeight: 10,
        },
      ],
      slots: [
        {
          id: "slot-left",
          groupId: "left",
          x: -18,
          y: 0,
          width: 30,
          height: 30,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-right",
          groupId: "right",
          x: 18,
          y: 0,
          width: 30,
          height: 30,
          rotation: 0,
          shape: "circle",
        },
      ],
    }, {
      interfaceGrooveDepth: 0,
    });

    expect(parts.map((part) => part.label)).toEqual(["左组", "右组"]);
    const leftVolume = measureVolume(parts[0].geometry);
    const rightVolume = measureVolume(parts[1].geometry);
    expect(leftVolume).toBeGreaterThan(0);
    expect(rightVolume).toBeGreaterThan(0);
    expect(Math.abs(leftVolume - rightVolume) / leftVolume).toBeLessThan(0.03);
  });

  it("splits a higher group's assembly groove across same-height support groups", () => {
    const params: SteppedLayoutParams = {
      ...createParams(),
      spacing: 12,
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "left",
          name: "左组",
          bottomHeight: 6,
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "right",
          name: "右组",
          color: "#3b82f6",
          bottomHeight: 6,
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "high",
          name: "高组",
          color: "#22c55e",
          bottomHeight: 14,
        },
      ],
      slots: [
        {
          id: "slot-left",
          groupId: "left",
          x: -25,
          y: 0,
          width: 30,
          height: 30,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-right",
          groupId: "right",
          x: 25,
          y: 0,
          width: 30,
          height: 30,
          rotation: 0,
          shape: "circle",
        },
        {
          id: "slot-high",
          groupId: "high",
          x: 0,
          y: 0,
          width: 32,
          height: 32,
          rotation: 0,
          shape: "circle",
        },
      ],
    };
    const groovedParts = createSteppedSplitParts(params);
    const plainParts = createSteppedSplitParts(params, {
      interfaceGrooveDepth: 0,
    });
    const leftReduction =
      measureVolume(plainParts[0].geometry) -
      measureVolume(groovedParts[0].geometry);
    const rightReduction =
      measureVolume(plainParts[1].geometry) -
      measureVolume(groovedParts[1].geometry);
    const highIncrease =
      measureVolume(groovedParts[2].geometry) -
      measureVolume(plainParts[2].geometry);
    const [[, , groovedHighMinZ]] = measureBoundingBox(groovedParts[2].geometry);
    const [[, , plainHighMinZ]] = measureBoundingBox(plainParts[2].geometry);

    expect(leftReduction).toBeGreaterThan(0);
    expect(rightReduction).toBeGreaterThan(0);
    expect(Math.abs(leftReduction - rightReduction) / leftReduction).toBeLessThan(
      0.08,
    );
    expect(highIncrease).toBeGreaterThan(0);
    expect(groovedHighMinZ).toBeLessThan(plainHighMinZ);
  });
});
