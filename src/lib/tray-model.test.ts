import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import stlSerializer from "@jscad/stl-serializer";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import {
  calculateTrayDimensions,
  createTrayModel,
  getGridBoundarySpacingAxes,
  getGridSpacingAxes,
} from "@/lib/tray-model";

const { measureBoundingBox, measureVolume } = measurements;

function getSerializedStlByteLength(model: ReturnType<typeof createTrayModel>) {
  return (stlSerializer.serialize({ binary: true }, model) as BlobPart[])
    .reduce((total, chunk) => {
      if (typeof chunk === "string") {
        return total + chunk.length;
      }
      if (chunk instanceof ArrayBuffer) {
        return total + chunk.byteLength;
      }
      if (chunk instanceof Blob) {
        return total + chunk.size;
      }
      return total + chunk.byteLength;
    }, 0);
}

describe("tray model", () => {
  it("derives spacing axes from unified and independent spacing settings", () => {
    expect(getGridSpacingAxes(DEFAULT_TRAY_PARAMS)).toEqual({
      spacingX: 5,
      spacingY: 5,
    });

    expect(
      getGridSpacingAxes({
        ...DEFAULT_TRAY_PARAMS,
        spacingIndependent: true,
        spacingX: 7,
        spacingY: 9,
      }),
    ).toEqual({
      spacingX: 7,
      spacingY: 9,
    });
  });

  it("derives boundary spacing axes from the configured mode", () => {
    expect(getGridBoundarySpacingAxes(DEFAULT_TRAY_PARAMS)).toEqual({
      boundarySpacingX: 5,
      boundarySpacingY: 5,
    });

    expect(
      getGridBoundarySpacingAxes({
        ...DEFAULT_TRAY_PARAMS,
        spacingIndependent: true,
        spacingX: 6,
        spacingY: 8,
        boundarySpacingIndependent: true,
        boundarySpacing: 11,
      }),
    ).toEqual({
      boundarySpacingX: 11,
      boundarySpacingY: 11,
    });
  });

  it("calculates tray dimensions from spacing and boundary rules", () => {
    const dimensions = calculateTrayDimensions({
      ...DEFAULT_TRAY_PARAMS,
      rows: 2,
      columns: 3,
      holeDiameter: 32,
    });

    expect(dimensions.width).toBeCloseTo(117.2, 5);
    expect(dimensions.depth).toBeCloseTo(79.8, 5);
    expect(dimensions.height).toBe(6);
  });

  it("uses the stored circular slot size snapshot for grid dimensions", () => {
    const dimensions = calculateTrayDimensions({
      ...DEFAULT_TRAY_PARAMS,
      rows: 1,
      columns: 2,
      holeDiameter: 32,
      slotDiameter: 33,
      spacing: 5,
      boundarySpacing: 5,
    });

    expect(dimensions.width).toBeCloseTo(81, 5);
    expect(dimensions.depth).toBeCloseTo(43, 5);
  });

  it("calculates base-plate-only trays with the same footprint and base height", () => {
    const dimensions = calculateTrayDimensions({
      ...DEFAULT_TRAY_PARAMS,
      rows: 2,
      columns: 3,
      holeDiameter: 32,
      baseThickness: 3.4,
      holeDepth: 4,
      basePlateOnly: true,
    });

    expect(dimensions.width).toBeCloseTo(117.2, 5);
    expect(dimensions.depth).toBeCloseTo(79.8, 5);
    expect(dimensions.height).toBe(3.4);
  });

  it("keeps positive volume and removes more material when enabling base holes", () => {
    const params = {
      ...DEFAULT_TRAY_PARAMS,
      rows: 2,
      columns: 2,
      baseThickness: 3.2,
      holeDepth: 3,
      enableBaseHole: true as const,
      baseHoleSize: "25" as const,
    };
    const plainModel = createTrayModel({ ...params, enableBaseHole: false });
    const baseHoleModel = createTrayModel(params);

    const plainVolume = measureVolume(plainModel);
    const baseHoleVolume = measureVolume(baseHoleModel);
    const [[minX, minY, minZ], [maxX, maxY, maxZ]] =
      measureBoundingBox(baseHoleModel);
    const dimensions = calculateTrayDimensions(params);

    expect(plainVolume).toBeGreaterThan(0);
    expect(baseHoleVolume).toBeGreaterThan(0);
    expect(baseHoleVolume).toBeLessThan(plainVolume);
    expect(maxX - minX).toBeCloseTo(dimensions.width, 1);
    expect(maxY - minY).toBeCloseTo(dimensions.depth, 1);
    expect(maxZ - minZ).toBeCloseTo(dimensions.height, 1);
  });

  it("auto-selects the magnet hole preset from the slot diameter instead of the stored field", () => {
    const params = {
      ...DEFAULT_TRAY_PARAMS,
      rows: 1,
      columns: 1,
      holeDiameter: 90,
      baseThickness: 4,
      enableBaseHole: true as const,
      baseHoleSize: "25" as const,
    };

    const autoResolvedModel = createTrayModel(params);
    const legacyFieldModel = createTrayModel({
      ...params,
      baseHoleSize: "40" as const,
    });

    expect(measureVolume(autoResolvedModel)).toBeCloseTo(
      measureVolume(legacyFieldModel),
      5,
    );
  });

  it("still cuts a magnet hole for 65mm slots when base holes are enabled", () => {
    const params = {
      ...DEFAULT_TRAY_PARAMS,
      rows: 1,
      columns: 1,
      holeDiameter: 65,
      baseThickness: 2.4,
      enableBaseHole: true as const,
      baseHoleSize: "25" as const,
    };

    const plainModel = createTrayModel({ ...params, enableBaseHole: false });
    const baseHoleModel = createTrayModel(params);

    expect(measureVolume(baseHoleModel)).toBeLessThan(measureVolume(plainModel));
  });

  it("keeps the 65mm magnet cavity in serialized STL output", () => {
    const params = {
      ...DEFAULT_TRAY_PARAMS,
      rows: 1,
      columns: 1,
      holeDiameter: 65,
      baseThickness: 2.4,
      enableBaseHole: true as const,
    };

    const plainModel = createTrayModel({ ...params, enableBaseHole: false });
    const baseHoleModel = createTrayModel(params);

    expect(getSerializedStlByteLength(baseHoleModel)).toBeGreaterThan(
      getSerializedStlByteLength(plainModel),
    );
  });

  it("keeps single-row half-circle trays at the same footprint with less upper material", () => {
    const params = {
      ...DEFAULT_TRAY_PARAMS,
      rows: 1,
      columns: 3,
      holeDiameter: 32,
      halfCircleSlots: false,
    };
    const fullModel = createTrayModel(params);
    const halfModel = createTrayModel({ ...params, halfCircleSlots: true });
    const fullBounds = measureBoundingBox(fullModel);
    const halfBounds = measureBoundingBox(halfModel);
    const dimensions = calculateTrayDimensions(params);

    expect(halfBounds[1][0] - halfBounds[0][0]).toBeCloseTo(dimensions.width, 1);
    expect(halfBounds[1][1] - halfBounds[0][1]).toBeCloseTo(dimensions.depth, 1);
    expect(halfBounds[1][2] - halfBounds[0][2]).toBeCloseTo(dimensions.height, 1);
    expect(halfBounds).toEqual(fullBounds);
    expect(measureVolume(halfModel)).toBeLessThan(measureVolume(fullModel));
    expect(measureVolume(halfModel)).toBeGreaterThan(
      dimensions.width * dimensions.depth * params.baseThickness * 0.9,
    );
  });

  it("supports half-circle trays for single-column grids", () => {
    const params = {
      ...DEFAULT_TRAY_PARAMS,
      rows: 3,
      columns: 1,
      holeDiameter: 32,
      halfCircleSlots: false,
    };
    const fullModel = createTrayModel(params);
    const halfModel = createTrayModel({ ...params, halfCircleSlots: true });
    const fullBounds = measureBoundingBox(fullModel);
    const halfBounds = measureBoundingBox(halfModel);
    const dimensions = calculateTrayDimensions(params);

    expect(halfBounds[1][0] - halfBounds[0][0]).toBeCloseTo(dimensions.width, 1);
    expect(halfBounds[1][1] - halfBounds[0][1]).toBeCloseTo(dimensions.depth, 1);
    expect(halfBounds[1][2] - halfBounds[0][2]).toBeCloseTo(dimensions.height, 1);
    expect(halfBounds).toEqual(fullBounds);
    expect(measureVolume(halfModel)).toBeLessThan(measureVolume(fullModel));
    expect(measureVolume(halfModel)).toBeGreaterThan(
      dimensions.width * dimensions.depth * params.baseThickness * 0.9,
    );
  });

  it("ignores half-circle slots when grid has multiple rows", () => {
    const params = {
      ...DEFAULT_TRAY_PARAMS,
      rows: 2,
      columns: 3,
      halfCircleSlots: false,
    };

    expect(
      measureVolume(createTrayModel({ ...params, halfCircleSlots: true })),
    ).toBeCloseTo(measureVolume(createTrayModel(params)), 5);
  });

  it("generates only the embedded-hole base plate when base-plate-only mode is enabled", () => {
    const params = {
      ...DEFAULT_TRAY_PARAMS,
      rows: 2,
      columns: 2,
      baseThickness: 3.2,
      holeDepth: 4,
      enableBaseHole: true as const,
      basePlateOnly: true,
      halfCircleSlots: true,
    };
    const fullModel = createTrayModel({
      ...params,
      basePlateOnly: false,
      halfCircleSlots: false,
    });
    const baseOnlyModel = createTrayModel(params);
    const noMagnetBaseOnlyModel = createTrayModel({
      ...params,
      enableBaseHole: false,
    });
    const [[minX, minY, minZ], [maxX, maxY, maxZ]] =
      measureBoundingBox(baseOnlyModel);
    const dimensions = calculateTrayDimensions(params);

    expect(maxX - minX).toBeCloseTo(dimensions.width, 1);
    expect(maxY - minY).toBeCloseTo(dimensions.depth, 1);
    expect(maxZ - minZ).toBeCloseTo(params.baseThickness, 1);
    expect(dimensions.height).toBe(params.baseThickness);
    expect(measureVolume(baseOnlyModel)).toBeLessThan(measureVolume(fullModel));
    expect(measureVolume(baseOnlyModel)).toBeCloseTo(
      measureVolume(noMagnetBaseOnlyModel),
      5,
    );
  });
});
