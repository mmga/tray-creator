import { describe, expect, it } from "vitest";
import {
  BASE_CONVERTER_DEFAULTS,
  ROUND_BASE_STANDARDS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  createConversionGeometrySnapshot,
  getConversionRecessDimensions,
  getMaxBaseConverterSideBevelWidth,
  isBaseConversionCompatible,
  normalizeBaseConverterParams,
  validateBaseConverterParams,
} from "@/lib/base-converter-config";

describe("base converter config", () => {
  it("defines the five first-release round base standards", () => {
    expect(ROUND_BASE_STANDARDS).toEqual([
      { standardId: "round-25", name: "Ø25mm", nominalDiameter: 25, height: 4, topInset: 1.5 },
      { standardId: "round-28.5", name: "Ø28.5mm", nominalDiameter: 28.5, height: 4, topInset: 1.5 },
      { standardId: "round-32", name: "Ø32mm", nominalDiameter: 32, height: 4, topInset: 1.5 },
      { standardId: "round-40", name: "Ø40mm", nominalDiameter: 40, height: 4, topInset: 1.5 },
      { standardId: "round-50", name: "Ø50mm", nominalDiameter: 50, height: 4, topInset: 1.5 },
    ]);
  });

  it("uses the measured 32mm push-fit hole as the default preset", () => {
    expect(BASE_CONVERTER_DEFAULTS.pushFitHexHole).toEqual({
      acrossFlats: 3.6,
      offsetX: 7,
      offsetY: 5,
    });
  });

  it("defines independent source and target standard catalogs", () => {
    expect(SOURCE_BASE_STANDARDS.map((item) => item.name)).toEqual([
      "20 × 20mm", "25 × 25mm", "40 × 40mm",
      "25 × 50mm", "50 × 75mm", "50 × 100mm",
      "Ø20mm", "Ø25mm", "Ø28.5mm", "Ø32mm", "Ø40mm",
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

  it("snapshots circular source standards for round-to-round conversion", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) =>
      item.id === "source-circle-20")!;
    const target = TARGET_BASE_STANDARDS.find((item) =>
      item.id === "target-circle-25")!;
    const snapshot = createConversionGeometrySnapshot(source, target);

    expect(snapshot.source).toMatchObject({
      standardId: "source-circle-20",
      shape: "circle",
      fitWidth: 20,
      fitDepth: 20,
    });
    expect(isBaseConversionCompatible(source, target)).toBe(true);
  });

  it("provides 28.5mm circular standards on both sides", () => {
    expect(SOURCE_BASE_STANDARDS).toContainEqual({
      id: "source-circle-28.5",
      name: "Ø28.5mm",
      shape: "circle",
      width: 28.5,
      depth: 28.5,
      cornerRadius: 0,
    });
    expect(TARGET_BASE_STANDARDS).toContainEqual({
      id: "target-circle-28.5",
      name: "Ø28.5mm",
      shape: "circle",
      width: 28.5,
      depth: 28.5,
      profileExponent: 2,
    });
  });

  it("limits the side bevel so the top recess keeps a wall", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) =>
      item.id === "source-circle-20")!;
    const target = TARGET_BASE_STANDARDS.find((item) =>
      item.id === "target-circle-25")!;

    expect(getMaxBaseConverterSideBevelWidth(source, target)).toBeCloseTo(2.2);
    expect(validateBaseConverterParams({
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: source.id,
      targetStandardId: target.id,
      geometrySnapshot: createConversionGeometrySnapshot(source, target),
      sideBevelWidth: 2.3,
    })).toContain("顶面凹槽侧壁不足");
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
      generationKind: "conversion",
      roundBaseStandardId: "round-32",
      roundBaseSnapshot: BASE_CONVERTER_DEFAULTS.roundBaseSnapshot,
      pushFitHexHole: BASE_CONVERTER_DEFAULTS.pushFitHexHole,
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

  it("migrates historical conversion params and fills dormant base generator defaults", () => {
    const normalized = normalizeBaseConverterParams({
      sourceStandardId: "source-25x50",
      targetStandardId: "target-ellipse-35x60",
      floorThickness: 2,
      recessDepth: 3,
    });

    expect(normalized).toMatchObject({
      generationKind: "conversion",
      roundBaseStandardId: "round-32",
      roundBaseSnapshot: {
        standardId: "round-32",
        name: "Ø32mm",
        nominalDiameter: 32,
        height: 4,
        topInset: 1.5,
      },
      pushFitHexHole: {
        acrossFlats: 3.6,
        offsetX: 7,
        offsetY: 5,
      },
    });
  });

  it("preserves an embedded round base profile snapshot", () => {
    const normalized = normalizeBaseConverterParams({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "plain",
      roundBaseStandardId: "round-40",
      roundBaseSnapshot: {
        standardId: "round-40",
        name: "实测 Ø40mm",
        nominalDiameter: 39.8,
        height: 3.7,
        topInset: 1.2,
      },
    });

    expect(normalized.roundBaseSnapshot).toEqual({
      standardId: "round-40",
      name: "实测 Ø40mm",
      nominalDiameter: 39.8,
      height: 3.7,
      topInset: 1.2,
    });
  });

  it("rejects invalid plain base profile dimensions", () => {
    expect(validateBaseConverterParams({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "plain",
      roundBaseSnapshot: {
        ...BASE_CONVERTER_DEFAULTS.roundBaseSnapshot,
        height: 0,
      },
    })).toContain("圆形底盘高度无效");

    expect(validateBaseConverterParams({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "plain",
      roundBaseSnapshot: {
        ...BASE_CONVERTER_DEFAULTS.roundBaseSnapshot,
        height: 1.2,
      },
    })).toContain("必须大于 1.2mm 壳厚");

    expect(validateBaseConverterParams({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "plain",
      roundBaseSnapshot: {
        ...BASE_CONVERTER_DEFAULTS.roundBaseSnapshot,
        topInset: 16,
      },
    })).toContain("顶部轮廓已消失");
  });

  it("validates the active push-fit hole while ignoring it for a plain base", () => {
    const invalidHole = {
      ...BASE_CONVERTER_DEFAULTS,
      pushFitHexHole: {
        ...BASE_CONVERTER_DEFAULTS.pushFitHexHole,
        acrossFlats: -1,
      },
    };

    expect(validateBaseConverterParams({
      ...invalidHole,
      generationKind: "plain",
    })).toBeNull();
    expect(validateBaseConverterParams({
      ...invalidHole,
      generationKind: "push-fit",
    })).toContain("简版六边形孔尺寸无效");
  });

  it("rejects a push-fit hole that cuts through the inset top profile", () => {
    expect(validateBaseConverterParams({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "push-fit",
      pushFitHexHole: {
        ...BASE_CONVERTER_DEFAULTS.pushFitHexHole,
        offsetX: 20,
      },
    })).toContain("至少 0.6mm 顶面壁厚");
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

  it("validates source nominal identity as well as fit geometry", () => {
    expect(
      validateBaseConverterParams({
        ...BASE_CONVERTER_DEFAULTS,
        geometrySnapshot: {
          ...BASE_CONVERTER_DEFAULTS.geometrySnapshot,
          source: {
            ...BASE_CONVERTER_DEFAULTS.geometrySnapshot.source,
            nominalWidth: 0,
          },
        },
      }),
    ).toContain("源底座尺寸或圆角无效");
  });
});
