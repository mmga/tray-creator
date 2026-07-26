import { describe, expect, it } from "vitest";
import {
  BASE_CONVERTER_DEFAULTS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  getMaxBaseConverterSideBevelWidth,
  getConversionRecessDimensions,
  isBaseConversionCompatible,
  normalizeBaseConverterParams,
} from "@/lib/base-converter-config";

describe("base converter config", () => {
  it("defines independent source and target standard catalogs", () => {
    expect(SOURCE_BASE_STANDARDS.map((item) => item.name)).toEqual([
      "20 × 20mm", "25 × 25mm", "40 × 40mm",
      "25 × 50mm", "50 × 75mm", "50 × 100mm",
      "Ø20mm", "Ø25mm", "Ø32mm", "Ø40mm",
    ]);
    expect(TARGET_BASE_STANDARDS.map((item) => item.name)).toEqual([
      "Ø25mm", "Ø32mm", "Ø40mm", "Ø50mm",
      "35 × 60mm", "42 × 75mm", "70 × 105mm",
    ]);
  });

  it("adds 0.2mm clearance on every side", () => {
    expect(getConversionRecessDimensions(SOURCE_BASE_STANDARDS[0])).toEqual({
      width: 20.4,
      depth: 20.4,
    });
  });

  it("provides circular source standards for round-to-round conversion", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) => item.id === "source-circle-20")!;
    const target = TARGET_BASE_STANDARDS.find((item) => item.id === "target-circle-25")!;

    expect(source.shape).toBe("circle");
    expect(getConversionRecessDimensions(source)).toEqual({
      width: 20.4,
      depth: 20.4,
    });
    expect(isBaseConversionCompatible(source, target)).toBe(true);
  });

  it("provides a 40mm circular target standard", () => {
    expect(TARGET_BASE_STANDARDS).toContainEqual({
      id: "target-circle-40",
      name: "Ø40mm",
      shape: "circle",
      width: 40,
      depth: 40,
    });
  });

  it("limits the side bevel so the recess keeps a top wall", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) => item.id === "source-circle-20")!;
    const target = TARGET_BASE_STANDARDS.find((item) => item.id === "target-circle-25")!;

    expect(getMaxBaseConverterSideBevelWidth(source, target)).toBeCloseTo(2.2);
    expect(normalizeBaseConverterParams({
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: source.id,
      targetStandardId: target.id,
      sideBevelWidth: 10,
    }).sideBevelWidth).toBeCloseTo(2.2);
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
      sideBevelWidth: 0,
    });
  });
});
