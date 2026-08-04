import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { createModeEditorAdapter } from "@/mode-editor/adapters";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { ModeWorkspace } from "@/workspaces/types";

function createGridAdapter() {
  const events: string[] = [];
  const prepared = {
    id: "draft-1",
    title: "Draft 1",
    snapshot: {
      mode: "grid" as const,
      params: DEFAULT_TRAY_PARAMS,
    },
    serializedParams: "{}",
  };
  const workspace: ModeWorkspace<"grid"> = {
    mode: "grid",
    panel: null,
    overlays: null,
    replacementTarget: {
      mode: "grid",
      currentDraftId: "draft-0",
      hasUnsavedChanges: true,
      paramsRevision: 3,
      prepareDraftLoad: vi.fn(() => prepared),
      commitReset: vi.fn(() => events.push("reset")),
      commitImport: vi.fn(() => events.push("import")),
      commitDraftLoad: vi.fn(() => events.push("draft")),
    },
  };
  const viewport: ModeViewportWorkspace<"grid"> = {
    mode: "grid",
    viewport: null,
    deactivate: vi.fn(() => events.push("deactivate")),
    resetForSessionReplacement: vi.fn(() => events.push("viewport-reset")),
  };
  return {
    adapter: createModeEditorAdapter(workspace, viewport),
    events,
    prepared,
    workspace,
    viewport,
  };
}

describe("Mode Editor Adapter", () => {
  it("把风险、普通退出和 Session 替换保持在同一个配对 Seam", () => {
    const { adapter, events, workspace, viewport } = createGridAdapter();

    expect(adapter.readReplacementRisk()).toEqual({
      currentDraftId: "draft-0",
      hasUnsavedChanges: true,
      paramsRevision: 3,
    });

    adapter.deactivate();
    expect(events).toEqual(["deactivate"]);
    expect(viewport.resetForSessionReplacement).not.toHaveBeenCalled();

    adapter.commitReplacement(adapter.prepareReset());
    expect(events).toEqual(["deactivate", "reset", "viewport-reset"]);
    expect(workspace.replacementTarget.commitReset).toHaveBeenCalledTimes(1);
  });

  it("让 Draft 与外部参数提交沿用同一 Mode 的类型配对和 Viewport 重置", () => {
    const { adapter, events, prepared, workspace } = createGridAdapter();

    const draft = adapter.prepareDraftLoad("draft-1");
    expect(draft).toBe(prepared);
    adapter.commitReplacement({
      kind: "draft",
      mode: "grid",
      prepared: draft!,
    });
    adapter.commitImport({
      mode: "grid",
      params: DEFAULT_TRAY_PARAMS,
    });

    expect(events).toEqual([
      "draft",
      "viewport-reset",
      "import",
      "viewport-reset",
    ]);
    expect(workspace.replacementTarget.commitDraftLoad).toHaveBeenCalledWith(
      prepared,
    );
    expect(workspace.replacementTarget.commitImport).toHaveBeenCalledWith(
      DEFAULT_TRAY_PARAMS,
    );
  });
});
