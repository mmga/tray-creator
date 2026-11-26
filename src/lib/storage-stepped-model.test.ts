import { booleans, geometries, measurements, primitives, transforms } from "@jscad/modeling";
import generalizeModule from "@jscad/modeling/src/operations/modifiers/generalize";
import stlSerializer from "@jscad/stl-serializer";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { describe, expect, it } from "vitest";
import { createFreeSlotInstance } from "@/lib/slot-instance-factory";
import { closeManualSplitStl } from "@/lib/manual-split-stl";
import {
  createDefaultStorageSteppedParams,
  storageSteppedTrayPartId,
  withStorageSteppedDepthPreset,
  withStorageSteppedHeightSpec,
} from "@/lib/storage-stepped-config";
import {
  createStorageSteppedBodyModel,
  createStorageSteppedPartModel,
  createStorageSteppedPartModels,
  createStorageSteppedTrayModel,
  getStorageSteppedAssemblyOffset,
  measureStorageSteppedBody,
} from "@/lib/storage-stepped-model";
import { deriveStorageSteppedPlan } from "@/lib/storage-stepped-plan";
import { applyStorageSteppedTrayPreset } from "@/lib/storage-stepped-presets";
import type { StorageSteppedParams } from "@/types/storage-stepped";

const { intersect } = booleans;
const { geom3 } = geometries;
const { measureBoundingBox, measureVolume } = measurements;
const { cuboid } = primitives;
const { translate } = transforms;

// 与 STL 导出相同的三角形补点，消除布尔运算留下的 T 形接点。
const generalize = generalizeModule as unknown as (
  options: { triangulate: boolean; snap?: boolean },
  geometry: Geom3,
) => Geom3;

function withSingleSlot(
  params: StorageSteppedParams,
  stepIndex: number,
  slot: Parameters<typeof createFreeSlotInstance>[0],
): StorageSteppedParams {
  return {
    ...params,
    trays: params.trays.map((tray) =>
      tray.stepIndex === stepIndex
        ? {
            ...tray,
            presetId: "custom",
            slots: [createFreeSlotInstance(slot)],
          }
        : tray,
    ),
  };
}

function sampleVolume(geometry: Geom3, center: [number, number, number], size = 1): number {
  return measureVolume(
    intersect(geometry, translate(center, cuboid({ size: [size, size, size] }))),
  );
}

interface TopologyReport {
  connectedComponents: number;
  openEdgeCount: number;
  nonManifoldEdgeCount: number;
}

/** 用边配对检查网格闭合，用共享边做面连通性检查。 */
function inspectTopology(geometry: Geom3): TopologyReport {
  const polygons = geom3.toPolygons(generalize({ snap: true, triangulate: true }, geometry));
  const keyOf = (point: number[]) =>
    point.map((value) => Math.round(value / 1e-4)).join(",");
  const edgeFaces = new Map<string, number[]>();
  const parent = polygons.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  polygons.forEach((polygon, faceIndex) => {
    const vertices = polygon.vertices;
    for (let index = 0; index < vertices.length; index += 1) {
      const start = keyOf(vertices[index]);
      const end = keyOf(vertices[(index + 1) % vertices.length]);
      if (start === end) continue;
      const key = start < end ? `${start}|${end}` : `${end}|${start}`;
      const faces = edgeFaces.get(key);
      if (faces) {
        faces.push(faceIndex);
      } else {
        edgeFaces.set(key, [faceIndex]);
      }
    }
  });

  let openEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  for (const faces of edgeFaces.values()) {
    if (faces.length === 1) openEdgeCount += 1;
    if (faces.length > 2) nonManifoldEdgeCount += 1;
    for (let index = 1; index < faces.length; index += 1) {
      union(faces[0], faces[index]);
    }
  }
  const roots = new Set(polygons.map((_, index) => find(index)));
  return {
    connectedComponents: roots.size,
    openEdgeCount,
    nonManifoldEdgeCount,
  };
}

