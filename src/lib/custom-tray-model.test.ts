import { describe, expect, it } from "vitest";
import { geometries, measurements } from "@jscad/modeling";
import stlSerializer from "@jscad/stl-serializer";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { createCircleSlotSnapshot } from "@/lib/slot-definitions";
import {
  calculateCustomTrayDimensions,
  createCustomTrayModel,
} from "@/lib/custom-tray-model";
import {
  constructCustomContouredFootprintOutcome,
  projectCustomContouredFootprintInput,
} from "@/lib/custom-contoured-footprint";
import type { CustomLayoutParams } from "@/types/custom-tray";
import { createCustomBaseHoleConstructionPlan } from "@/lib/base-hole-planning";

const { measureBoundingBox, measureVolume } = measurements;
const { geom3 } = geometries;

function readyState(params: CustomLayoutParams) {
  const outcome = constructCustomContouredFootprintOutcome(
    projectCustomContouredFootprintInput(params),
  );
  if (!outcome.ok) throw new Error(outcome.error.message);
  return { status: "ready" as const, value: outcome.value };
}

function measureBoundsAtZ(
  model: ReturnType<typeof createCustomTrayModel>,
  z: number,
) {
  const points = geom3
    .toPoints(model)
    .flat()
    .filter((point) => Math.abs(point[2] - z) < 1e-5);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);

  return {
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...ys) - Math.min(...ys),
  };
}

function createCustomCircleSlot(
  id: string,
  x: number,
  y: number,
  baseDiameter: number,
) {
  return {
    id,
    x,
    y,
    width: baseDiameter,
    height: baseDiameter,
    rotation: 0,
    shape: "circle" as const,
    ...createCircleSlotSnapshot(baseDiameter),
  };
}

