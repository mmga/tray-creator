import { describe, expect, it } from "vitest";
import { buildDraftSummary } from "@/lib/draft-summary";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";

describe("直边草稿摘要", () => {
  const params = { ...CUSTOM_LAYOUT_DEFAULTS, footprintStyle: "polygonal" as const,
    traySizingMode: "fixed" as const, boundarySpacingIndependent: true, boundarySpacing: 2,
    slots: [{ id: "a", x: 20, y: 20, shape: "circle" as const, width: 20, height: 20,
      slotWidth: 20, slotHeight: 20, rotation: 0 }] };

  it("保存真实尺寸而非休眠长宽", () => {
    expect(buildDraftSummary(captureModeParamSnapshot("custom", params))).toMatchObject({
      footprintStyle: "polygonal", trayWidth: 28, trayDepth: 28,
    });
  });
  it("非空构造失败仍能生成摘要，以零尺寸标识待修复", () => {
    const invalid = { ...params, boundarySpacing: -1 };
    expect(buildDraftSummary(captureModeParamSnapshot("custom", invalid))).toMatchObject({
      footprintStyle: "polygonal", slotCount: 1, trayWidth: 0, trayDepth: 0,
    });
  });
  it("空草稿保持现有尺寸展示", () => {
    expect(buildDraftSummary(captureModeParamSnapshot("custom", { ...params, slots: [] }))).toMatchObject({
      slotCount: 0, trayWidth: params.trayWidth, trayDepth: params.trayDepth,
    });
  });
});
