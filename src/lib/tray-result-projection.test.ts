import { describe, expect, it } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";
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

describe("Tray Result Projection", () => {
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
    const contoured = projectCustomTrayResult(
      {
        ...CUSTOM_LAYOUT_DEFAULTS,
        footprintStyle: "contoured",
        slots: [
          { id: "a", x: 0, y: 0, shape: "circle", width: 25, height: 25, rotation: 0 },
          { id: "b", x: 200, y: 200, shape: "circle", width: 25, height: 25, rotation: 0 },
        ],
      },
      // contoured 时 effectiveDimensions 被忽略，由派生 footprint 决定
      { width: 0, depth: 0 },
      idleState,
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
      sourceLabel: "20 × 20mm",
      targetLabel: "Ø25mm",
      recess: { width: 20.4, depth: 20.4 },
      dimensions: { width: 25, depth: 25, height: 3.2 },
    });
    expect(result.weight.status).toBe("available");
  });

  it("投影统一后的阶梯模式", () => {
    const stepped = projectSteppedTrayResult(
      "stepped",
      STEPPED_LAYOUT_DEFAULTS,
      { width: 120, depth: 140 },
      idleState,
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
});