describe("custom tray model", () => {
  it("直边底板由带圆角的真实轮廓拉伸并导出有效 STL，固定长宽和斜角休眠", async () => {
    const params: CustomLayoutParams = { ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "polygonal", traySizingMode: "fixed", trayWidth: 300, trayDepth: 250,
      cornerRadius: 10, sideBevelWidth: 8,
      slots: [createCustomCircleSlot("a", 0, 0, 25),
        createCustomCircleSlot("b", 60, 0, 25), createCustomCircleSlot("c", 30, 50, 25)] };
    const state = readyState(params);
    const model = createCustomTrayModel(params, state);
    const [min, max] = measureBoundingBox(model);
    expect(measureVolume(model)).toBeGreaterThan(0);
    expect(max[0] - min[0]).toBeCloseTo(state.value.bounds!.maxX - state.value.bounds!.minX, 5);
    expect(max[1] - min[1]).toBeCloseTo(state.value.bounds!.maxY - state.value.bounds!.minY, 5);
    expect(max[2] - min[2]).toBeCloseTo(params.baseThickness + params.holeDepth, 5);
    const buffer = await new Blob(stlSerializer.serialize({ binary: true }, model) as BlobPart[]).arrayBuffer();
    const view = new DataView(buffer);
    const triangles = view.getUint32(80, true);
    expect(triangles).toBeGreaterThan(0);
    expect(buffer.byteLength).toBe(84 + triangles * 50);
    const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < triangles; i++) {
      for (let vertex = 0; vertex < 3; vertex++) {
        for (let axis = 0; axis < 3; axis++) {
          const value = view.getFloat32(84 + i * 50 + 12 + vertex * 12 + axis * 4, true);
          expect(Number.isFinite(value)).toBe(true);
          low[axis] = Math.min(low[axis], value);
          high[axis] = Math.max(high[axis], value);
        }
      }
    }
    // STL 序列化会吸附顶点，检查误差仍远小于界面 0.1mm 的显示精度。
    for (let axis = 0; axis < 3; axis++) expect(Math.abs(high[axis] - low[axis] - (max[axis] - min[axis]))).toBeLessThan(0.01);
    expect(() => createCustomTrayModel(params)).toThrow();
  });

  it("falls back to configured tray dimensions when there are no slots", () => {
    expect(calculateCustomTrayDimensions(CUSTOM_LAYOUT_DEFAULTS)).toEqual({
      width: 260,
      depth: 260,
      height: 6,
    });
  });

  it("uses fixed outer dimensions without recentering placed slots", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      traySizingMode: "fixed" as const,
      trayWidth: 100,
      trayDepth: 80,
      cornerRadius: 0,
      slots: [createCustomCircleSlot("slot-1", 20, 30, 20)],
    };
    const model = createCustomTrayModel(params);
    const [[minX, minY], [maxX, maxY]] = measureBoundingBox(model);
    const slotLeftEdgeX = -50 + 20 - 10.2;
    const slotCenterY = -40 + 30;

    expect(calculateCustomTrayDimensions(params)).toEqual({
      width: 100,
      depth: 80,
      height: 6,
    });
    expect(maxX - minX).toBeCloseTo(100, 5);
    expect(maxY - minY).toBeCloseTo(80, 5);
    expect(
      geom3.toPoints(model).flat().some(
        (point) =>
          Math.abs(point[0] - slotLeftEdgeX) < 1e-5 &&
          Math.abs(point[1] - slotCenterY) < 1e-5,
      ),
    ).toBe(true);
  });

  it("insets the custom tray top edge by the configured side bevel width", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      sideBevelWidth: 4,
    };
    const model = createCustomTrayModel(params);
    const dimensions = calculateCustomTrayDimensions(params);
    const lowerBounds = measureBoundsAtZ(model, 0);
    const upperBounds = measureBoundsAtZ(model, dimensions.height);

    expect(lowerBounds.width).toBeCloseTo(dimensions.width, 5);
    expect(lowerBounds.depth).toBeCloseTo(dimensions.depth, 5);
    expect(upperBounds.width).toBeCloseTo(dimensions.width - 8, 5);
    expect(upperBounds.depth).toBeCloseTo(dimensions.depth - 8, 5);
  });

  it("derives occupied bounds from rotated slots and boundary spacing", () => {
    const dimensions = calculateCustomTrayDimensions({
      ...CUSTOM_LAYOUT_DEFAULTS,
      spacing: 8,
      boundarySpacingIndependent: true,
      boundarySpacing: 10,
      slots: [
        {
          id: "slot-1",
          x: 10,
          y: 10,
          width: 40,
          height: 20,
          rotation: 0,
          shape: "ellipse",
        },
        {
          id: "slot-2",
          x: 80,
          y: 20,
          width: 30,
          height: 50,
          rotation: 90,
          shape: "ellipse",
        },
      ],
    });

    expect(dimensions.width).toBe(135.4);
    expect(dimensions.depth).toBe(55.4);
    expect(dimensions.height).toBe(6);
  });

  it("calculates the custom tray dimensions", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      spacing: 5,
      boundarySpacing: 5,
      boundarySpacingIndependent: true,
      slots: [
        createCustomCircleSlot("slot-1", 20, 40, 25),
        createCustomCircleSlot("slot-2", 55, 40, 25),
      ],
    };

    expect(calculateCustomTrayDimensions(params)).toEqual({
      width: 70.4,
      depth: 35.4,
      height: 6,
    });
  });

  it("keeps positive volume and removes more material when enabling base holes", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseThickness: 3.2,
      baseHoleStructure: "magnetic-base-hole" as const,
      baseHoleSize: "25" as const,
      slots: [
        {
          id: "slot-1",
          x: 30,
          y: 40,
          width: 40,
          height: 20,
          rotation: 30,
          shape: "ellipse" as const,
        },
      ],
    };
    const plainModel = createCustomTrayModel({ ...params, baseHoleStructure: "none" });
    const baseHoleModel = createCustomTrayModel(params);

    const plainVolume = measureVolume(plainModel);
    const baseHoleVolume = measureVolume(baseHoleModel);
    const [[minX, minY, minZ], [maxX, maxY, maxZ]] =
      measureBoundingBox(baseHoleModel);
    const dimensions = calculateCustomTrayDimensions(params);

    expect(plainVolume).toBeGreaterThan(0);
    expect(baseHoleVolume).toBeGreaterThan(0);
    expect(baseHoleVolume).toBeLessThan(plainVolume);
    expect(maxX - minX).toBeCloseTo(dimensions.width, 1);
    expect(maxY - minY).toBeCloseTo(dimensions.depth, 1);
    expect(maxZ - minZ).toBeCloseTo(dimensions.height, 1);
  });

  it("从每个自定义槽底向下切出磁铁桩孔", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseThickness: 3,
      baseHoleStructure: "magnet-post-hole" as const,
      magnetPostHoleDiameter: 5,
      magnetPostHoleDepth: 2,
      slots: [createCustomCircleSlot("slot-post", 40, 40, 25)],
    };
    const plainModel = createCustomTrayModel({ ...params, baseHoleStructure: "none" });
    const postModel = createCustomTrayModel(params);

    expect(measureVolume(postModel)).toBeLessThan(measureVolume(plainModel));
  });

  it("auto-selects the magnet hole preset from the largest slot size instead of the stored field", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseThickness: 4,
      baseHoleStructure: "magnetic-base-hole" as const,
      baseHoleSize: "25" as const,
      slots: [
        {
          id: "slot-1",
          x: 80,
          y: 80,
          width: 120,
          height: 92,
          rotation: 0,
          shape: "ellipse" as const,
        },
      ],
    };

    const autoResolvedModel = createCustomTrayModel(params);
    const legacyFieldModel = createCustomTrayModel({
      ...params,
      baseHoleSize: "40" as const,
    });

    expect(measureVolume(autoResolvedModel)).toBeCloseTo(
      measureVolume(legacyFieldModel),
      5,
    );
  });

  it("still cuts a magnet hole for 65mm custom slots when base holes are enabled", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseThickness: 2.4,
      baseHoleStructure: "magnetic-base-hole" as const,
      baseHoleSize: "25" as const,
      slots: [
        {
          id: "slot-1",
          x: 80,
          y: 80,
          width: 65,
          height: 65,
          rotation: 0,
          shape: "circle" as const,
        },
      ],
    };

    const plainModel = createCustomTrayModel({ ...params, baseHoleStructure: "none" });
    const baseHoleModel = createCustomTrayModel(params);

    expect(measureVolume(baseHoleModel)).toBeLessThan(measureVolume(plainModel));
  });

  it("uses slot-level ellipse geometry instead of a global fullness parameter", () => {
    const shallowEllipse = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      slots: [
        {
          id: "slot-1",
          x: 60,
          y: 50,
          width: 90,
          height: 52,
          rotation: 45,
          shape: "ellipse" as const,
          outerOffset: 0.4,
          profileExponent: 2.2,
        },
      ],
    };
    const fullerEllipse = {
      ...shallowEllipse,
      slots: [
        {
          ...shallowEllipse.slots[0],
          outerOffset: 0.9,
          profileExponent: 3.8,
        },
      ],
    };

    const baselineEllipse = {
      ...shallowEllipse,
      slots: [
        {
          ...shallowEllipse.slots[0],
          outerOffset: undefined,
          profileExponent: undefined,
        },
      ],
    };

    const baselineDimensions = calculateCustomTrayDimensions(baselineEllipse);
    const shallowDimensions = calculateCustomTrayDimensions(shallowEllipse);
    const fullerDimensions = calculateCustomTrayDimensions(fullerEllipse);
    const shallowVolume = measureVolume(createCustomTrayModel(shallowEllipse));
    const fullerVolume = measureVolume(createCustomTrayModel(fullerEllipse));

    expect(shallowDimensions.width).not.toBeCloseTo(baselineDimensions.width);
    expect(shallowDimensions.depth).not.toBeCloseTo(baselineDimensions.depth);
    expect(fullerDimensions.width).toBeGreaterThan(shallowDimensions.width);
    expect(fullerDimensions.depth).toBeGreaterThan(shallowDimensions.depth);
    expect(fullerVolume).toBeGreaterThan(shallowVolume);
  });

  it("contoured footprint 生成正体积模型且不应用圆角与侧面斜角", () => {
    const contouredParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured" as const,
      cornerRadius: 8,
      sideBevelWidth: 4,
      slots: [createCustomCircleSlot("a", 0, 0, 25)],
    };
    const rectangularParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "rectangular" as const,
      cornerRadius: 8,
      sideBevelWidth: 4,
      slots: [createCustomCircleSlot("a", 0, 0, 25)],
    };

    const state = readyState(contouredParams);
    const contouredModel = createCustomTrayModel(contouredParams, state);
    const rectangularModel = createCustomTrayModel(rectangularParams);

    expect(measureVolume(contouredModel)).toBeGreaterThan(0);
    expect(measureVolume(rectangularModel)).toBeGreaterThan(0);
    // contoured 不应用 side bevel，底面积应小于 rectangular（rectangular 因 bevel 外扩）
    const contouredDims = calculateCustomTrayDimensions(contouredParams, state);
    const rectangularDims = calculateCustomTrayDimensions(rectangularParams);
    expect(rectangularDims.width).toBeGreaterThan(contouredDims.width);
  });

  it("contoured footprint 远距离多槽生成可打印模型", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured" as const,
      slots: [
        createCustomCircleSlot("a", 0, 0, 25),
        createCustomCircleSlot("b", 200, 200, 25),
      ],
    };
    const model = createCustomTrayModel(params, readyState(params));
    expect(measureVolume(model)).toBeGreaterThan(0);
  });

  it("builds a stackable box body for rectangular footprint with user outer dimensions", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "rectangular" as const,
      stackableBox: {
        ...CUSTOM_LAYOUT_DEFAULTS.stackableBox!,
        enabled: true,
        outerWidth: 120,
        outerDepth: 100,
        outerHeight: 50,
        minimumWallClearance: 2,
      },
      slots: [createCustomCircleSlot("slot-1", 60, 50, 25)],
    };
    const model = createCustomTrayModel(params);
    const [[minX, minY, minZ], [maxX, maxY, maxZ]] = measureBoundingBox(model);

    expect(maxX - minX).toBeCloseTo(120, 2);
    expect(maxY - minY).toBeCloseTo(100, 2);
    expect(maxZ - minZ).toBeCloseTo(50, 2);
    expect(measureVolume(model)).toBeGreaterThan(0);
  });

  it("builds an empty stackable box without slots", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "rectangular" as const,
      stackableBox: {
        ...CUSTOM_LAYOUT_DEFAULTS.stackableBox!,
        enabled: true,
        outerWidth: 80,
        outerDepth: 60,
        outerHeight: 40,
      },
      slots: [],
    };
    const model = createCustomTrayModel(params);
    expect(measureVolume(model)).toBeGreaterThan(0);
  });

  it("projects box base holes from the box center even when tray sizing is auto", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseHoleStructure: "magnet-post-hole" as const,
      footprintStyle: "rectangular" as const,
      stackableBox: {
        ...CUSTOM_LAYOUT_DEFAULTS.stackableBox!,
        enabled: true,
        outerWidth: 200,
        outerDepth: 150,
        outerHeight: 50,
      },
      slots: [
        createCustomCircleSlot("a", 40, 30, 25),
        createCustomCircleSlot("b", 120, 100, 25),
      ],
    };
    const plan = createCustomBaseHoleConstructionPlan(params);
    expect(plan.instructions.map((instruction) => [instruction.x, instruction.y])).toEqual([
      [-60, -45],
      [20, 25],
    ]);
  });
});
