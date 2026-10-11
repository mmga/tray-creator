import { describe, expect, it } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";
import {
  constructCustomContouredFootprintOutcome,
  projectCustomContouredFootprintInput,
} from "@/lib/custom-contoured-footprint";
import type { CustomLayoutParams } from "@/types/custom-tray";
import {
  projectCustomTrayResult,
  projectBaseConverterResult,
  projectGridTrayResult,
  projectSteppedTrayResult,
} from "@/lib/tray-result-projection";

const idleState = {
  volume: 0,
  isGenerating: false,
  isPreviewStale: false,
};

function readyCustomState(params: CustomLayoutParams) {
  const outcome = constructCustomContouredFootprintOutcome(
    projectCustomContouredFootprintInput(params),
  );
  if (!outcome.ok) throw new Error(outcome.error.message);
  return { status: "ready" as const, value: outcome.value };
}

describe("Tray Result Projection", () => {
  it("直边摘要忽略矩形有效尺寸和固定尺寸，使用权威轮廓", () => {
    const params: CustomLayoutParams = { ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "polygonal", traySizingMode: "fixed",
      slots: [{ id: "a", x: 0, y: 0, shape: "circle", width: 25, height: 25, rotation: 0 }] };
    const state = readyCustomState(params);
    const result = projectCustomTrayResult(params, { width: 999, depth: 999 }, idleState, state);
    expect(result).toMatchObject({ footprintStyle: "polygonal", footprintKind: "polygonal-footprint",
      sizingMode: "auto", contourBodyCount: 1, polygonSideCount: 4 });
    expect(result.dimensions.width).toBeCloseTo(state.value.bounds!.maxX - state.value.bounds!.minX, 1);
  });

  it("投影 grid 的 Slot Count、Grid Footprint Area 与独立状态", () => {
    const result = projectGridTrayResult(DEFAULT_TRAY_PARAMS, {
      ...idleState,
      isGenerating: true,
      isPreviewStale: true,
    });

    expect(result.slotCount).toBe(
      DEFAULT_TRAY_PARAMS.rows * DEFAULT_TRAY_PARAMS.columns,
    );
    expect(result.footprintArea).toBe(
      result.dimensions.width * result.dimensions.depth,
    );
    expect(result.generating).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.weight).toEqual({ status: "unavailable" });
  });

  it("区分 custom 的 Effective Baseplate 与 Fixed Tray Outer Footprint", () => {
    const automatic = projectCustomTrayResult(
      CUSTOM_LAYOUT_DEFAULTS,
      { width: 88, depth: 96 },
      idleState,
    );
    const fixed = projectCustomTrayResult(
      { ...CUSTOM_LAYOUT_DEFAULTS, traySizingMode: "fixed" },
      { width: 88, depth: 96 },
      idleState,
    );

    expect(automatic.footprintKind).toBe("effective-baseplate");
    expect(automatic.footprintStyle).toBe("rectangular");
    expect(automatic.contourBodyCount).toBe(0); // 默认无槽
    expect(automatic.dimensions).toEqual(
      expect.objectContaining({ width: 88, depth: 96 }),
    );
    expect(fixed.footprintKind).toBe("fixed-outer-footprint");
    expect(fixed.dimensions).toEqual(
      expect.objectContaining({
        width: CUSTOM_LAYOUT_DEFAULTS.trayWidth,
        depth: CUSTOM_LAYOUT_DEFAULTS.trayDepth,
      }),
    );
  });

  it("投影 custom contoured footprint 的实体数与外接框尺寸", () => {
    const params = {
        ...CUSTOM_LAYOUT_DEFAULTS,
        footprintStyle: "contoured",
        slots: [
          { id: "a", x: 0, y: 0, shape: "circle", width: 25, height: 25, rotation: 0 },
          { id: "b", x: 200, y: 200, shape: "circle", width: 25, height: 25, rotation: 0 },
        ],
      } satisfies CustomLayoutParams;
    const contoured = projectCustomTrayResult(
      params,
      // contoured 时 effectiveDimensions 被忽略，由派生 footprint 决定
      { width: 0, depth: 0 },
      idleState,
      readyCustomState(params),
    );
    expect(contoured.footprintStyle).toBe("contoured");
    expect(contoured.footprintKind).toBe("contoured-footprint");
    expect(contoured.contourBodyCount).toBe(2);
    expect(contoured.dimensions.width).toBeGreaterThan(0);
  });

  it("投影转换底盘标准、凹槽与总高度", () => {
    const result = projectBaseConverterResult(BASE_CONVERTER_DEFAULTS, {
      ...idleState,
      volume: 1000,
    });
    expect(result).toMatchObject({
      mode: "base-converter",
      generationKind: "conversion",
      sourceLabel: "20 × 20mm",
      targetLabel: "Ø25mm",
      recess: { width: 20.4, depth: 20.4 },
      dimensions: { width: 25, depth: 25, height: 3.2 },
    });
    expect(result.weight.status).toBe("available");
  });

  it("分别投影普通与简版底盘的真实尺寸和孔位摘要", () => {
    const plain = projectBaseConverterResult({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "plain",
    }, idleState);
    const pushFit = projectBaseConverterResult({
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "push-fit",
      pushFitHexHole: { acrossFlats: 3, offsetX: 1.2, offsetY: -0.8 },
    }, idleState);

    expect(plain).toMatchObject({
      generationKind: "plain",
      itemLabel: "普通底盘 · Ø32mm",
      dimensions: { width: 32, depth: 32, height: 4 },
    });
    expect(pushFit).toMatchObject({
      generationKind: "push-fit",
      itemLabel: "简版底盘 · Ø32mm · 六边孔 3mm",
      hole: { acrossFlats: 3, offsetX: 1.2, offsetY: -0.8 },
    });
  });

  it("投影统一后的阶梯模式", () => {
    const stepped = projectSteppedTrayResult(
      "stepped",
      STEPPED_LAYOUT_DEFAULTS,
      { width: 120, depth: 140 },
      idleState,
      { status: "inactive" },
    );
    expect(stepped).toMatchObject({ mode: "stepped", groupCount: 1 });
  });

  it("不会把非有限尺寸或重量暴露给展示层", () => {
    const result = projectGridTrayResult(DEFAULT_TRAY_PARAMS, {
      ...idleState,
      volume: Number.POSITIVE_INFINITY,
    });

    expect(result.weight).toEqual({ status: "unavailable" });
    expect(Object.values(result.dimensions).every(Number.isFinite)).toBe(true);
  });

  it("投影盒体外尺寸与两个净高", () => {
    const boxParams = {
      ...DEFAULT_TRAY_PARAMS,
      stackableBox: {
        ...DEFAULT_TRAY_PARAMS.stackableBox!,
        enabled: true,
        outerWidth: 200,
        outerDepth: 150,
        outerHeight: 50,
        lidThickness: 2.4,
      },
    };
    const result = projectGridTrayResult(boxParams, {
      volume: 120,
      bodyVolume: 100,
      lidVolume: 20,
      isGenerating: false,
      isPreviewStale: false,
    });

    expect(result.itemLabel).toBe("堆叠盒体");
    expect(result.dimensions).toEqual({ width: 200, depth: 150, height: 50 });
    expect(result.box).toMatchObject({
      outerWidth: 200,
      outerDepth: 150,
      outerHeight: 50,
      closedOuterHeight: 52.8,
      lidClearHeight: 47,
      stackClearHeight: 43,
      xyFitClearance: 0.4,
    });
    expect(result.box?.bodyWeight).toEqual({
      status: "available",
      grams: expect.any(Number),
    });
  });

  it("盒体关闭时不投影 box 字段", () => {
    const result = projectGridTrayResult(DEFAULT_TRAY_PARAMS, idleState);
    expect(result.box).toBeUndefined();
    expect(result.itemLabel).toBe(`${DEFAULT_TRAY_PARAMS.rows * DEFAULT_TRAY_PARAMS.columns} 个凹槽`);
  });
});
