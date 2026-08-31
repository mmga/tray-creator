import type { ReactNode } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import {
  BASE_CONVERTER_DEFAULTS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  createConversionGeometrySnapshot,
} from "@/lib/base-converter-config";

const {
  clearDraftBindingMock,
  commitLoadedDraftBindingMock,
  requestResetMock,
  requestDraftLoadMock,
  useAutoPreviewMock,
  useWorkspaceDraftSupportMock,
} = vi.hoisted(() => {
  const clearDraftBinding = vi.fn();
  const commitLoadedDraftBinding = vi.fn();
  return {
    clearDraftBindingMock: clearDraftBinding,
    commitLoadedDraftBindingMock: commitLoadedDraftBinding,
    requestResetMock: vi.fn(),
    requestDraftLoadMock: vi.fn(),
    useAutoPreviewMock: vi.fn(),
    useWorkspaceDraftSupportMock: vi.fn(() => ({
      draftActions: {
        currentDraftId: null,
        hasUnsavedChanges: false,
        onSaveDraft: vi.fn(),
        onOpenDraftDialog: vi.fn(),
      },
      overlays: null,
      clearDraftBinding,
      commitLoadedDraftBinding,
    })),
  };
});

vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicPanel({ actions }: { actions: ReactNode }) {
      return <div data-testid="dynamic-panel">{actions}</div>;
    },
}));

vi.mock("@/workspaces/shared", () => ({
  useWorkspaceDraftSupport: useWorkspaceDraftSupportMock,
}));

vi.mock("@/hooks/useAutoPreview", () => ({
  useAutoPreview: useAutoPreviewMock,
}));

vi.mock("@/lib/param-download", () => ({
  downloadParamFile: vi.fn(),
}));

vi.mock("@/components/PanelActionSection", () => ({
  PanelActionSection({ adapter }: { adapter: import("@/workspaces/draft-action-area").DraftActionAreaAdapter }) {
    return (
      <div
        data-testid={`actions-${adapter.kind}`}
        data-generate-state={adapter.state.generate.state}
        data-export-state={adapter.state.exportWhole.state}
        data-stale={String(adapter.state.stale)}
        data-can-split={adapter.kind === "stepped" ? String(adapter.state.exportSplit.state === "available") : undefined}
      >
        {adapter.kind === "automatic" ? (
          <button type="button" onClick={() => void adapter.perform({ type: "set-auto-preview", enabled: !adapter.state.preview.enabled })}>
            自动预览
          </button>
        ) : null}
        <button type="button" onClick={() => void adapter.perform({ type: "generate" })}>锻造</button>
        <button type="button" onClick={() => void adapter.perform({ type: "export-whole" })}>完整导出</button>
        {adapter.kind === "stepped" ? (
          <button type="button" onClick={() => void adapter.perform({ type: "export-split" })}>分件导出</button>
        ) : null}
        <button type="button" onClick={() => void adapter.perform({ type: "reset" })}>重置</button>
        <button type="button" onClick={() => void adapter.perform({ type: "import-params", file: new File(["{}"], "params.json") })}>导入</button>
      </div>
    );
  },
}));

import { useGridWorkspace } from "@/workspaces/grid/useGridWorkspace";
import { useCustomWorkspace } from "@/workspaces/custom/useCustomWorkspace";
import { useSteppedWorkspace } from "@/workspaces/stepped/useSteppedWorkspace";
import { useBaseConverterWorkspace } from "@/workspaces/base-converter/useBaseConverterWorkspace";

function renderWorkspacePanel(panel: ReactNode) {
  return render(<>{panel}</>);
}

