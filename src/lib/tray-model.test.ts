import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import {
  calculateTrayDimensions,
  createTrayModel,
  getGridBoundarySpacingAxes,
  getGridSpacingAxes,
} from "@/lib/tray-model";

const { measureBoundingBox, measureVolume } = measurements;

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
});
