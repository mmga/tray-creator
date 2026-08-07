import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppMode,
  CustomLayoutParams,
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";

const {
  gridModelMock,
  customModelMock,
  baseConverterModelMock,
  steppedModelMock,
  gridDraftsMock,
  customDraftsMock,
  steppedDraftsMock,
} = vi.hoisted(() => {
  const gridParams: TrayParams = {
    rows: 2,
    columns: 3,
    holeDiameter: 32,
    spacing: 5,
    spacingIndependent: false,
    spacingX: 5,
    spacingY: 5,
    boundarySpacing: 5,
    boundarySpacingIndependent: false,
    halfCircleSlots: false,
    basePlateOnly: false,
    baseThickness: 3,
    holeDepth: 3,
    cornerRadius: 4,
    sideBevelWidth: 0,
    baseHoleStructure: "magnetic-base-hole",
    magnetPostHoleDiameter: 5,
    magnetPostHoleDepth: 2,
    baseHoleSize: "25",
  };

  const customParams: CustomLayoutParams = {
    trayWidth: 260,
    trayDepth: 260,
    slots: [
      {
        id: "custom-slot-1",
        x: 80,
        y: 90,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
      },
    ],
    spacing: 5,
    boundarySpacing: 5,
    boundarySpacingIndependent: false,
    baseThickness: 3,
    holeDepth: 3,
    cornerRadius: 4,
    sideBevelWidth: 0,
    baseHoleStructure: "none",
    magnetPostHoleDiameter: 5,
    magnetPostHoleDepth: 2,
    baseHoleSize: "25",
  };

  const steppedParams: SteppedLayoutParams = {
    trayWidth: 260,
    trayDepth: 260,
    slots: [
      {
        id: "slot-1",
        x: 100,
        y: 120,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "group-1",
      },
    ],
    groups: [
      {
        id: "group-1",
        name: "组 1",
        color: "#22c55e",
        bottomHeight: 10,
        useGroupSmoothingRadius: false,
        groupSmoothingRadius: 60,
        useGroupDisconnectDistance: false,
        groupDisconnectDistance: 0,
      },
    ],
    spacing: 5,
    holeDepth: 3,
    splitGrooveDepth: 2,
    enableSplitAssembly: false,
    smoothingRadius: 60,
    disconnectDistance: 0,
    baseHoleStructure: "none",
    magnetPostHoleDiameter: 5,
    magnetPostHoleDepth: 2,
    baseHoleSize: "25",
  };
  const baseConverterParams = {
    sourceStandardId: "source-20x20",
    targetStandardId: "target-circle-25",
    geometrySnapshot: {
      source: {
        standardId: "source-20x20",
        name: "20 × 20mm",
        shape: "rectangle" as const,
        nominalWidth: 20,
        nominalDepth: 20,
        fitWidth: 20,
        fitDepth: 20,
        cornerRadius: 0,
      },
      target: {
        standardId: "target-circle-25",
        name: "Ø25mm",
        shape: "circle" as const,
        width: 25,
        depth: 25,
        profileExponent: 2,
      },
    },
    conversionClearance: 0.2,
    floorThickness: 1.2,
    recessDepth: 2,
    sideBevelWidth: 0,
  };

  const outlinePreview: GroupOutlinePreview[] = [
    {
      key: "group-1-outline",
      groupId: "group-1",
      color: "#22c55e",
      bottomHeight: 10,
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 15, y: 20 },
      ],
    },
  ];

  const optimizationProposals = [
    {
      id: "compact",
      label: "最紧凑",
      description: "优先压缩整体占地面积。",
      params: steppedParams,
      metrics: {
        width: 140,
        depth: 120,
        area: 16800,
        displacement: 20,
        hasBridgeWarning: false,
        isOversized: false,
      },
    },
  ];

  const createDraftControllerMock = (mode: AppMode) => ({
    isDialogOpen: mode === "stepped",
    getDraftList: vi.fn(() => [
      {
        id: `${mode}-draft-1`,
        mode,
        title: `${mode} Draft 1`,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        ...(mode === "grid"
          ? {
              rows: 2,
              columns: 3,
              structureMode: "full" as const,
              baseSizeLabel: "32mm",
              trayWidth: 110,
              trayDepth: 80,
            }
          : mode === "custom"
            ? {
                slotCount: 1,
                trayWidth: 260,
                trayDepth: 260,
              }
            : {
                  slotCount: 1,
                  groupCount: 1,
                  trayWidth: 260,
                  trayDepth: 260,
                }),
      },
    ]),
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    saveCurrentDraft: vi.fn(),
    currentDraftId: `${mode}-draft-1`,
    draftNameInput: `${mode} Draft 1`,
    hasUnsavedChanges: mode === "custom",
    setDraftNameInput: vi.fn(),
    saveAsNewDraft: vi.fn(),
    prepareDraftLoad: vi.fn((id: string) => ({
      id,
      title: `${mode} Draft 1`,
      snapshot: { mode, params: mode === "grid" ? gridParams : mode === "custom" ? customParams : steppedParams },
      serializedParams: "{}",
    })),
    commitLoadedDraftBinding: vi.fn(),
    renameDraftItem: vi.fn(),
    deleteDraftItem: vi.fn(),
    exportDraftItem: vi.fn(),
    clearDraftBinding: vi.fn(),
  });

  return {
    gridModelMock: {
      params: gridParams,
      updateParam: vi.fn(),
      replaceParams: vi.fn(),
      resetParams: vi.fn(),
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      isGenerating: false,
      volume: 0,
      threeGeometry: { id: "grid-geometry" },
      isPreviewStale: false,
    },
    customModelMock: {
      params: customParams,
      effectiveDimensions: { width: 120, depth: 140 },
      setParams: vi.fn(),
      updateParam: vi.fn(),
      addSlot: vi.fn(),
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      isGenerating: false,
      volume: 42,
      threeGeometry: { id: "custom-geometry" },
      isPreviewStale: true,
      updateSlotPosition: vi.fn(),
      removeSlot: vi.fn(),
      updateSlotRotation: vi.fn(),
      updateMultipleSlots: vi.fn(),
      updateMultipleSlotsLive: vi.fn(),
      insertSlots: vi.fn(),
      duplicateSlots: vi.fn(),
      undo: vi.fn(),
      saveSnapshot: vi.fn(),
    },
    baseConverterModelMock: {
      params: baseConverterParams,
      viewParams: baseConverterParams,
      updateParam: vi.fn(),
      updateParams: vi.fn(),
      beginContinuousEdit: vi.fn(),
      previewParam: vi.fn(),
      commitContinuousEdit: vi.fn(),
      cancelContinuousEdit: vi.fn(),
      undo: vi.fn(),
      canUndo: false,
      replaceParams: vi.fn(),
      resetParams: vi.fn(),
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      isGenerating: false,
      volume: 12,
      threeGeometry: { id: "base-converter-geometry" },
      isPreviewStale: false,
    },
    steppedModelMock: {
      params: steppedParams,
      effectiveDimensions: { width: 150, depth: 160 },
      isPreviewStale: true,
      setParams: vi.fn(),
      updateParam: vi.fn(),
      addSlot: vi.fn(),
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      isGenerating: false,
      volume: 55,
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
      updateSlotPosition: vi.fn(),
      removeSlot: vi.fn(),
      updateSlotRotation: vi.fn(),
      updateMultipleSlots: vi.fn(),
      updateMultipleSlotsLive: vi.fn(),
      insertSlots: vi.fn(),
      duplicateSlots: vi.fn(),
      undo: vi.fn(),
      saveSnapshot: vi.fn(),
      cancelContinuousEdit: vi.fn(),
      outlinePreview,
      pauseOutlinePreview: vi.fn(),
      resumeOutlinePreview: vi.fn(),
      optimizationProposals,
      isOptimizingLayout: false,
      generateOptimizationProposals: vi.fn(),
      applyOptimizationProposal: vi.fn(),
      clearOptimizationProposals: vi.fn(),
      threeGeometry: { id: "stepped-geometry" },
      canUndo: true,
    },
    steppedCadModelMock: {
      params: steppedParams,
      effectiveDimensions: { width: 152, depth: 162 },
      isPreviewStale: true,
      setParams: vi.fn(),
      updateParam: vi.fn(),
      addSlot: vi.fn(),
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
      handleGenerateSplitPreview: vi.fn(),
      handleExportSplitParts: vi.fn(),
      isGenerating: false,
      isGeneratingSplitPreview: false,
      volume: 58,
      addGroup: vi.fn(),
      removeGroup: vi.fn(),
      updateGroupHeight: vi.fn(),
      updateGroupSmoothingOverride: vi.fn(),
      updateGroupSmoothingRadius: vi.fn(),
      updateGroupDisconnectOverride: vi.fn(),
      updateGroupDisconnectDistance: vi.fn(),
      updateGroupSplitPartTarget: vi.fn(),
      setActiveGroup: vi.fn(),
      moveSelectedSlotsToGroup: vi.fn(),
      reorderGroups: vi.fn(),
      bridgeWarning: null,
      updateSlotPosition: vi.fn(),
      removeSlot: vi.fn(),
      updateSlotRotation: vi.fn(),
      updateMultipleSlots: vi.fn(),
      updateMultipleSlotsLive: vi.fn(),
      insertSlots: vi.fn(),
      duplicateSlots: vi.fn(),
      undo: vi.fn(),
      saveSnapshot: vi.fn(),
      outlinePreview,
      pauseOutlinePreview: vi.fn(),
      resumeOutlinePreview: vi.fn(),
      optimizationProposals,
      isOptimizingLayout: false,
      generateOptimizationProposals: vi.fn(),
      applyOptimizationProposal: vi.fn(),
      clearOptimizationProposals: vi.fn(),
      clearSplitPreview: vi.fn(),
      threeGeometry: { id: "stepped-cad-geometry" },
      splitPreviewParts: null,
      canUndo: true,
    },
    gridDraftsMock: createDraftControllerMock("grid"),
    customDraftsMock: createDraftControllerMock("custom"),
    steppedDraftsMock: createDraftControllerMock("stepped"),
  };
});

