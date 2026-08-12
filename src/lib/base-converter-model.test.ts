import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import {
  BASE_CONVERTER_DEFAULTS,
  ROUND_BASE_STANDARDS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  createConversionGeometrySnapshot,
} from "@/lib/base-converter-config";
import { createBaseConverterModel } from "@/lib/base-converter-model";
import { getBaseConverterSTLFilename } from "@/lib/base-converter-model-service";

describe("base converter model", () => {
  it.each(ROUND_BASE_STANDARDS)(
    "builds plain $name with its snapshotted diameter and height",
    (standard) => {
      const geometry = createBaseConverterModel({
        ...BASE_CONVERTER_DEFAULTS,
        generationKind: "plain",
        roundBaseStandardId: standard.standardId,
        roundBaseSnapshot: standard,
      });
      const [min, max] = measurements.measureBoundingBox(geometry);

      expect(max[0] - min[0]).toBeCloseTo(standard.nominalDiameter, 5);
      expect(max[1] - min[1]).toBeCloseTo(standard.nominalDiameter, 5);
      expect(max[2] - min[2]).toBeCloseTo(standard.height, 5);
    },
  );

  it("cuts a centered through hex hole from a push-fit base", () => {
    const plain = createBaseConverterModel({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "plain",
    });
    const pushFit = createBaseConverterModel({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "push-fit",
    });
    const [plainMin, plainMax] = measurements.measureBoundingBox(plain);
    const [pushFitMin, pushFitMax] = measurements.measureBoundingBox(pushFit);

    pushFitMin.forEach((value, index) => {
      expect(value).toBeCloseTo(plainMin[index], 8);
    });
    pushFitMax.forEach((value, index) => {
      expect(value).toBeCloseTo(plainMax[index], 8);
    });
    expect(measurements.measureVolume(pushFit)).toBeLessThan(
      measurements.measureVolume(plain),
    );
    expect(
      measurements.measureVolume(plain) - measurements.measureVolume(pushFit),
    ).toBeCloseTo(18 * Math.sqrt(3), 3);
  });

  it("uses the editable top inset to taper a plain base", () => {
    const cylinder = createBaseConverterModel({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "plain",
      roundBaseSnapshot: {
        ...BASE_CONVERTER_DEFAULTS.roundBaseSnapshot,
        topInset: 0,
      },
    });
    const tapered = createBaseConverterModel({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "plain",
    });

    expect(measurements.measureVolume(tapered)).toBeLessThan(
      measurements.measureVolume(cylinder),
    );
    expect(measurements.measureBoundingBox(tapered)).toEqual(
      measurements.measureBoundingBox(cylinder),
    );
  });

  it("builds the selected target footprint and preserves the recess floor", () => {
    const geometry = createBaseConverterModel(BASE_CONVERTER_DEFAULTS);
    const [min, max] = measurements.measureBoundingBox(geometry);

    expect(max[0] - min[0]).toBeCloseTo(25, 1);
    expect(max[1] - min[1]).toBeCloseTo(25, 1);
    expect(max[2] - min[2]).toBeCloseTo(3.2, 2);
    expect(measurements.measureVolume(geometry)).toBeCloseTo(767.696165, 5);
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
    expect(max[2] - min[2]).toBeCloseTo(3.2, 2);
    expect(measurements.measureVolume(geometry)).toBeCloseTo(10205.239049, 5);
  });

  it("creates a circular recess for round-to-round conversion", () => {
    const target = TARGET_BASE_STANDARDS.find((item) =>
      item.id === "target-circle-25")!;
    const roundSource = SOURCE_BASE_STANDARDS.find((item) =>
      item.id === "source-circle-20")!;
    const squareSource = SOURCE_BASE_STANDARDS.find((item) =>
      item.id === "source-20x20")!;
    const roundGeometry = createBaseConverterModel({
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: roundSource.id,
      geometrySnapshot: createConversionGeometrySnapshot(roundSource, target),
    });
    const squareGeometry = createBaseConverterModel({
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: squareSource.id,
      geometrySnapshot: createConversionGeometrySnapshot(squareSource, target),
    });

    expect(measurements.measureVolume(roundGeometry))
      .toBeGreaterThan(measurements.measureVolume(squareGeometry));
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

  it("keeps the historical conversion STL filename", () => {
    expect(getBaseConverterSTLFilename(BASE_CONVERTER_DEFAULTS))
      .toBe("base-converter-20x20-to-circle-25.stl");
  });

  it("uses stable filenames for ordinary and offset push-fit bases", () => {
    expect(getBaseConverterSTLFilename({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "plain",
    })).toBe("base-plain-32mm.stl");
    expect(getBaseConverterSTLFilename({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "push-fit",
      pushFitHexHole: { acrossFlats: 3, offsetX: 1.2, offsetY: -0.8 },
    })).toBe("base-push-fit-32mm-hex-3mm-x1.2-y-0.8.stl");
  });
});
