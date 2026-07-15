import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const {
  viewportResult,
  draftSupportReturn,
  useSteppedViewportWorkspaceMock,
  useWorkspaceDraftSupportMock,
} = vi.hoisted(() => ({
  viewportResult: {
    workspace: {
      mode: "stepped-cad",
      viewport: null,
      resetTransientState: vi.fn(),
    },
  },
  draftSupportReturn: {
    draftActions: {
      currentDraftId: null,
      hasUnsavedChanges: false,
      onSaveDraft: vi.fn(),
      onOpenDraftDialog: vi.fn(),
    },
    overlays: null,
    clearDraftBinding: vi.fn(),
  },
  useSteppedViewportWorkspaceMock: vi.fn(),
  useWorkspaceDraftSupportMock: vi.fn(() => draftSupportReturn),
}));

vi.mock("@/workspaces/shared", () => ({
  useWorkspaceDraftSupport: useWorkspaceDraftSupportMock,
}));

vi.mock("@/viewports/stepped/useSteppedViewportWorkspace", () => ({
  useSteppedViewportWorkspace: useSteppedViewportWorkspaceMock,
}));

import { useSteppedCadWorkspace } from "@/workspaces/stepped-cad/useSteppedCadWorkspace";
import { useSteppedCadViewportWorkspace } from "@/viewports/stepped-cad/useSteppedCadViewportWorkspace";

describe("stepped-cad adapters", () => {
  it("自建 stepped-cad workspace 并按 stepped 模式管理草稿", () => {
    const model = {
      params: { groups: [], slots: [] },
      setParams: vi.fn(),
      effectiveDimensions: { width: 120, depth: 140 },
      isPreviewStale: false,
      updateParam: vi.fn(),
      addSlot: vi.fn(),
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      handleExportSplitParts: vi.fn(),
      updateGroupSplitPartTarget: vi.fn(),
      isGenerating: false,
      volume: 0,
      addGroup: vi.fn(),
      removeGroup: vi.fn(),
      updateGroupHeight: vi.fn(),
      updateGroupSmoothingOverride: vi.fn(),
      updateGroupSmoothingRadius: vi.fn(),
      updateGroupDisconnectOverride: vi.fn(),
      updateGroupDisconnectDistance: vi.fn(),
      setActiveGroup: vi.fn(),
      moveSelectedSlotsToGroup: vi.fn(),
      reorderGroups: vi.fn(),
      bridgeWarning: null,
      optimizationProposals: [],
      isOptimizingLayout: false,
      generateOptimizationProposals: vi.fn(),
      applyOptimizationProposal: vi.fn(),
      clearOptimizationProposals: vi.fn(),
    };
    const resetInteractionState = vi.fn();
    const interactionState = {
      selectedSlotIds: [],
      previewGroupId: null,
      setPreviewGroupId: vi.fn(),
      resetInteractionState,
    };

    const { result } = renderHook(() =>
      useSteppedCadWorkspace({
        model: model as never,
        interactionState: interactionState as never,
        onRequestParamImport: vi.fn(async () => ({ status: "success" as const })),
      }),
    );

    // 草稿以 stepped 模式落盘（DraftMode 不含 stepped-cad）。
    expect(useWorkspaceDraftSupportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "stepped",
        params: model.params,
        setParams: model.setParams,
        onAfterLoad: resetInteractionState,
      }),
    );
    // workspace 渲染 Interface 保持 panel + overlays，导入提交通过内部 importTarget 完成。
    expect(result.current.overlays).toBeNull();
    expect(result.current.panel).not.toBeNull();
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
