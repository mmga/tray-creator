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
});
