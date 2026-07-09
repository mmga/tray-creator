import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const {
  workspaceResult,
  viewportResult,
  useSteppedWorkspaceMock,
  useSteppedViewportWorkspaceMock,
} = vi.hoisted(() => ({
  workspaceResult: {
    mode: "stepped-cad",
    panel: null,
    draftDialogProps: {},
    commands: {},
  },
  viewportResult: {
    workspace: {
      mode: "stepped-cad",
      viewport: null,
      resetTransientState: vi.fn(),
    },
  },
  useSteppedWorkspaceMock: vi.fn(),
  useSteppedViewportWorkspaceMock: vi.fn(),
}));

vi.mock("@/workspaces/stepped/useSteppedWorkspace", () => ({
  useSteppedWorkspace: useSteppedWorkspaceMock,
}));

vi.mock("@/viewports/stepped/useSteppedViewportWorkspace", () => ({
  useSteppedViewportWorkspace: useSteppedViewportWorkspaceMock,
}));

import { useSteppedCadWorkspace } from "@/workspaces/stepped-cad/useSteppedCadWorkspace";
import { useSteppedCadViewportWorkspace } from "@/viewports/stepped-cad/useSteppedCadViewportWorkspace";

describe("stepped-cad adapters", () => {
  it("向 shared Workspace 显式传递 split actions", () => {
    useSteppedWorkspaceMock.mockReturnValue(workspaceResult);
    const model = {
      handleExportSplitParts: vi.fn(),
      updateGroupSplitPartTarget: vi.fn(),
    };
    const interactionState = { kind: "interaction" };

    renderHook(() =>
      useSteppedCadWorkspace({
        model: model as never,
        interactionState: interactionState as never,
      }),
    );

    expect(useSteppedWorkspaceMock).toHaveBeenCalledWith({
      model,
      interactionState,
      mode: "stepped-cad",
      splitActions: {
        handleExportSplitParts: model.handleExportSplitParts,
        updateGroupSplitPartTarget: model.updateGroupSplitPartTarget,
      },
    });
  });

  it("向 shared Viewport 显式传递 split preview Interface", () => {
    useSteppedViewportWorkspaceMock.mockReturnValue(viewportResult);
    const model = {
      splitPreviewParts: null,
      isGeneratingSplitPreview: false,
      handleGenerateSplitPreview: vi.fn(),
    };
    const interactionState = { kind: "interaction" };
    const onRightViewChange = vi.fn();

    renderHook(() =>
      useSteppedCadViewportWorkspace({
        model: model as never,
        interactionState: interactionState as never,
        rightView: "3d",
        onRightViewChange,
      }),
    );

    expect(useSteppedViewportWorkspaceMock).toHaveBeenCalledWith({
      model,
      interactionState,
      rightView: "3d",
      onRightViewChange,
      mode: "stepped-cad",
      splitPreview: {
        parts: model.splitPreviewParts,
        isGenerating: model.isGeneratingSplitPreview,
        generate: model.handleGenerateSplitPreview,
      },
    });
  });
});