describe("Storage Stepped 主体几何", () => {
  it.each([
    ["300-60-60-80-100", [60, 60, 80, 100], [-120, -60, 10, 100], 150],
    ["300-60-80-80-80", [60, 80, 80, 80], [-120, -50, 30, 110], 150],
    ["300-100-100-100", [100, 100, 100], [-100, 0, 100], 110],
  ] as const)("深度预设 %s 生成闭合且可装配的主体和对应托盘", async (preset, depths, centers, height) => {
    const params = withStorageSteppedDepthPreset(createDefaultStorageSteppedParams(), preset);
    const [body, ...trays] = createStorageSteppedPartModels(params);
    const [min, max] = measureBoundingBox(body.geometry);
    expect(max[1] - min[1]).toBeCloseTo(300, 2);
    expect(max[2]).toBeCloseTo(height, 2);
    expect(inspectTopology(body.geometry)).toEqual({
      connectedComponents: 1, openEdgeCount: 0, nonManifoldEdgeCount: 0,
    });
    expect(trays).toHaveLength(depths.length);
    trays.forEach((tray, index) => {
      const [min, max] = measureBoundingBox(tray.geometry);
      expect(max[1] - min[1]).toBeCloseTo(depths[index] - 4.6, 2);
      expect(tray.assemblyOffset).toEqual([0, centers[index], 24 + index * 40]);
      const assembled = translate(tray.assemblyOffset, tray.geometry);
      const overlap = intersect(body.geometry, assembled);
      if (Math.abs(measureVolume(overlap)) > 1e-3) {
        // 主体布尔运算的网格吸附可能产生不足 0.002 mm 的贴面重叠。
        const [overlapMin, overlapMax] = measureBoundingBox(overlap);
        const seatZ = tray.assemblyOffset[2];
        expect(overlapMin[2]).toBeGreaterThan(seatZ - 0.002);
        expect(overlapMax[2]).toBeLessThan(seatZ + 0.002);
      }
    });
    for (const part of [body, ...trays]) {
      const stl = new Blob(stlSerializer.serialize({ binary: true }, part.geometry) as BlobPart[]);
      expect(await closeManualSplitStl(stl), part.partId).not.toBeNull();
    }
  });

  it("标准高度主体外尺寸为 240 × 240 × 110 且底面 Z=0", () => {
    const params = createDefaultStorageSteppedParams("standard");
    const bounds = measureStorageSteppedBody(params);
    // 布尔输出经过网格吸附以闭合微小三角形缺口，允许 0.01mm 内的尺寸偏差。
    expect(bounds.min[0]).toBeCloseTo(-120, 2);
    expect(bounds.max[0]).toBeCloseTo(120, 2);
    expect(bounds.min[1]).toBeCloseTo(-120, 2);
    expect(bounds.max[1]).toBeCloseTo(120, 2);
    expect(bounds.min[2]).toBeCloseTo(0, 2);
    expect(bounds.max[2]).toBeCloseTo(110, 2);
  });

  it("收纳高度主体外高为 120", () => {
    const params = withStorageSteppedHeightSpec(
      createDefaultStorageSteppedParams("standard"),
      "storage",
    );
    const bounds = measureStorageSteppedBody(params);
    expect(bounds.max[2]).toBeCloseTo(120, 2);
  });

  it("主体是单个闭合连通实体，没有开放边或非流形边", () => {
    const body = createStorageSteppedBodyModel(createDefaultStorageSteppedParams());
    const topology = inspectTopology(body);
    expect(topology.connectedComponents).toBe(1);
    expect(topology.openEdgeCount).toBe(0);
    expect(topology.nonManifoldEdgeCount).toBe(0);
    expect(measureVolume(body)).toBeGreaterThan(0);
  });

  it("三个仓腔互不串通且底板完整", () => {
    const params = createDefaultStorageSteppedParams();
    const body = createStorageSteppedBodyModel(params);
    const plan = deriveStorageSteppedPlan(params);

    for (const step of plan.steps) {
      const centerY = -plan.bodyDepth / 2 + step.index * plan.interface.moduleDepth +
        plan.interface.moduleDepth / 2;
      const cavityCenterZ = (step.cavity.minZ + step.cavity.maxZ) / 2;
      const insideCavity = sampleVolume(body, [0, centerY, cavityCenterZ], 8);
      expect(insideCavity).toBeLessThan(1e-3);

      // 底板：腔体正下方 2.4mm 板厚内应保持实心
      const insideBottomPlate = sampleVolume(body, [0, centerY, 1.2], 4);
      expect(insideBottomPlate).toBeCloseTo(38.4, 1);

      // 仓腔下方靠近底板顶面仍然空
      const justAbovePlate = sampleVolume(
        body,
        [0, centerY, plan.interface.baseThickness + 2],
        4,
      );
      expect(justAbovePlate).toBeLessThan(1e-3);
    }
  });

  it("相邻仓腔之间保留 8mm 隔墙", () => {
    const params = createDefaultStorageSteppedParams();
    const body = createStorageSteppedBodyModel(params);
    const plan = deriveStorageSteppedPlan(params);
    const boundaryY = -plan.bodyDepth / 2 + plan.interface.moduleDepth;
    const firstDeck = plan.steps[0].deckHeight;
    const wallHeight = firstDeck - plan.interface.trayThickness - plan.interface.baseThickness;

    const divider = intersect(
      body,
      translate(
        [0, boundaryY, plan.interface.baseThickness + wallHeight / 2],
        cuboid({
          size: [plan.bodyWidth, 2 * plan.interface.lowerWallThickness, wallHeight],
        }),
      ),
    );
    expect(measureVolume(divider)).toBeCloseTo(
      plan.bodyWidth * 2 * plan.interface.lowerWallThickness * wallHeight,
      0,
    );
  });

  it("指扣最低点正确，并只切削侧壁与承托台阶", () => {
    const params = createDefaultStorageSteppedParams();
    const body = createStorageSteppedBodyModel(params);
    const plan = deriveStorageSteppedPlan(params);
    const first = plan.steps[0];
    const leftWallX = -plan.bodyWidth / 2 + plan.interface.lowerWallThickness / 2;

    // 圆心所在高度、模块深度中点：指扣贯穿侧壁
    expect(sampleVolume(body, [leftWallX, -plan.bodyDepth / 2 + plan.interface.moduleDepth / 2, first.deckHeight - 8], 2))
      .toBeLessThan(1e-3);
    // 同一高度、远离指扣的侧壁仍然实心
    expect(sampleVolume(body, [leftWallX, -plan.bodyDepth / 2 + plan.interface.moduleDepth / 2 + 25, first.deckHeight - 8], 2))
      .toBeGreaterThan(4);
    // 指扣最低点以下侧壁仍然实心
    expect(sampleVolume(body, [leftWallX, -plan.bodyDepth / 2 + plan.interface.moduleDepth / 2, first.deckHeight - 18], 2))
      .toBeGreaterThan(4);
    // 指扣未切到托盘位置（承托面以上为开放口）
    expect(sampleVolume(body, [0, -plan.bodyDepth / 2 + plan.interface.moduleDepth / 2, first.deckHeight - 3], 2))
      .toBeLessThan(1e-3);
  });

  it("托盘安装面无正体积干涉，顶面齐平且底面落到承托平面", () => {
    const params = createDefaultStorageSteppedParams();
    const plan = deriveStorageSteppedPlan(params);
    const body = createStorageSteppedBodyModel(params);

    for (const step of plan.steps) {
      const tray = createStorageSteppedTrayModel(params, step.index);
      const offset = getStorageSteppedAssemblyOffset(
        params,
        storageSteppedTrayPartId(step.index),
      );
      const assembled = translate(offset, tray);
      const interference = intersect(body, assembled);
      expect(measureVolume(interference)).toBeLessThan(1e-3);

      const [, max] = measureBoundingBox(assembled);
      expect(max[2]).toBeCloseTo(step.deckHeight, 2);
      const [min] = measureBoundingBox(assembled);
      expect(min[2]).toBeCloseTo(step.supportZ, 2);
    }
  });
});

