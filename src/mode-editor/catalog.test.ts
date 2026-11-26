import { describe, expect, it, vi } from "vitest";
import {
  createModeEditorAdapter,
} from "@/mode-editor/adapters";
import {
  commitImportedCandidate,
  commitReplacement,
  createModeEditorCatalog,
  prepareDraftReplacement,
  prepareReset,
} from "@/mode-editor/catalog";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { createDefaultStorageSteppedParams } from "@/lib/storage-stepped-config";
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
      prepareDraftLoad: vi.fn(() => null),
      commitReset: vi.fn(),
      commitImport: vi.fn(),
      commitDraftLoad: vi.fn(),
    },
  };
}

describe("Mode Editor Catalog", () => {
  it("拒绝 Mode 与 Viewport 不一致的配对", () => {
    expect(() => createModeEditorCatalog({
      grid: createModeEditorAdapter(
        workspace("grid"),
        { mode: "custom", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} } as unknown as ModeViewportWorkspace<"grid">,
      ),
      custom: createModeEditorAdapter(
        workspace("custom"),
        { mode: "custom", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} },
      ),
      "base-converter": createModeEditorAdapter(
        workspace("base-converter"),
        { mode: "base-converter", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} },
      ),
      stepped: createModeEditorAdapter(
        workspace("stepped"),
        { mode: "stepped", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} },
      ),
      "storage-stepped": createModeEditorAdapter(
        workspace("storage-stepped"),
        { mode: "storage-stepped", viewport: null, deactivate: () => {}, resetForSessionReplacement: () => {} },
      ),
    })).toThrow("配对错误");
  });
});

describe("Mode Editor Catalog 收纳阶梯分支", () => {
  function fullCatalog() {
    const modeList: AppMode[] = [
      "grid",
      "custom",
      "base-converter",
      "stepped",
      "storage-stepped",
    ];
    const entries = Object.fromEntries(
      modeList.map((mode) => [
        mode,
        createModeEditorAdapter(workspace(mode), {
          mode,
          viewport: null,
          deactivate: () => {},
          resetForSessionReplacement: () => {},
        }),
      ]),
    ) as Parameters<typeof createModeEditorCatalog>[0];
    return createModeEditorCatalog(entries);
  }

  it("切换、重置与会话替换分支覆盖收纳模式", () => {
    const catalog = fullCatalog();
    const reset = prepareReset(catalog, "storage-stepped");
    expect(reset).toEqual({ kind: "reset", mode: "storage-stepped" });
    commitReplacement(catalog, reset);
    expect(catalog["storage-stepped"].workspace.replacementTarget.commitReset)
      .toHaveBeenCalledTimes(1);

    const prepared = {
      id: "draft-1",
      title: "draft-1",
      snapshot: captureModeParamSnapshot(
        "storage-stepped",
        createDefaultStorageSteppedParams(),
      ),
      serializedParams: "{}",
    };
    catalog["storage-stepped"].workspace.replacementTarget.prepareDraftLoad =
      vi.fn(() => prepared);
    const replacement = prepareDraftReplacement(
      catalog,
      "storage-stepped",
      "draft-1",
    );
    expect(replacement?.mode).toBe("storage-stepped");
    if (replacement) commitReplacement(catalog, replacement);
    expect(
      catalog["storage-stepped"].workspace.replacementTarget.commitDraftLoad,
    ).toHaveBeenCalledTimes(1);

    commitImportedCandidate(catalog, {
      fileName: "params.json",
      mode: "storage-stepped",
      snapshot: prepared.snapshot as never,
      report: {
        modeResolution: {
          kind: "declared",
          targetMode: "storage-stepped",
          message: "declared",
        },
        adjustments: [],
        retiredFields: [],
      },
    });
    expect(catalog["storage-stepped"].workspace.replacementTarget.commitImport)
      .toHaveBeenCalledTimes(1);
  });
});
