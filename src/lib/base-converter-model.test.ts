import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import {
  BASE_CONVERTER_DEFAULTS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  createConversionGeometrySnapshot,
} from "@/lib/base-converter-config";
import { createBaseConverterModel } from "@/lib/base-converter-model";

describe("base converter model", () => {
  it("builds the selected target footprint and preserves the recess floor", () => {
    const geometry = createBaseConverterModel(BASE_CONVERTER_DEFAULTS);
    const [min, max] = measurements.measureBoundingBox(geometry);

    expect(max[0] - min[0]).toBeCloseTo(25, 1);
    expect(max[1] - min[1]).toBeCloseTo(25, 1);
    expect(max[2] - min[2]).toBeCloseTo(3.2, 2);
    expect(measurements.measureVolume(geometry)).toBeGreaterThan(0);
  });

  it("creates the reference 50x100 to 70x105 oval conversion", () => {
    const geometry = createBaseConverterModel({
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: "source-50x100",
      targetStandardId: "target-ellipse-70x105",
      geometrySnapshot: createConversionGeometrySnapshot(
        SOURCE_BASE_STANDARDS.find((item) => item.id === "source-50x100")!,
        TARGET_BASE_STANDARDS.find((item) => item.id === "target-ellipse-70x105")!,
      ),
    });
    const [min, max] = measurements.measureBoundingBox(geometry);

    expect(max[0] - min[0]).toBeCloseTo(70, 1);
    expect(max[1] - min[1]).toBeCloseTo(105, 1);
    expect(measurements.measureVolume(geometry)).toBeGreaterThan(0);
  });

  it("uses the target fullness exponent instead of a fixed ellipse", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) => item.id === "source-20x20")!;
    const target = TARGET_BASE_STANDARDS.find((item) => item.id === "target-ellipse-35x60")!;
    const ellipseParams = {
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: source.id,
      targetStandardId: target.id,
      geometrySnapshot: {
        ...createConversionGeometrySnapshot(source, target),
        target: {
          ...createConversionGeometrySnapshot(source, target).target,
          profileExponent: 2,
        },
      },
    };
    const fullerParams = {
      ...ellipseParams,
      geometrySnapshot: {
        ...ellipseParams.geometrySnapshot,
        target: {
          ...ellipseParams.geometrySnapshot.target,
          profileExponent: 4,
        },
      },
    };

    expect(measurements.measureVolume(createBaseConverterModel(fullerParams)))
      .toBeGreaterThan(
        measurements.measureVolume(createBaseConverterModel(ellipseParams)),
      );
  });

  it("applies source corner radius and side bevel to the actual solid", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) => item.id === "source-25x25")!;
    const target = TARGET_BASE_STANDARDS.find((item) => item.id === "target-circle-40")!;
    const squareParams = {
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: source.id,
      targetStandardId: target.id,
      geometrySnapshot: createConversionGeometrySnapshot(source, target),
    };
    const roundedParams = {
      ...squareParams,
      geometrySnapshot: {
        ...squareParams.geometrySnapshot,
        source: {
          ...squareParams.geometrySnapshot.source,
          cornerRadius: 5,
        },
      },
    };
    const beveledParams = {
      ...roundedParams,
      sideBevelWidth: 2,
    };
    const squareVolume = measurements.measureVolume(
      createBaseConverterModel(squareParams),
    );
    const roundedVolume = measurements.measureVolume(
      createBaseConverterModel(roundedParams),
    );
    const beveledVolume = measurements.measureVolume(
      createBaseConverterModel(beveledParams),
    );

    expect(roundedVolume).toBeGreaterThan(squareVolume);
    expect(beveledVolume).toBeLessThan(roundedVolume);
  });

  it("rejects incompatible axis dimensions before generating a solid", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) => item.id === "source-50x100")!;
    const target = TARGET_BASE_STANDARDS.find((item) => item.id === "target-circle-50")!;

    expect(() =>
      createBaseConverterModel({
        ...BASE_CONVERTER_DEFAULTS,
        sourceStandardId: source.id,
        targetStandardId: target.id,
        geometrySnapshot: createConversionGeometrySnapshot(source, target),
      }),
    ).toThrow("源底座凹槽不小于目标底座");
  });
});
