import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { AppMode } from "@/types/custom-tray";

const {
  activeWorkspace,
  activeViewport,
  capturedWorkspaceOptions,
  capturedViewportOptions,
  modelMocks,
  getReplacementTargetMock,
  commitImportMock,
  commitResetMock,
  replacementTarget,
} = vi.hoisted(() => {
  const commitImport = vi.fn();
  const commitReset = vi.fn();
  const activeWorkspace = {
    mode: "stepped" as AppMode,
    panel: null,
    draftDialogProps: {
      mode: "stepped" as AppMode,
      open: false,
      onOpenChange: vi.fn(),
      drafts: [],
      currentDraftId: null,
      hasUnsavedChanges: false,
      draftNameInput: "",
      onDraftNameInputChange: vi.fn(),
      onSaveAsNew: vi.fn(),
      onSaveCurrent: vi.fn(),
      onLoad: vi.fn(),
      onRename: vi.fn(),
      onDelete: vi.fn(),
      onExport: vi.fn(),
      renderSummary: () => null,
    },
    commands: {
      resetWorkspace: vi.fn(),
      importIntoWorkspace: vi.fn(),
    },
  };
  const activeViewport = {
    mode: "stepped" as AppMode,
    viewport: null,
    deactivate: vi.fn(),
    resetForSessionReplacement: vi.fn(),
  };

  const replacementTarget = {
    mode: "custom" as AppMode,
    currentDraftId: null as string | null,
    hasUnsavedChanges: false,
    paramsRevision: 0,
    commitReset,
    commitImport,
    commitDraftLoad: vi.fn(),
  };
  return {
    activeWorkspace,
    activeViewport,
    capturedWorkspaceOptions: [] as Array<{
      steppedInteractionState: ModeInteractionState;
      onRequestParamImport: (file: File) => Promise<{ status: "success" | "error" }>;
      onRequestReset: (mode: AppMode) => void;
    }>,
    capturedViewportOptions: [] as Array<{
      steppedInteractionState: ModeInteractionState;
    }>,
    modelMocks: {
      gridModel: { kind: "grid" },
      customModel: { kind: "custom" },
      baseConverterModel: { kind: "base-converter" },
      steppedModel: { kind: "stepped" },
      steppedCadModel: { kind: "stepped-cad" },
    },
    getReplacementTargetMock: vi.fn(() => replacementTarget),
    commitImportMock: commitImport,
    commitResetMock: commitReset,
    replacementTarget,
  };
});

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useTrayModel", () => ({
  useTrayModel: () => modelMocks.gridModel,
}));

vi.mock("@/hooks/useCustomLayout", () => ({
  useCustomLayout: () => modelMocks.customModel,
}));

vi.mock("@/hooks/useBaseConverter", () => ({
  useBaseConverter: () => modelMocks.baseConverterModel,
}));

vi.mock("@/hooks/useSteppedLayout", () => ({
  useSteppedLayout: () => modelMocks.steppedModel,
}));

vi.mock("@/hooks/useSteppedCadLayout", () => ({
  useSteppedCadLayout: () => modelMocks.steppedCadModel,
}));

vi.mock("@/hooks/useModeWorkspaces", () => ({
  useModeWorkspaces: (options: {
    steppedInteractionState: ModeInteractionState;
    onRequestParamImport: (file: File) => Promise<{
      status: "success" | "error";
    }>;
    onRequestReset: (mode: AppMode) => void;
  }) => {
    capturedWorkspaceOptions.push(options);
    return {
      activeWorkspace,
      getWorkspace: vi.fn(() => activeWorkspace),
      getReplacementTarget: getReplacementTargetMock,
    };
  },
}));

vi.mock("@/hooks/useModeViewportWorkspaces", () => ({
  useModeViewportWorkspaces: (options: {
    steppedInteractionState: ModeInteractionState;
  }) => {
    capturedViewportOptions.push(options);
    return {
      activeViewport,
      getViewport: vi.fn((mode: AppMode) => ({ ...activeViewport, mode })),
    };
  },
}));

import { useModeEditorWorkspaces } from "@/hooks/useModeEditorWorkspaces";