describe("Mode Workspace Draft Action Area", () => {
  beforeEach(() => {
    clearDraftBindingMock.mockReset();
    useAutoPreviewMock.mockReset();
    useWorkspaceDraftSupportMock.mockClear();
    commitLoadedDraftBindingMock.mockReset();
    requestResetMock.mockReset();
    requestDraftLoadMock.mockReset();
  });

  it("grid 仅在活动面板挂载后启用自动预览，并路由重置与导入", async () => {
    const onRequestParamImport = vi.fn(async () => ({ status: "success" as const }));
    const model = {
      params: DEFAULT_TRAY_PARAMS,
      replaceParams: vi.fn(),
      resetParams: vi.fn(),
      updateParam: vi.fn(),
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      isGenerating: false,
      isPreviewStale: true,
      volume: 0,
    };
    const { result } = renderHook(() => useGridWorkspace({
      model: model as never,
      onRequestParamImport,
      onRequestReset: requestResetMock,
      onRequestDraftLoad: requestDraftLoadMock,
    }));

    expect(useAutoPreviewMock).not.toHaveBeenCalled();
    renderWorkspacePanel(result.current.panel);
    expect(screen.getByTestId("actions-automatic")).toHaveAttribute(
      "data-stale",
      "true",
    );
    expect(useAutoPreviewMock).toHaveBeenLastCalledWith(
      DEFAULT_TRAY_PARAMS,
      expect.objectContaining({ enabled: false, isBlocked: false }),
    );

    fireEvent.click(screen.getByRole("button", { name: "自动预览" }));
    fireEvent.click(screen.getByRole("button", { name: "锻造" }));
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    fireEvent.click(screen.getByRole("button", { name: "导入" }));

    expect(useAutoPreviewMock).toHaveBeenLastCalledWith(
      DEFAULT_TRAY_PARAMS,
      expect.objectContaining({ enabled: true }),
    );
    expect(model.handleGenerate).toHaveBeenCalledTimes(1);
    expect(requestResetMock).toHaveBeenCalledTimes(1);
    expect(model.resetParams).not.toHaveBeenCalled();
    await waitFor(() => expect(onRequestParamImport).toHaveBeenCalledTimes(1));
    expect(clearDraftBindingMock).not.toHaveBeenCalled();
    act(() => result.current.replacementTarget.commitReset());
    expect(model.resetParams).toHaveBeenCalledTimes(1);
    expect(clearDraftBindingMock).toHaveBeenCalledTimes(1);
    expect(model.replaceParams).not.toHaveBeenCalled();
    act(() => result.current.replacementTarget.commitImport({
      ...DEFAULT_TRAY_PARAMS,
      rows: 3,
    }));
    expect(clearDraftBindingMock).toHaveBeenCalledTimes(2);
    expect(model.replaceParams).toHaveBeenCalledWith(
      expect.objectContaining({ rows: 3 }),
    );
  });

  it("grid 适配违规会阻断自动预览、锻造和完整导出", () => {
    const model = {
      params: DEFAULT_TRAY_PARAMS,
      replaceParams: vi.fn(),
      resetParams: vi.fn(),
      updateParam: vi.fn(),
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      isGenerating: false,
      isPreviewStale: true,
      volume: 0,
      baseHoleFitViolations: [],
      baseHoleFitBlockingReason: "底板孔位不适配",
    };
    const { result } = renderHook(() => useGridWorkspace({
      model: model as never,
      onRequestParamImport: vi.fn(async () => ({ status: "success" as const })),
      onRequestReset: requestResetMock,
      onRequestDraftLoad: requestDraftLoadMock,
    }));

    renderWorkspacePanel(result.current.panel);

    expect(useAutoPreviewMock).toHaveBeenCalledWith(
      DEFAULT_TRAY_PARAMS,
      expect.objectContaining({ isBlocked: true }),
    );
    expect(screen.getByTestId("actions-automatic")).toHaveAttribute(
      "data-generate-state",
      "blocked",
    );
    expect(screen.getByTestId("actions-automatic")).toHaveAttribute(
      "data-export-state",
      "blocked",
    );
  });

  it("转换底盘默认启用 300ms 自动预览，并在几何不兼容时阻断生成与导出", () => {
    const source = SOURCE_BASE_STANDARDS.find(
      (entry) => entry.id === "source-50x100",
    )!;
    const target = TARGET_BASE_STANDARDS.find(
      (entry) => entry.id === "target-circle-50",
    )!;
    const params = {
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: source.id,
      targetStandardId: target.id,
      geometrySnapshot: createConversionGeometrySnapshot(source, target),
    };
    const model = {
      params,
      viewParams: params,
      replaceParams: vi.fn(),
      resetParams: vi.fn(),
      updateParam: vi.fn(),
      updateParams: vi.fn(),
      beginContinuousEdit: vi.fn(),
      previewParam: vi.fn(),
      commitContinuousEdit: vi.fn(),
      cancelContinuousEdit: vi.fn(),
      undo: vi.fn(),
      canUndo: false,
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      isGenerating: false,
      isPreviewStale: true,
      volume: 0,
    };
    const { result } = renderHook(() => useBaseConverterWorkspace({
      model: model as never,
      onRequestParamImport: vi.fn(async () => ({ status: "success" as const })),
      onRequestReset: requestResetMock,
      onRequestDraftLoad: requestDraftLoadMock,
    }));

    renderWorkspacePanel(result.current.panel);

    expect(useAutoPreviewMock).toHaveBeenCalledWith(
      params,
      expect.objectContaining({
        enabled: true,
        isBlocked: true,
        delayMs: 300,
      }),
    );
    expect(screen.getByTestId("actions-automatic")).toHaveAttribute(
      "data-generate-state",
      "blocked",
    );
    expect(screen.getByTestId("actions-automatic")).toHaveAttribute(
      "data-export-state",
      "blocked",
    );
  });

  it("简版孔位非法时阻断 3D 与 STL，但保留自动预览编辑上下文", () => {
    const params = {
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "push-fit" as const,
      pushFitHexHole: { acrossFlats: 3, offsetX: 30, offsetY: 0 },
    };
    const model = {
      params,
      viewParams: params,
      replaceParams: vi.fn(),
      resetParams: vi.fn(),
      updateParam: vi.fn(),
      updateParams: vi.fn(),
      beginContinuousEdit: vi.fn(),
      previewParam: vi.fn(),
      previewParams: vi.fn(),
      commitContinuousEdit: vi.fn(),
      cancelContinuousEdit: vi.fn(),
      undo: vi.fn(),
      canUndo: false,
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      isGenerating: false,
      isPreviewStale: true,
      volume: 0,
    };
    const { result } = renderHook(() => useBaseConverterWorkspace({
      model: model as never,
      onRequestParamImport: vi.fn(async () => ({ status: "success" as const })),
      onRequestReset: requestResetMock,
      onRequestDraftLoad: requestDraftLoadMock,
    }));

    renderWorkspacePanel(result.current.panel);

    expect(useAutoPreviewMock).toHaveBeenCalledWith(
      params,
      expect.objectContaining({ isBlocked: true }),
    );
    expect(screen.getByTestId("actions-automatic")).toHaveAttribute(
      "data-generate-state",
      "blocked",
    );
    expect(screen.getByTestId("actions-automatic")).toHaveAttribute(
      "data-export-state",
      "blocked",
    );
  });

  it("custom 的自动预览状态随 Draft Action Area 挂载，并路由外部参数提交", async () => {
    const onRequestParamImport = vi.fn(async () => ({ status: "success" as const }));
    const persistedParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      trayWidth: 180,
    };
    const model = {
      params: CUSTOM_LAYOUT_DEFAULTS,
      persistedParams,
      setParams: vi.fn(),
      updateParam: vi.fn(),
      effectiveDimensions: { width: 120, depth: 140 },
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      isGenerating: false,
      isPreviewStale: true,
      volume: 0,
    };
    const { result } = renderHook(() => useCustomWorkspace({
      model: model as never,
      interactionState: { selectedSlotIds: [] } as never,
      onRequestParamImport,
      onRequestReset: requestResetMock,
      onRequestDraftLoad: requestDraftLoadMock,
    }));

    expect(useAutoPreviewMock).not.toHaveBeenCalled();
    renderWorkspacePanel(result.current.panel);
    expect(screen.getByTestId("actions-automatic")).toHaveAttribute(
      "data-stale",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "自动预览" }));
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    fireEvent.click(screen.getByRole("button", { name: "导入" }));

    expect(useAutoPreviewMock).toHaveBeenLastCalledWith(
      persistedParams,
      expect.objectContaining({ enabled: true }),
    );
    expect(useWorkspaceDraftSupportMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: persistedParams }),
    );
    await waitFor(() => expect(onRequestParamImport).toHaveBeenCalledTimes(1));
    expect(requestResetMock).toHaveBeenCalledTimes(1);
    expect(clearDraftBindingMock).not.toHaveBeenCalled();
    act(() => result.current.replacementTarget.commitReset());
    expect(model.setParams).toHaveBeenNthCalledWith(1, CUSTOM_LAYOUT_DEFAULTS);
    act(() => result.current.replacementTarget.commitImport({
      ...CUSTOM_LAYOUT_DEFAULTS,
      trayWidth: 180,
    }));
    expect(clearDraftBindingMock).toHaveBeenCalledTimes(2);
    expect(model.setParams).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ trayWidth: 180 }),
    );
  });

  it("stepped 在重置和导入后清除 Mode Interaction State", async () => {
    const onRequestParamImport = vi.fn(async () => ({ status: "success" as const }));
    const resetInteractionState = vi.fn();
    const model = {
      params: STEPPED_LAYOUT_DEFAULTS,
      setParams: vi.fn(),
      effectiveDimensions: { width: 120, depth: 140 },
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      isGenerating: false,
      isPreviewStale: true,
    };
    const interactionState = {
      selectedSlotIds: [],
      previewGroupId: null,
      activeSteppedGroupId: null,
      setPreviewGroupId: vi.fn(),
      setActiveSteppedGroupId: vi.fn(),
      resetInteractionState,
    };
    const { result } = renderHook(() =>
      useSteppedWorkspace({
        model: model as never,
        interactionState: interactionState as never,
        onRequestParamImport,
        onRequestReset: requestResetMock,
        onRequestDraftLoad: requestDraftLoadMock,
      }),
    );
    renderWorkspacePanel(result.current.panel);

    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    fireEvent.click(screen.getByRole("button", { name: "导入" }));

    await waitFor(() => expect(onRequestParamImport).toHaveBeenCalledTimes(1));
    expect(requestResetMock).toHaveBeenCalledTimes(1);
    expect(resetInteractionState).not.toHaveBeenCalled();
    act(() => result.current.replacementTarget.commitReset());
    act(() => result.current.replacementTarget.commitImport(STEPPED_LAYOUT_DEFAULTS));
    expect(resetInteractionState).toHaveBeenCalledTimes(2);
    expect(clearDraftBindingMock).toHaveBeenCalledTimes(2);
  });

  it("统一阶梯模式保留分件导出条件", () => {
    const onRequestParamImport = vi.fn(async () => ({ status: "success" as const }));
    const model = {
      params: {
        ...STEPPED_LAYOUT_DEFAULTS,
        enableSplitAssembly: true,
        groups: [
          ...STEPPED_LAYOUT_DEFAULTS.groups,
          { ...STEPPED_LAYOUT_DEFAULTS.groups[0], id: "group-2" },
        ],
        slots: [{ id: "slot-1" }],
      },
      setParams: vi.fn(),
      effectiveDimensions: { width: 120, depth: 140 },
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      handleExportSplitParts: vi.fn(),
      isGenerating: false,
      isPreviewStale: false,
    };
    const resetInteractionState = vi.fn();
    const { result } = renderHook(() =>
      useSteppedWorkspace({
        model: model as never,
        interactionState: {
          selectedSlotIds: [],
          previewGroupId: null,
          activeSteppedGroupId: null,
          setPreviewGroupId: vi.fn(),
          setActiveSteppedGroupId: vi.fn(),
          resetInteractionState,
        } as never,
        onRequestParamImport,
        onRequestReset: requestResetMock,
        onRequestDraftLoad: requestDraftLoadMock,
      }),
    );
    renderWorkspacePanel(result.current.panel);

    expect(screen.getByTestId("actions-stepped")).toHaveAttribute(
      "data-can-split",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "完整导出" }));
    fireEvent.click(screen.getByRole("button", { name: "分件导出" }));

    expect(model.handleExportSTL).toHaveBeenCalledTimes(1);
    expect(model.handleExportSplitParts).toHaveBeenCalledTimes(1);
    expect(useWorkspaceDraftSupportMock).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "stepped" }),
    );
  });
});
