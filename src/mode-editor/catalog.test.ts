import { describe, expect, it } from "vitest";
import { createModeEditorCatalog } from "@/mode-editor/catalog";

function workspace() {
  return { panel: null, overlays: null, importTarget: { currentDraftId: null, hasUnsavedChanges: false, commit: () => {} } };
}

describe("Mode Editor Catalog", () => {
  it("拒绝 Mode 与 Viewport 不一致的配对", () => {
    expect(() => createModeEditorCatalog({
      grid: { workspace: workspace(), viewport: { mode: "custom", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} } },
      custom: { workspace: workspace(), viewport: { mode: "custom", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} } },
      "base-converter": { workspace: workspace(), viewport: { mode: "base-converter", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} } },
      stepped: { workspace: workspace(), viewport: { mode: "stepped", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} } },
    })).toThrow("配对错误");
  });
});