describe("useModeEditorWorkspaces", () => {
  it("returns active workspace and viewport while sharing one stepped interaction state", () => {
    const { result } = renderHook(() =>
      useModeEditorWorkspaces({ mode: "stepped", onModeChange: vi.fn() }),
    );

    expect(result.current).toMatchObject({
      activeWorkspace,
      activeViewport,
    });
    expect(result.current.importOverlay).not.toBeNull();
    expect(capturedWorkspaceOptions).toHaveLength(1);
    expect(capturedViewportOptions).toHaveLength(1);
    expect(
      capturedWorkspaceOptions[0].steppedInteractionState,
    ).toBe(capturedViewportOptions[0].steppedInteractionState);
    expect(
      capturedWorkspaceOptions[0].steppedInteractionState.selectedSlotIds,
    ).toEqual([]);
    expect(
      capturedWorkspaceOptions[0].steppedInteractionState.previewGroupId,
    ).toBeNull();
  });

  it("先生成 Import Candidate，确认后提交目标工作区并切换 Mode", async () => {
    const onModeChange = vi.fn();
    const { result } = renderHook(() =>
      useModeEditorWorkspaces({ mode: "grid", onModeChange }),
    );
    const file = new File([
      JSON.stringify({
        version: 1,
        mode: "custom",
        params: {
          trayWidth: 120,
          trayDepth: 120,
          slots: [],
          spacing: 5,
          boundarySpacing: 5,
          boundarySpacingIndependent: false,
          baseThickness: 3,
          holeDepth: 3,
          cornerRadius: 4,
          sideBevelWidth: 0,
          enableBaseHole: false,
          baseHoleSize: "25",
        },
      }),
    ], "custom.json", { type: "application/json" });

    await act(async () => {
      await capturedWorkspaceOptions.at(-1)?.onRequestParamImport(file);
    });

    const overlays = result.current.importOverlay as React.ReactElement<{
      children: React.ReactElement[];
    }>;
    const overlay = overlays.props.children[0] as React.ReactElement<{
      candidate: { mode: AppMode } | null;
      onConfirm: () => void;
    }>;
    expect(overlay.props.candidate?.mode).toBe("custom");
    expect(commitImportMock).not.toHaveBeenCalled();

    act(() => overlay.props.onConfirm());

    expect(getReplacementTargetMock).toHaveBeenCalledWith("custom");
    expect(commitImportMock).toHaveBeenCalledWith(
      expect.objectContaining({ trayWidth: 120, trayDepth: 120 }),
    );
    expect(activeViewport.deactivate).toHaveBeenCalledTimes(1);
    expect(activeViewport.resetForSessionReplacement).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith("custom");
  });

  it("风险变化时刷新确认，取消保持零写入", () => {
    replacementTarget.hasUnsavedChanges = true;
    replacementTarget.currentDraftId = "draft-1";
    replacementTarget.paramsRevision = 1;
    const { result } = renderHook(() =>
      useModeEditorWorkspaces({ mode: "grid", onModeChange: vi.fn() }),
    );

    act(() => capturedWorkspaceOptions.at(-1)?.onRequestReset("grid"));
    let overlays = result.current.importOverlay as React.ReactElement<{
      children: React.ReactElement[];
    }>;
    let confirm = overlays.props.children[1] as React.ReactElement<{
      mode: AppMode | null;
      onCancel: () => void;
      onConfirm: () => void;
    }>;
    expect(confirm.props.mode).toBe("grid");
    expect(commitResetMock).not.toHaveBeenCalled();

    act(() => confirm.props.onCancel());
    expect(commitResetMock).not.toHaveBeenCalled();

    act(() => capturedWorkspaceOptions.at(-1)?.onRequestReset("grid"));
    replacementTarget.paramsRevision = 2;
    overlays = result.current.importOverlay as React.ReactElement<{
      children: React.ReactElement[];
    }>;
    confirm = overlays.props.children[1] as typeof confirm;
    act(() => confirm.props.onConfirm());
    expect(commitResetMock).not.toHaveBeenCalled();

    overlays = result.current.importOverlay as React.ReactElement<{
      children: React.ReactElement[];
    }>;
    confirm = overlays.props.children[1] as typeof confirm;
    act(() => confirm.props.onConfirm());
    expect(commitResetMock).toHaveBeenCalledTimes(1);
    expect(activeViewport.resetForSessionReplacement).toHaveBeenCalled();

    replacementTarget.hasUnsavedChanges = false;
    replacementTarget.currentDraftId = null;
  });
});
