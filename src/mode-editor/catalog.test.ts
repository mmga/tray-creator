import { describe, expect, it } from "vitest";
import { createModeEditorCatalog } from "@/mode-editor/catalog";
import type { AppMode } from "@/types/custom-tray";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { ModeWorkspace } from "@/workspaces/types";

function workspace<M extends AppMode>(mode: M): ModeWorkspace<M> {
  return {
    mode,
    panel: null,
    overlays: null,
    replacementTarget: {
      mode,
      currentDraftId: null,
      hasUnsavedChanges: false,
      paramsRevision: 0,
      prepareDraftLoad: () => null,
      commitReset: () => {},
      commitImport: () => {},
      commitDraftLoad: () => {},
    },
  };
}

describe("Mode Editor Catalog", () => {
  it("拒绝 Mode 与 Viewport 不一致的配对", () => {
    expect(() => createModeEditorCatalog({
      grid: { workspace: workspace("grid"), viewport: { mode: "custom", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} } as unknown as ModeViewportWorkspace<"grid"> },
      custom: { workspace: workspace("custom"), viewport: { mode: "custom", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} } },
      "base-converter": { workspace: workspace("base-converter"), viewport: { mode: "base-converter", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} } },
      stepped: { workspace: workspace("stepped"), viewport: { mode: "stepped", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} } },
    })).toThrow("配对错误");
  });
});
