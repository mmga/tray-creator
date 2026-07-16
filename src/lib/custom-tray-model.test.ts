import { describe, expect, it } from "vitest";
import { geometries, measurements } from "@jscad/modeling";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { createCircleSlotSnapshot } from "@/lib/slot-definitions";
import {
  calculateCustomTrayDimensions,
  calculateCustomEffectiveBaseplate,
  createCustomTrayModel,
} from "@/lib/custom-tray-model";

const { measureBoundingBox, measureVolume } = measurements;
const { geom3 } = geometries;

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

    expect(dimensions.width).toBe(135.8);
    expect(dimensions.depth).toBe(55.8);
    expect(dimensions.height).toBe(6);
  });

  it("exports the effective custom baseplate footprint for pricing reuse", () => {
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

    expect(calculateCustomEffectiveBaseplate(params)).toEqual({
      hasSlots: true,
      width: 70.2,
      depth: 35.2,
      minX: 7.4,
      maxX: 67.6,
      minY: 27.4,
      maxY: 52.6,
    });
    expect(calculateCustomTrayDimensions(params)).toEqual({
      width: 70.2,
      depth: 35.2,
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
});
