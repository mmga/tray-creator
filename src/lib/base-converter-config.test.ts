import { describe, expect, it } from "vitest";
import {
  BASE_CONVERTER_DEFAULTS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  getConversionRecessDimensions,
  isBaseConversionCompatible,
  normalizeBaseConverterParams,
} from "@/lib/base-converter-config";

describe("base converter config", () => {
  it("defines independent source and target standard catalogs", () => {
    expect(SOURCE_BASE_STANDARDS.map((item) => item.name)).toEqual([
      "20 × 20mm", "25 × 25mm", "40 × 40mm",
      "25 × 50mm", "50 × 75mm", "50 × 100mm",
    ]);
    expect(TARGET_BASE_STANDARDS.map((item) => item.name)).toEqual([
      "Ø25mm", "Ø32mm", "Ø50mm",
      "35 × 60mm", "42 × 75mm", "70 × 105mm",
    ]);
  });

  it("adds 0.2mm clearance on every side", () => {
    expect(getConversionRecessDimensions(SOURCE_BASE_STANDARDS[0])).toEqual({
      width: 20.4,
      depth: 20.4,
    });
  });

  it("filters targets that cannot retain material on both axes", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) => item.id === "source-50x100")!;
    expect(isBaseConversionCompatible(source, TARGET_BASE_STANDARDS[0])).toBe(false);
    expect(isBaseConversionCompatible(source, TARGET_BASE_STANDARDS.at(-1)!)).toBe(true);
  });

  it("normalizes invalid ids and incompatible pairs", () => {
    expect(normalizeBaseConverterParams({
      sourceStandardId: "source-50x100",
      targetStandardId: "target-circle-25",
      floorThickness: -10,
      recessDepth: Number.NaN,
    })).toEqual({
      sourceStandardId: "source-50x100",
      targetStandardId: "target-ellipse-70x105",
      floorThickness: 0.8,
      recessDepth: BASE_CONVERTER_DEFAULTS.recessDepth,
    });
  });
});