describe("Storage Stepped 平板托盘几何", () => {
  it.each([
    ["300-60-80-80-80", "circle-32-five", 6],
    ["240", "circle-32-ten-staggered", 12],
  ] as const)("预设 %s 的 %s 满槽托盘可以导出闭合 STL", async (depthPreset, trayPreset, count) => {
    let id = 0;
    const base = withStorageSteppedDepthPreset(createDefaultStorageSteppedParams(), depthPreset);
    const params = applyStorageSteppedTrayPreset(base, 0, trayPreset, { createId: () => `slot-${++id}` });
    expect(params.trays[0].slots).toHaveLength(count);
    const geometry = createStorageSteppedTrayModel(params, 0);
    const stl = new Blob(stlSerializer.serialize({ binary: true }, geometry) as BlobPart[]);
    expect(await closeManualSplitStl(stl)).not.toBeNull();
  });

  it("平板托盘外形为 235.4 × 75.4 × 6，打印底面 Z=0", () => {
    const params = createDefaultStorageSteppedParams();
    const tray = createStorageSteppedTrayModel(params, 0);
    const [min, max] = measureBoundingBox(tray);
    expect(max[0] - min[0]).toBeCloseTo(235.4, 2);
    expect(max[1] - min[1]).toBeCloseTo(75.4, 2);
    expect(min[2]).toBeCloseTo(0, 2);
    expect(max[2]).toBeCloseTo(6, 2);
  });

  it("平底托盘的底部截面保持完整宽度和深度", () => {
    const params = createDefaultStorageSteppedParams();
    const tray = createStorageSteppedTrayModel(params, 0);
    const bottomSlice = intersect(
      tray,
      translate([0, 0, 0.1], cuboid({ size: [300, 200, 0.2] })),
    );
    const [bottomMin, bottomMax] = measureBoundingBox(bottomSlice);
    expect(bottomMax[0] - bottomMin[0]).toBeCloseTo(235.4, 2);
    expect(bottomMax[1] - bottomMin[1]).toBeCloseTo(75.4, 2);
  });

  it("高度规格不改变托盘几何", () => {
    const standard = createDefaultStorageSteppedParams("standard");
    const storage = withStorageSteppedHeightSpec(standard, "storage");
    expect(measureVolume(createStorageSteppedTrayModel(storage, 1))).toBeCloseTo(
      measureVolume(createStorageSteppedTrayModel(standard, 1)),
      3,
    );
  });

  it("槽位从顶面向下切出，槽底厚度为 6 − 槽深", () => {
    const params = withSingleSlot(createDefaultStorageSteppedParams(), 0, {
      id: "slot-1",
      x: 235.4 / 2,
      y: 75.4 / 2,
      width: 32,
    });
    const tray = createStorageSteppedTrayModel(params, 0);
    expect(sampleVolume(tray, [0, 0, 5.0], 2)).toBeLessThan(1e-3);
    expect(sampleVolume(tray, [0, 0, 4.0], 2)).toBeLessThan(1e-3);
    // 槽底 3mm 以下仍保留材料
    expect(sampleVolume(tray, [0, 0, 2.0], 2)).toBeGreaterThan(7);
  });

  it("最深的可编辑槽位保留 1 mm 槽底，拒绝接近切穿的导入槽深", () => {
    const params = withSingleSlot(createDefaultStorageSteppedParams(), 0, {
      id: "deep-slot", width: 32, x: 117.7, y: 37.7,
    });
    params.trays[0].holeDepth = 5;
    expect(sampleVolume(createStorageSteppedTrayModel(params, 0), [0, 0, 0.5]))
      .toBeCloseTo(1, 3);
    params.trays[0].holeDepth = 5.995;
    expect(() => createStorageSteppedTrayModel(params, 0)).toThrow(/槽深/);
  });

  it("磁铁桩孔从槽底向下切，保留 1mm 底壁", () => {
    const params = withSingleSlot(createDefaultStorageSteppedParams(), 0, {
      id: "slot-1",
      x: 235.4 / 2,
      y: 75.4 / 2,
      width: 32,
    });
    params.trays[0] = {
      ...params.trays[0],
      baseHoleStructure: "magnet-post-hole",
      magnetPostHoleDiameter: 5,
      magnetPostHoleDepth: 2,
    };
    const tray = createStorageSteppedTrayModel(params, 0);
    // 孔心 z=2（槽底 3mm 向下 2mm 的中间）
    expect(sampleVolume(tray, [0, 0, 2.0], 1)).toBeLessThan(1e-3);
    // 底面以上 0.5mm 保留底壁
    expect(sampleVolume(tray, [0, 0, 0.5], 1)).toBeGreaterThan(0.5);
  });

  it("三块托盘各自为独立闭合实体", () => {
    const params = withSingleSlot(createDefaultStorageSteppedParams(), 1, {
      id: "slot-1",
      x: 117.7,
      y: 37.7,
      width: 32,
    });
    const parts = createStorageSteppedPartModels(params);
    expect(parts.map((part) => part.partId)).toEqual([
      "body",
      "tray-1",
      "tray-2",
      "tray-3",
    ]);
    for (const part of parts) {
      const topology = inspectTopology(part.geometry);
      expect(topology.connectedComponents).toBe(1);
      expect(topology.openEdgeCount).toBe(0);
      expect(topology.nonManifoldEdgeCount).toBe(0);
      expect(part.volume).toBeGreaterThan(0);
      const [min] = measureBoundingBox(part.geometry);
      expect(min[2]).toBeCloseTo(0, 6);
    }
  });

  it("单件模型同时返回打印几何与装配位移", () => {
    const params = createDefaultStorageSteppedParams();
    const body = createStorageSteppedPartModel(params, "body");
    expect(body.assemblyOffset).toEqual([0, 0, 0]);
    expect(body.volume).toBeGreaterThan(0);

    const tray = createStorageSteppedPartModel(params, "tray-2");
    const plan = deriveStorageSteppedPlan(params);
    expect(tray.assemblyOffset).toEqual([
      0,
      -plan.bodyDepth / 2 + plan.interface.moduleDepth * 1.5,
      plan.steps[1].supportZ,
    ]);
    const [min] = measureBoundingBox(tray.geometry);
    expect(min[2]).toBeCloseTo(0, 6);
    expect(tray.volume).toBeGreaterThan(0);
  });

  it("未知零件身份被拒绝", () => {
    const params = createDefaultStorageSteppedParams();
    expect(() => createStorageSteppedPartModel(params, "tray-9")).toThrow();
    expect(() => createStorageSteppedPartModel(params, "lid")).toThrow();
  });

  it("底孔被阻断时拒绝生成，而不是加厚托盘", () => {
    const params = withSingleSlot(createDefaultStorageSteppedParams(), 0, {
      id: "slot-1",
      x: 117.7,
      y: 37.7,
      width: 32,
    });
    params.trays[0] = {
      ...params.trays[0],
      baseHoleStructure: "magnet-post-hole",
      magnetPostHoleDepth: 3,
    };
    expect(() => createStorageSteppedTrayModel(params, 0)).toThrow(/底壁|槽底/);
    expect(params.interface.trayThickness).toBe(6);
  });
});
