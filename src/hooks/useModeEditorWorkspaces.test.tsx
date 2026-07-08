import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { AppMode } from "@/types/custom-tray";

const {
  activeWorkspace,
  activeViewport,
  capturedWorkspaceOptions,
  capturedViewportOptions,
  modelMocks,
} = vi.hoisted(() => {
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
    }>,
    capturedViewportOptions: [] as Array<{
      steppedInteractionState: ModeInteractionState;
    }>,
    modelMocks: {
      gridModel: { kind: "grid" },
      customModel: { kind: "custom" },
      simpleSteppedModel: { kind: "simple-stepped" },
      steppedModel: { kind: "stepped" },
      steppedCadModel: { kind: "stepped-cad" },
    },
  };
});

vi.mock("@/hooks/useTrayModel", () => ({
  useTrayModel: () => modelMocks.gridModel,
}));

vi.mock("@/hooks/useCustomLayout", () => ({
  useCustomLayout: () => modelMocks.customModel,
}));

vi.mock("@/hooks/useSimpleSteppedLayout", () => ({
  useSimpleSteppedLayout: () => modelMocks.simpleSteppedModel,
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
  }) => {
    capturedWorkspaceOptions.push(options);
    return { activeWorkspace };
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
      useModeEditorWorkspaces({ mode: "stepped" }),
    );

    expect(result.current).toEqual({
      activeWorkspace,
      activeViewport,
    });
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
});
