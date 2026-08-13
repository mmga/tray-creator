import { describe, expect, it } from "vitest";
import { buildSteppedCadFeatureGraph } from "@/test/contoured-state";
import { buildSteppedCadFootprintPlan } from "@/lib/stepped-cad-feature-graph";
import { geometries, measurements } from "@jscad/modeling";
import { RENDER_CONFIG } from "@/lib/config";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import type { SteppedLayoutParams } from "@/types/custom-tray";

function createParams(): SteppedLayoutParams {
  return {
    trayWidth: 260,
    trayDepth: 260,
    enableSplitAssembly: true,
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
  it("exposes footprint planning without CAD hole features", () => {
    const params: SteppedLayoutParams = {
      ...createParams(),
      footprintStyle: "rectangular",
      traySizingMode: "auto",
    };
    const plan = buildSteppedCadFootprintPlan(params);
    const graph = buildSteppedCadFeatureGraph(params);

    expect(plan).toEqual({
      trayWidth: graph.trayWidth,
      trayDepth: graph.trayDepth,
      maxHeight: graph.maxHeight,
      groups: graph.groups,
      layers: graph.layers,
    });
    expect(plan).not.toHaveProperty("slotHoles");
    expect(plan).not.toHaveProperty("baseHoles");
    expect(plan).not.toHaveProperty("magnetPostHoles");
  });

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
    expect(graph.baseHoles).toHaveLength(0);
    expect(graph.magnetPostHoles).toHaveLength(0);
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

  it("Rectangular Stepped Footprint：最低层为整体轴对齐包络+圆角，更高层为分组矩形直角", () => {
    const params = {
      ...createParams(),
      footprintStyle: "rectangular" as const,
      traySizingMode: "auto" as const,
      cornerRadius: 6,
      boundarySpacing: 5,
      boundarySpacingIndependent: true,
    };
    const graph = buildSteppedCadFeatureGraph(params);

    expect(graph.groups.length).toBe(2);
    // 最低 layer 对应整体包络；高层 group 对应分组包络
    const lowLayer = graph.layers[0];
    const highGroup = graph.groups.find((g) => g.columnHeight === 20)!;

    // 最低层应包含两个槽位的整体包络（宽度约 25 + 5*(spacing=5) + 35 + 2*5 = ?，至少 > 单槽）
    const [lowMin, lowMax] = measurements.measureBoundingBox(lowLayer.footprint);
    const lowWidth = lowMax[0] - lowMin[0];
    expect(lowWidth).toBeGreaterThan(50);

    // 高层只包含高层组的槽位，宽度更小
    const [highMin, highMax] = measurements.measureBoundingBox(highGroup.footprint);
    const highWidth = highMax[0] - highMin[0];
    expect(highWidth).toBeLessThan(lowWidth);
    expect(highWidth).toBeGreaterThan(25);
  });

  it("Rectangular Stepped Footprint：fixed sizing 仅作用于最低连续层", () => {
    const params = {
      ...createParams(),
      footprintStyle: "rectangular" as const,
      traySizingMode: "fixed" as const,
      trayWidth: 200,
      trayDepth: 160,
      cornerRadius: 4,
      boundarySpacing: 5,
      boundarySpacingIndependent: true,
    };
    const graph = buildSteppedCadFeatureGraph(params);

    const lowLayer = graph.layers[0];
    const highGroup = graph.groups.find((g) => g.columnHeight === 20)!;

    // 最低层使用固定尺寸 200x160
    const [, lowMax] = measurements.measureBoundingBox(lowLayer.footprint);
    const [lowMin] = measurements.measureBoundingBox(lowLayer.footprint);
    expect(lowMax[0] - lowMin[0]).toBeCloseTo(200, 0);
    expect(lowMax[1] - lowMin[1]).toBeCloseTo(160, 0);

    // 高层不受 fixed sizing 影响（CONTEXT:603），仍由分组槽位包络决定
    const [, highMax] = measurements.measureBoundingBox(highGroup.footprint);
    const [highMin] = measurements.measureBoundingBox(highGroup.footprint);
    expect(highMax[0] - highMin[0]).toBeLessThan(200);
  });

  it("固定尺寸使用托盘左下角坐标系且报告固定外尺寸", () => {
    const params = {
      ...createParams(),
      footprintStyle: "rectangular" as const,
      traySizingMode: "fixed" as const,
      trayWidth: 200,
      trayDepth: 160,
      slots: [{
        ...createParams().slots[0],
        x: 25,
        y: 30,
      }],
      groups: [createParams().groups[0]],
    };

    const graph = buildSteppedCadFeatureGraph(params);

    expect(graph.trayWidth).toBe(200);
    expect(graph.trayDepth).toBe(160);
    expect(graph.slotHoles[0].cx).toBeCloseTo(-75, 6);
    expect(graph.slotHoles[0].cy).toBeCloseTo(-50, 6);
  });

  it("三个高度组的中层是各组矩形并集而不是跨组大包络", () => {
    const base = createParams();
    const params: SteppedLayoutParams = {
      ...base,
      footprintStyle: "rectangular",
      traySizingMode: "auto",
      boundarySpacing: 5,
      boundarySpacingIndependent: true,
      slots: [
        { ...base.slots[0], id: "slot-low", x: 20, groupId: "group-low" },
        { ...base.slots[0], id: "slot-mid", x: 120, groupId: "group-mid" },
        { ...base.slots[0], id: "slot-high", x: 220, groupId: "group-high" },
      ],
      groups: [
        { ...base.groups[0], id: "group-low", bottomHeight: 10 },
        { ...base.groups[0], id: "group-mid", bottomHeight: 20 },
        { ...base.groups[1], id: "group-high", bottomHeight: 30 },
      ],
    };

    const graph = buildSteppedCadFeatureGraph(params);
    const middleLayer = graph.layers.find(
      (layer) => layer.fromHeight === 10 && layer.toHeight === 20,
    );

    expect(middleLayer).toBeDefined();
    // 两个相距 100mm 的 35.4mm 方形包络并集面积约 2506mm²；
    // 若错误合并成跨组大矩形，面积会超过 4700mm²。
    expect(measurements.measureArea(middleLayer!.footprint)).toBeLessThan(3500);
  });

  it("底孔自动抬高组高度后仍生成全局连续最低层", () => {
    const base = createParams();
    const params: SteppedLayoutParams = {
      ...base,
      footprintStyle: "rectangular",
      traySizingMode: "auto",
      baseHoleStructure: "magnet-post-hole",
      magnetPostHoleDepth: 3,
      holeDepth: 6,
      groups: base.groups.map((group, index) => ({
        ...group,
        bottomHeight: index === 0 ? 3 : 12,
      })),
    };

    const graph = buildSteppedCadFeatureGraph(params);
    const firstLayer = graph.layers[0];
    const [min, max] = measurements.measureBoundingBox(firstLayer.footprint);

    expect(firstLayer.fromHeight).toBe(0);
    expect(max[0] - min[0]).toBeGreaterThan(70);
  });
});
