import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";
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
      sourceStandardId: "source-50x100",
      targetStandardId: "target-ellipse-70x105",
      floorThickness: 1.2,
      recessDepth: 2,
    });
    const [min, max] = measurements.measureBoundingBox(geometry);

    expect(max[0] - min[0]).toBeCloseTo(70, 1);
    expect(max[1] - min[1]).toBeCloseTo(105, 1);
    expect(measurements.measureVolume(geometry)).toBeGreaterThan(0);
  });
});
