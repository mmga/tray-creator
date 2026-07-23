import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppMode } from "@/types/custom-tray";

const {
  workspaces,
  viewports,
  prepareParamImportMock,
  toastMock,
} = vi.hoisted(() => {
  const modes: AppMode[] = [
    "grid",
    "custom",
    "base-converter",
    "stepped",
  ];
  const workspaceEntries = Object.fromEntries(modes.map((mode) => [
    mode,
    {
      mode,
      panel: null,
      overlays: null,
      replacementTarget: {
        mode,
        currentDraftId: null as string | null,
        hasUnsavedChanges: false,
        paramsRevision: 0,
        prepareDraftLoad: vi.fn((draftId: string) => ({
          id: draftId,
          title: draftId,
          snapshot: { mode, params: {} },
          serializedParams: "{}",
        })),
        commitReset: vi.fn(),
        commitImport: vi.fn(),
        commitDraftLoad: vi.fn(),
      },
    },
  ])) as Record<AppMode, {
    mode: AppMode;
    panel: null;
    overlays: null;
    replacementTarget: {
      mode: AppMode;
      currentDraftId: string | null;
      hasUnsavedChanges: boolean;
      paramsRevision: number;
      prepareDraftLoad: ReturnType<typeof vi.fn>;
      commitReset: ReturnType<typeof vi.fn>;
      commitImport: ReturnType<typeof vi.fn>;
      commitDraftLoad: ReturnType<typeof vi.fn>;
    };
  }>;
  const viewportEntries = Object.fromEntries(modes.map((mode) => [
    mode,
    {
      mode,
      viewport: null,
      deactivate: vi.fn(),
      resetForSessionReplacement: vi.fn(),
    },
  ])) as Record<AppMode, {
    mode: AppMode;
    viewport: null;
    deactivate: ReturnType<typeof vi.fn>;
    resetForSessionReplacement: ReturnType<typeof vi.fn>;
  }>;
  return {
    workspaces: workspaceEntries,
    viewports: viewportEntries,
    prepareParamImportMock: vi.fn(),
    toastMock: vi.fn(),
  };
});

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));
vi.mock("@/hooks/useTrayModel", () => ({
  useTrayModel: () => ({ kind: "grid" }),
}));
vi.mock("@/hooks/useCustomLayout", () => ({
  useCustomLayout: () => ({ kind: "custom" }),
}));
vi.mock("@/hooks/useBaseConverter", () => ({
  useBaseConverter: () => ({ kind: "base-converter" }),
}));
vi.mock("@/hooks/useSteppedLayout", () => ({
  useSteppedLayout: () => ({
    kind: "stepped",
    params: { enableSplitAssembly: false },
  }),
}));
vi.mock("@/hooks/useModeInteractionState", () => ({
  useModeInteractionState: () => ({ kind: "interaction" }),
}));
vi.mock("@/lib/param-io", () => ({
  prepareParamImport: prepareParamImportMock,
}));

vi.mock("@/workspaces/grid/useGridWorkspace", () => ({
  useGridWorkspace: () => workspaces.grid,
}));
vi.mock("@/workspaces/custom/useCustomWorkspace", () => ({
  useCustomWorkspace: () => workspaces.custom,
}));
vi.mock("@/workspaces/base-converter/useBaseConverterWorkspace", () => ({
  useBaseConverterWorkspace: () => workspaces["base-converter"],
}));
vi.mock("@/workspaces/stepped/useSteppedWorkspace", () => ({
  useSteppedWorkspace: () => workspaces.stepped,
}));
vi.mock("@/viewports/grid/useGridViewportWorkspace", () => ({
  useGridViewportWorkspace: () => viewports.grid,
}));
vi.mock("@/viewports/custom/useCustomViewportWorkspace", () => ({
  useCustomViewportWorkspace: () => viewports.custom,
}));
vi.mock("@/viewports/base-converter/useBaseConverterViewportWorkspace", () => ({
  useBaseConverterViewportWorkspace: () => viewports["base-converter"],
}));
vi.mock("@/viewports/stepped/useSteppedViewportWorkspace", () => ({
  useSteppedViewportWorkspace: () => ({ workspace: viewports.stepped }),
}));

