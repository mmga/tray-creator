import { describe, expect, it } from "vitest";
import {
  BASE_CONVERTER_DEFAULTS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  createConversionGeometrySnapshot,
  getConversionRecessDimensions,
  isBaseConversionCompatible,
  normalizeBaseConverterParams,
  validateBaseConverterParams,
} from "@/lib/base-converter-config";

describe("base converter config", () => {
  it("defines independent source and target standard catalogs", () => {
    expect(SOURCE_BASE_STANDARDS.map((item) => item.name)).toEqual([
      "20 × 20mm", "25 × 25mm", "40 × 40mm",
      "25 × 50mm", "50 × 75mm", "50 × 100mm",
    ]);
    expect(TARGET_BASE_STANDARDS.map((item) => item.name)).toEqual([
      "Ø25mm", "Ø28.5mm", "Ø32mm", "Ø40mm", "Ø50mm",
      "35 × 60mm", "42 × 75mm", "70 × 105mm",
    ]);
    expect(
      TARGET_BASE_STANDARDS
        .filter((item) => item.shape === "ellipse")
        .map((item) => item.profileExponent),
    ).toEqual([2.05, 2.08, 2.6]);
  });

  it("adds uniform clearance to dimensions and corner radius", () => {
    expect(getConversionRecessDimensions(SOURCE_BASE_STANDARDS[0])).toEqual({
      width: 20.4,
      depth: 20.4,
      cornerRadius: 0.2,
    });
  });

  it("filters targets that cannot retain material on both axes", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) => item.id === "source-50x100")!;
    expect(isBaseConversionCompatible(source, TARGET_BASE_STANDARDS[0])).toBe(false);
    expect(isBaseConversionCompatible(source, TARGET_BASE_STANDARDS.at(-1)!)).toBe(true);
  });

  it("normalizes invalid ids but preserves a recognized incompatible pair", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) => item.id === "source-50x100")!;
    const target = TARGET_BASE_STANDARDS.find((item) => item.id === "target-circle-25")!;
    const normalized = normalizeBaseConverterParams({
      sourceStandardId: "source-50x100",
      targetStandardId: "target-circle-25",
      geometrySnapshot: createConversionGeometrySnapshot(source, target),
      conversionClearance: 0.35,
      floorThickness: Number.NEGATIVE_INFINITY,
      recessDepth: Number.NaN,
      sideBevelWidth: 12,
    });

    expect(normalized).toEqual({
      sourceStandardId: "source-50x100",
      targetStandardId: "target-circle-25",
      geometrySnapshot: createConversionGeometrySnapshot(source, target),
      conversionClearance: 0.35,
      floorThickness: BASE_CONVERTER_DEFAULTS.floorThickness,
      recessDepth: BASE_CONVERTER_DEFAULTS.recessDepth,
      sideBevelWidth: 12,
    });
  });

  it("migrates legacy id-only parameters into a geometry snapshot", () => {
    const normalized = normalizeBaseConverterParams({
      sourceStandardId: "source-25x50",
      targetStandardId: "target-ellipse-35x60",
      floorThickness: 6,
      recessDepth: 7,
    });

    expect(normalized.floorThickness).toBe(6);
    expect(normalized.recessDepth).toBe(7);
    expect(normalized.geometrySnapshot.source).toMatchObject({
      standardId: "source-25x50",
      fitWidth: 25,
      fitDepth: 50,
      cornerRadius: 0,
    });
    expect(normalized.geometrySnapshot.target).toMatchObject({
      standardId: "target-ellipse-35x60",
      profileExponent: 2.05,
    });
  });

  it("allows values beyond common slider ranges when geometry stays valid", () => {
    const params = {
      ...BASE_CONVERTER_DEFAULTS,
      floorThickness: 8,
      recessDepth: 9,
    };

    expect(validateBaseConverterParams(params)).toBeNull();
  });

  it("preserves finite invalid values and embedded custom snapshots for repair", () => {
    const customId = "custom-source-imported";
    const normalized = normalizeBaseConverterParams({
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: customId,
      floorThickness: -1,
      geometrySnapshot: {
        ...BASE_CONVERTER_DEFAULTS.geometrySnapshot,
        source: {
          customId,
          name: "导入的实测规格",
          shape: "rectangle",
          nominalWidth: 20,
          nominalDepth: 40,
          fitWidth: 20,
          fitDepth: 40,
          cornerRadius: 1,
        },
      },
    });

    expect(normalized.floorThickness).toBe(-1);
    expect(normalized.sourceStandardId).toBe(customId);
    expect(normalized.geometrySnapshot.source.name).toBe("导入的实测规格");
    expect(validateBaseConverterParams(normalized)).toContain(
      "厚度、深度、间隙或斜面参数无效",
    );
  });

  it("blocks incompatible pairs and collapsed bevel geometry", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) => item.id === "source-50x100")!;
    const target = TARGET_BASE_STANDARDS.find((item) => item.id === "target-circle-50")!;
    const incompatible = {
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: source.id,
      targetStandardId: target.id,
      geometrySnapshot: createConversionGeometrySnapshot(source, target),
    };

    expect(validateBaseConverterParams(incompatible)).toContain(
      "源底座凹槽不小于目标底座",
    );
    expect(
      validateBaseConverterParams({
        ...BASE_CONVERTER_DEFAULTS,
        sideBevelWidth: 13,
      }),
    ).toContain("侧面斜面过大");
  });
});
