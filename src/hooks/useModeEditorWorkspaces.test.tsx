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
  getImportTargetMock,
  commitImportMock,
} = vi.hoisted(() => {
  const commitImport = vi.fn();
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
    resetTransientState: vi.fn(),
  };

  return {
    activeWorkspace,
    activeViewport,
    capturedWorkspaceOptions: [] as Array<{
      steppedInteractionState: ModeInteractionState;
      onRequestParamImport: (file: File) => Promise<{ status: "success" | "error" }>;
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
    getImportTargetMock: vi.fn(() => ({
      currentDraftId: null,
      hasUnsavedChanges: false,
      commit: commitImport,
    })),
    commitImportMock: commitImport,
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
  }) => {
    capturedWorkspaceOptions.push(options);
    return { activeWorkspace, getImportTarget: getImportTargetMock };
  },
}));

vi.mock("@/hooks/useModeViewportWorkspaces", () => ({
  useModeViewportWorkspaces: (options: {
    steppedInteractionState: ModeInteractionState;
  }) => {
    capturedViewportOptions.push(options);
    return { activeViewport };
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

    const overlay = result.current.importOverlay as React.ReactElement<{
      candidate: { targetMode: AppMode } | null;
      onConfirm: () => void;
    }>;
    expect(overlay.props.candidate?.targetMode).toBe("custom");
    expect(commitImportMock).not.toHaveBeenCalled();

    act(() => overlay.props.onConfirm());

    expect(getImportTargetMock).toHaveBeenCalledWith("custom");
    expect(commitImportMock).toHaveBeenCalledWith(
      expect.objectContaining({ trayWidth: 120, trayDepth: 120 }),
    );
    expect(activeViewport.resetTransientState).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith("custom");
  });
});