import { useModeEditor } from "@/hooks/useModeEditor";

describe("useModeEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const workspace of Object.values(workspaces)) {
      workspace.replacementTarget.currentDraftId = null;
      workspace.replacementTarget.hasUnsavedChanges = false;
      workspace.replacementTarget.paramsRevision = 0;
    }
  });

  it("普通切换只退出源 Mode，并保留目标会话", async () => {
    const { result } = renderHook(() => useModeEditor("grid"));

    await act(async () => {
      await result.current.perform({ type: "switch-mode", mode: "custom" });
    });

    expect(result.current.active.mode).toBe("custom");
    expect(viewports.grid.deactivate).toHaveBeenCalledTimes(1);
    expect(viewports.custom.resetForSessionReplacement).not.toHaveBeenCalled();
  });

  it("风险变化时刷新确认，第二次确认才提交重置", async () => {
    const target = workspaces.grid.replacementTarget;
    target.hasUnsavedChanges = true;
    target.currentDraftId = "draft-1";
    target.paramsRevision = 1;
    const { result } = renderHook(() => useModeEditor("grid"));

    await act(async () => {
      expect(await result.current.perform({
        type: "request-reset",
        mode: "grid",
      })).toEqual({ status: "awaiting-confirmation" });
    });
    target.paramsRevision = 2;
    await act(async () => {
      expect(await result.current.perform({
        type: "confirm-replacement",
      })).toEqual({ status: "awaiting-confirmation" });
    });
    expect(target.commitReset).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.perform({
        type: "confirm-replacement",
      })).toEqual({ status: "completed" });
    });
    expect(target.commitReset).toHaveBeenCalledTimes(1);
    expect(viewports.grid.resetForSessionReplacement).toHaveBeenCalledTimes(1);
  });

  it("Draft 由 Mode Editor 准备并在无风险时原子提交", async () => {
    const target = workspaces.custom.replacementTarget;
    const { result } = renderHook(() => useModeEditor("custom"));

    await act(async () => {
      expect(await result.current.perform({
        type: "request-draft-load",
        mode: "custom",
        draftId: "draft-2",
      })).toEqual({ status: "completed" });
    });

    expect(target.prepareDraftLoad).toHaveBeenCalledWith("draft-2");
    expect(target.commitDraftLoad).toHaveBeenCalledWith(
      expect.objectContaining({ id: "draft-2" }),
    );
    expect(viewports.custom.resetForSessionReplacement).toHaveBeenCalledTimes(1);
  });

  it("跨 Mode 导入始终确认，提交后切换目标 Mode", async () => {
    prepareParamImportMock.mockResolvedValue({
      status: "ready",
      candidate: {
        fileName: "custom.json",
        mode: "custom",
        snapshot: { mode: "custom", params: { trayWidth: 120 } },
        report: { adjustments: [], retiredFields: [] },
      },
    });
    const { result } = renderHook(() => useModeEditor("grid"));

    await act(async () => {
      expect(await result.current.perform({
        type: "request-param-import",
        file: new File(["{}"], "custom.json"),
      })).toEqual({ status: "awaiting-confirmation" });
    });
    expect(workspaces.custom.replacementTarget.commitImport).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.perform({
        type: "confirm-replacement",
      })).toEqual({ status: "completed" });
    });
    expect(viewports.grid.deactivate).toHaveBeenCalledTimes(1);
    expect(workspaces.custom.replacementTarget.commitImport).toHaveBeenCalledWith(
      { trayWidth: 120 },
    );
    expect(viewports.custom.resetForSessionReplacement).toHaveBeenCalledTimes(1);
    expect(result.current.active.mode).toBe("custom");
  });
});