vi.mock("next/dynamic", async () => {
  const ReactModule = await import("react");

  return {
    default(
      loader: () => Promise<unknown>,
      options?: { loading?: () => React.ReactNode },
    ) {
      return function DynamicComponent(props: unknown) {
        const [Resolved, setResolved] =
          ReactModule.useState<React.ComponentType<unknown> | null>(null);

        ReactModule.useEffect(() => {
          let active = true;

          void loader().then((module) => {
            if (!active) {
              return;
            }
            // 兼容两种动态导入写法：
            //   - `import("...")`           → module.default
            //   - `import("...").then(m => m.SteppedLayoutPanel)` → 直接为组件
            const resolved =
              typeof module === "function"
                ? (module as React.ComponentType<unknown>)
                : (module as { default?: React.ComponentType<unknown> }).default;
            if (resolved) {
              setResolved(() => resolved);
            }
          });

          return () => {
            active = false;
          };
        }, []);

        if (!Resolved) {
          return options?.loading ? options.loading() : null;
        }

        return <Resolved {...(props as Record<string, unknown>)} />;
      };
    },
  };
});

vi.mock("@/hooks/useTrayModel", () => ({
  useTrayModel: () => gridModelMock,
}));

vi.mock("@/hooks/useCustomLayout", () => ({
  useCustomLayout: () => customModelMock,
}));

