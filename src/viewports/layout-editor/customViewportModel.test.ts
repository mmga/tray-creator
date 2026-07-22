import { describe, expect, it } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { buildCustomLayoutEditorViewportModel } from "@/viewports/layout-editor/customViewportModel";

describe("custom layout editor viewport model", () => {
  it("keeps automatic mode on the dynamic effective-baseplate overlay", () => {
    const model = buildCustomLayoutEditorViewportModel(CUSTOM_LAYOUT_DEFAULTS);

    expect(model.trayFrame.showEffectiveBaseplate).toBe(true);
    expect(model.trayFrame.fixedUsableArea).toBeUndefined();
  });

  it("projects fixed mode as a fixed outer frame with an inset usable area", () => {
    const model = buildCustomLayoutEditorViewportModel({
      ...CUSTOM_LAYOUT_DEFAULTS,
      traySizingMode: "fixed",
      trayWidth: 100,
      trayDepth: 80,
      boundarySpacingIndependent: true,
      boundarySpacing: 5,
      cornerRadius: 12,
      sideBevelWidth: 3,
    });

    expect(model.trayFrame.showEffectiveBaseplate).toBe(false);
    expect(model.trayFrame.fixedUsableArea).toEqual({
      x: 8,
      y: 8,
      width: 84,
      depth: 64,
      cornerRadius: 4,
    });
  });

  it("contoured footprint 用 groupOutlines 渲染贴合轮廓，关闭矩形 effective baseplate", () => {
    const model = buildCustomLayoutEditorViewportModel({
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
      traySizingMode: "fixed", // contoured 下 fixed sizing 应被休眠
      trayWidth: 100,
      trayDepth: 80,
      slots: [
        { id: "a", x: 20, y: 20, shape: "circle", width: 25, height: 25, rotation: 0 },
      ],
    });
    expect(model.trayFrame.showEffectiveBaseplate).toBe(false);
    expect(model.trayFrame.fixedUsableArea).toBeUndefined();
    expect(model.overlays.groupOutlines).not.toBeNull();
    expect(model.overlays.groupOutlines!.length).toBeGreaterThanOrEqual(1);
  });

  it("contoured footprint 远距多槽渲染为多个独立 outline", () => {
    const model = buildCustomLayoutEditorViewportModel({
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
      slots: [
        { id: "a", x: 0, y: 0, shape: "circle", width: 25, height: 25, rotation: 0 },
        { id: "b", x: 200, y: 200, shape: "circle", width: 25, height: 25, rotation: 0 },
      ],
    });
    expect(model.overlays.groupOutlines?.length).toBe(2);
  });
});