vi.mock("@/hooks/useBaseConverter", () => ({
  useBaseConverter: () => baseConverterModelMock,
}));

vi.mock("@/hooks/useSteppedLayout", () => ({
  useSteppedLayout: () => steppedModelMock,
}));

vi.mock("@/hooks/useModeDrafts", () => ({
  useModeDrafts: ({ mode }: { mode: AppMode }) => {
    if (mode === "grid") {
      return gridDraftsMock;
    }
    if (mode === "custom") {
      return customDraftsMock;
    }
    return steppedDraftsMock;
  },
}));

vi.mock("@/components/ModeTabs", () => ({
  ModeTabs({
    mode,
    onModeChange,
  }: {
    mode: AppMode;
    onModeChange: (mode: AppMode) => void;
  }) {
    return (
      <div data-testid="mode-tabs" data-mode={mode}>
        <button type="button" onClick={() => onModeChange("grid")}>
          切到网格
        </button>
        <button type="button" onClick={() => onModeChange("custom")}>
          切到自定义
        </button>
        <button type="button" onClick={() => onModeChange("base-converter")}>
          切到转换底盘
        </button>
        <button type="button" onClick={() => onModeChange("stepped")}>
          切到阶梯
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/ParameterPanel", () => ({
  default() {
    return <div data-testid="parameter-panel" />;
  },
}));

vi.mock("@/components/CustomPanel", () => ({
  default() {
    return <div data-testid="custom-panel" />;
  },
}));

vi.mock("@/components/SteppedPanel", () => ({
  SteppedLayoutPanel(props: SteppedPanelMockProps) {
    return SteppedPanelMock(props);
  },
}));

interface SteppedPanelMockProps {
  selectedSlotIds: string[];
  previewGroupId: string | null;
  draftActions?: {
    currentDraftId: string | null;
    hasUnsavedChanges: boolean;
    onSaveDraft: () => void;
    onOpenDraftDialog: () => void;
  };
  onPreviewGroupChange: (groupId: string | null) => void;
  optimizationProposals: { id: string }[];
  isOptimizingLayout: boolean;
  onGenerateOptimizationProposals: () => void;
  onApplyOptimizationProposal: (proposalId: string) => void;
  onClearOptimizationProposals: () => void;
}

function SteppedPanelMock({
  selectedSlotIds,
  previewGroupId,
  draftActions,
  onPreviewGroupChange,
  optimizationProposals,
  isOptimizingLayout,
  onGenerateOptimizationProposals,
  onApplyOptimizationProposal,
  onClearOptimizationProposals,
}: SteppedPanelMockProps) {
  return (
    <div
      data-testid="stepped-panel"
      data-selected-slot-ids={selectedSlotIds.join(",")}
      data-preview-group-id={previewGroupId ?? ""}
      data-current-draft-id={draftActions?.currentDraftId ?? ""}
      data-optimization-count={optimizationProposals.length}
      data-optimizing={String(isOptimizingLayout)}
    >
      <button type="button" onClick={() => onPreviewGroupChange("group-1")}>
        设置预览组
      </button>
      <button type="button" onClick={onGenerateOptimizationProposals}>
        生成优化建议
      </button>
      <button
        type="button"
        onClick={() => onApplyOptimizationProposal(optimizationProposals[0]?.id ?? "")}
      >
        应用优化建议
      </button>
      <button type="button" onClick={onClearOptimizationProposals}>
        清空优化建议
      </button>
      {draftActions ? (
        <>
          <button type="button" onClick={draftActions.onSaveDraft}>
            {draftActions.currentDraftId ? "更新草稿" : "保存草稿"}
          </button>
          <button type="button" onClick={draftActions.onOpenDraftDialog}>
            草稿列表
          </button>
        </>
      ) : null}
    </div>
  );
}

vi.mock("@/components/LayoutCanvas", () => ({
  default({
    isActive,
    model,
    commands,
  }: {
    isActive?: boolean;
    model: {
      overlays: {
        focusedGroupId?: string | null;
        groupOutlines?: GroupOutlinePreview[] | null;
        rowBands?: Array<{ id: string }>;
      };
      interactions: {
        slotMoveScopeResolver?: (
          draggingId: string,
          selectedIds: string[],
        ) => string[];
      };
    };
    commands: {
      resizeTray?: (width: number, depth: number) => void;
      selectionChanged?: (ids: string[]) => void;
      editInteractionChanged?: (isInteracting: boolean) => void;
    };
  }) {
    const scopedDragIds = model.interactions.slotMoveScopeResolver?.("simple-slot-1", [
      "simple-slot-1",
      "simple-slot-2",
      "simple-slot-3",
    ]) ?? [];

    return (
      <div
        data-testid="layout-canvas"
        data-active={String(Boolean(isActive))}
        data-focused-group-id={model.overlays.focusedGroupId ?? ""}
        data-outline-count={model.overlays.groupOutlines?.length ?? 0}
        data-row-band-count={model.overlays.rowBands?.length ?? 0}
        data-has-resize-tray={String(Boolean(commands.resizeTray))}
        data-scoped-drag-ids={scopedDragIds.join(",")}
      >
        <button
          type="button"
          onClick={() => commands.selectionChanged?.(["slot-1"])}
        >
          选择阶梯槽位
        </button>
        <button
          type="button"
          onClick={() => commands.editInteractionChanged?.(true)}
        >
          开始编辑
        </button>
        <button
          type="button"
          onClick={() => commands.editInteractionChanged?.(false)}
        >
          结束编辑
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/TrayViewer", () => ({
  default({
    geometry,
    isStale,
    isGenerating,
  }: {
    geometry: { id?: string } | null;
    isStale?: boolean;
    isGenerating?: boolean;
  }) {
    return (
      <div
        data-testid="tray-viewer"
        data-geometry-id={geometry?.id ?? ""}
        data-is-stale={String(Boolean(isStale))}
        data-is-generating={String(Boolean(isGenerating))}
      />
    );
  },
}));

vi.mock("@/components/DraftManagerDialog", () => ({
  DraftManagerDialog({
    mode,
    open,
    drafts,
    currentDraftId,
    hasUnsavedChanges,
    onOpenChange,
    onSaveAsNew,
    onSaveCurrent,
    onLoad,
    onRename,
    onDelete,
    onExport,
    renderSummary,
  }: {
    mode: AppMode;
    open: boolean;
    drafts: Array<{ id: string }>;
    currentDraftId: string | null;
    hasUnsavedChanges: boolean;
    onOpenChange: (open: boolean) => void;
    onSaveAsNew: () => void;
    onSaveCurrent: () => void;
    onLoad: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
    onExport: (id: string) => void;
    renderSummary: (item: { id: string }) => React.ReactNode;
  }) {
    return (
      <div
        data-testid="draft-manager-dialog"
        data-mode={mode}
        data-open={String(open)}
        data-draft-count={drafts.length}
        data-current-draft-id={currentDraftId ?? ""}
        data-has-unsaved={String(hasUnsavedChanges)}
      >
        <div>{renderSummary(drafts[0] ?? { id: "empty" })}</div>
        <button type="button" onClick={() => onOpenChange(true)}>
          打开草稿弹窗
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          关闭草稿弹窗
        </button>
        <button type="button" onClick={onSaveAsNew}>
          草稿另存
        </button>
        <button type="button" onClick={onSaveCurrent}>
          覆盖草稿
        </button>
        <button type="button" onClick={() => onLoad("draft-1")}>
          加载草稿
        </button>
        <button type="button" onClick={() => onRename("draft-1", "Renamed")}>
          重命名草稿
        </button>
        <button type="button" onClick={() => onDelete("draft-1")}>
          删除草稿
        </button>
        <button type="button" onClick={() => onExport("draft-1")}>
          导出草稿
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/ui/tabs", async () => {
  const ReactModule = await import("react");

  const TabsContext = ReactModule.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  return {
    Tabs({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
    }) {
      return (
        <TabsContext.Provider value={{ value, onValueChange }}>
          <div data-testid="tabs-root">{children}</div>
        </TabsContext.Provider>
      );
    },
    TabsList({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
      return <div data-testid="tabs-list" {...props}>{children}</div>;
    },
    TabsTrigger({
      value,
      children,
      onKeyDown,
    }: {
      value: string;
      children: React.ReactNode;
      onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
    }) {
      const { value: activeValue, onValueChange } =
        ReactModule.useContext(TabsContext);

      return (
        <button
          type="button"
          data-state={activeValue === value ? "active" : "inactive"}
          onClick={() => onValueChange?.(value)}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented) {
              return;
            }

            if (event.key === "ArrowRight") {
              if (value === "2d") {
                onValueChange?.("3d");
              } else if (value === "3d") {
                onValueChange?.("2d");
              }
            }

            if (event.key === "ArrowLeft") {
              if (value === "3d") {
                onValueChange?.("2d");
              } else if (value === "2d") {
                onValueChange?.("3d");
              }
            }
          }}
        >
          {children}
        </button>
      );
    },
  };
});

import Home from "@/app/page";

describe("Home page", { timeout: 15000 }, () => {
  it("在窄屏采用上下分区，并为参数与视口区域提供名称", () => {
    render(<Home />);

    expect(screen.getByRole("complementary", { name: "参数面板" })).toHaveClass(
      "h-[46%]",
      "w-full",
      "md:h-full",
      "md:w-[380px]",
    );
    expect(screen.getByRole("region", { name: "建模视口" })).toHaveClass(
      "min-h-0",
      "min-w-0",
    );
  });

  beforeEach(() => {
    gridModelMock.handleGenerate.mockReset();
    customModelMock.handleGenerate.mockReset();
    baseConverterModelMock.handleGenerate.mockReset();
    baseConverterModelMock.isPreviewStale = false;
    steppedModelMock.handleGenerate.mockReset();
    steppedModelMock.setActiveGroup.mockReset();
    steppedModelMock.pauseOutlinePreview.mockReset();
    steppedModelMock.resumeOutlinePreview.mockReset();
    steppedModelMock.cancelContinuousEdit.mockReset();
    steppedModelMock.generateOptimizationProposals.mockReset();
    steppedModelMock.applyOptimizationProposal.mockReset();
    steppedModelMock.clearOptimizationProposals.mockReset();
    steppedModelMock.isOptimizingLayout = false;
    for (const draftMock of [
      gridDraftsMock,
      customDraftsMock,
      steppedDraftsMock,
    ]) {
      draftMock.getDraftList.mockClear();
      draftMock.openDialog.mockReset();
      draftMock.closeDialog.mockReset();
      draftMock.saveCurrentDraft.mockReset();
      draftMock.saveAsNewDraft.mockReset();
      draftMock.prepareDraftLoad.mockReset();
      draftMock.commitLoadedDraftBinding.mockReset();
      draftMock.renameDraftItem.mockReset();
      draftMock.deleteDraftItem.mockReset();
      draftMock.exportDraftItem.mockReset();
      draftMock.clearDraftBinding.mockReset();
    }
  });

  it("switches to custom 3D view and regenerates stale previews", async () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "切到自定义" }));
    await screen.findByTestId("custom-panel");

    fireEvent.click(screen.getByRole("button", { name: "3D 预览" }));

    await waitFor(() => {
      expect(customModelMock.handleGenerate).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("layout-canvas").closest("[inert]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "选择阶梯槽位" })).not.toBeInTheDocument();
    expect(screen.getByTestId("tray-viewer")).toHaveAttribute(
      "data-geometry-id",
      "custom-geometry",
    );
    expect(screen.getByTestId("tray-viewer")).toHaveAttribute(
      "data-is-stale",
      "true",
    );
  });

  it("does not switch 2D and 3D views on left or right arrow keys", async () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "切到自定义" }));
    await screen.findByTestId("custom-panel");

    const twoDTrigger = screen.getByRole("button", { name: "2D 编辑" });
    twoDTrigger.focus();
    fireEvent.keyDown(twoDTrigger, { key: "ArrowRight" });

    expect(screen.getByRole("button", { name: "2D 编辑" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("button", { name: "3D 预览" })).toHaveAttribute(
      "data-state",
      "inactive",
    );

    const threeDTrigger = screen.getByRole("button", { name: "3D 预览" });
    threeDTrigger.focus();
    fireEvent.keyDown(threeDTrigger, { key: "ArrowLeft" });

    expect(screen.getByRole("button", { name: "2D 编辑" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("button", { name: "3D 预览" })).toHaveAttribute(
      "data-state",
      "inactive",
    );
  });

  it("wires base converter panel, 2D preview, and 3D generation", async () => {
    baseConverterModelMock.isPreviewStale = true;
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "切到转换底盘" }));
    expect(await screen.findByText("底盘转换")).toBeInTheDocument();
    expect(screen.getByLabelText("转换底盘 2D 图")).toBeInTheDocument();
    await waitFor(() => {
      expect(baseConverterModelMock.handleGenerate).toHaveBeenCalledTimes(1);
    });
    baseConverterModelMock.handleGenerate.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "3D 预览" }));
    await waitFor(() => {
      expect(baseConverterModelMock.handleGenerate).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("tray-viewer")).toHaveAttribute(
      "data-geometry-id",
      "base-converter-geometry",
    );
  });

  it("syncs stepped selection to the active group, pauses outline preview, and resets stepped UI state on mode changes", async () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "切到阶梯" }));
    await screen.findByTestId("stepped-panel");

    fireEvent.click(screen.getByRole("button", { name: "选择阶梯槽位" }));
    await waitFor(() => {
      expect(screen.getByTestId("stepped-panel")).toHaveAttribute(
        "data-selected-slot-ids",
        "slot-1",
      );
    });
    expect(steppedModelMock.setActiveGroup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "开始编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "结束编辑" }));
    expect(steppedModelMock.pauseOutlinePreview).toHaveBeenCalledTimes(1);
    expect(steppedModelMock.resumeOutlinePreview).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "设置预览组" }));
    await waitFor(() => {
      expect(screen.getByTestId("stepped-panel")).toHaveAttribute(
        "data-preview-group-id",
        "group-1",
      );
      expect(screen.getByTestId("stepped-panel")).toHaveAttribute(
        "data-selected-slot-ids",
        "slot-1",
      );
    });
    expect(screen.getByTestId("layout-canvas")).toHaveAttribute(
      "data-focused-group-id",
      "group-1",
    );

    // Mode Editor 退出源 Mode 时统一取消 Working Edit 并清理瞬态交互。
    fireEvent.click(screen.getByRole("button", { name: "切到网格" }));
    fireEvent.click(screen.getByRole("button", { name: "切到阶梯" }));

    await waitFor(() => {
      expect(screen.getByTestId("stepped-panel")).toHaveAttribute(
        "data-preview-group-id",
        "",
      );
      expect(screen.getByTestId("stepped-panel")).toHaveAttribute(
        "data-selected-slot-ids",
        "",
      );
    });
  });

  it("wires stepped optimization actions and state through the page", async () => {
    steppedModelMock.isOptimizingLayout = true;

    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "切到阶梯" }));
    await screen.findByTestId("stepped-panel");

    expect(screen.getByTestId("stepped-panel")).toHaveAttribute(
      "data-optimization-count",
      "1",
    );
    expect(screen.getByTestId("stepped-panel")).toHaveAttribute(
      "data-optimizing",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "生成优化建议" }));
    fireEvent.click(screen.getByRole("button", { name: "应用优化建议" }));
    fireEvent.click(screen.getByRole("button", { name: "清空优化建议" }));

    expect(
      steppedModelMock.generateOptimizationProposals,
    ).toHaveBeenCalledTimes(1);
    expect(steppedModelMock.applyOptimizationProposal).toHaveBeenCalledWith(
      "compact",
    );
    expect(steppedModelMock.clearOptimizationProposals).toHaveBeenCalledTimes(
      1,
    );
  });

  it("wires active mode draft dialog actions through the mode draft hooks and refreshes the list where needed", async () => {
    render(<Home />);
    await screen.findByTestId("draft-manager-dialog");
    gridDraftsMock.getDraftList.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "打开草稿弹窗" }));
    fireEvent.click(screen.getByRole("button", { name: "草稿另存" }));
    fireEvent.click(screen.getByRole("button", { name: "覆盖草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "加载草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "重命名草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "删除草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "导出草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭草稿弹窗" }));

    expect(gridDraftsMock.openDialog).toHaveBeenCalledTimes(1);
    expect(gridDraftsMock.saveAsNewDraft).toHaveBeenCalledTimes(1);
    expect(gridDraftsMock.saveCurrentDraft).toHaveBeenCalledTimes(1);
    expect(gridDraftsMock.prepareDraftLoad).toHaveBeenCalledWith("draft-1");
    expect(gridDraftsMock.commitLoadedDraftBinding).toHaveBeenCalledTimes(1);
    expect(gridDraftsMock.renameDraftItem).toHaveBeenCalledWith(
      "draft-1",
      "Renamed",
    );
    expect(gridDraftsMock.deleteDraftItem).toHaveBeenCalledWith("draft-1");
    expect(gridDraftsMock.exportDraftItem).toHaveBeenCalledWith("draft-1");
    expect(gridDraftsMock.closeDialog).toHaveBeenCalledTimes(1);
    expect(gridDraftsMock.getDraftList).toHaveBeenCalledTimes(5);
  });
});
