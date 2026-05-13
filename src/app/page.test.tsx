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
  simpleSteppedModelMock,
  steppedModelMock,
  gridDraftsMock,
  customDraftsMock,
  simpleSteppedDraftsMock,
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
    enableBaseHole: true,
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
    enableBaseHole: false,
    baseHoleSize: "25",
  };

  const simpleSteppedCanvasParams: CustomLayoutParams = {
    trayWidth: 180,
    trayDepth: 150,
    slots: [
      {
        id: "simple-slot-1",
        x: 72,
        y: 48,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
      },
      {
        id: "simple-slot-2",
        x: 112,
        y: 48,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
      },
      {
        id: "simple-slot-3",
        x: 90,
        y: 110,
        shape: "circle",
        width: 40,
        height: 40,
        rotation: 0,
      },
    ],
    spacing: 5,
    boundarySpacing: 5,
    boundarySpacingIndependent: false,
    baseThickness: 5,
    holeDepth: 3,
    cornerRadius: 4,
    enableBaseHole: false,
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
    activeGroupId: "group-1",
    spacing: 5,
    holeDepth: 3,
    smoothingRadius: 60,
    disconnectDistance: 0,
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
            : mode === "simple-stepped"
              ? {
                  rowCount: 2,
                  slotCount: 3,
                  trayWidth: 180,
                  trayDepth: 150,
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
    loadDraft: vi.fn(),
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
      outlinePreview,
      pauseOutlinePreview: vi.fn(),
      resumeOutlinePreview: vi.fn(),
      optimizationProposals,
      isOptimizingLayout: false,
      generateOptimizationProposals: vi.fn(),
      applyOptimizationProposal: vi.fn(),
      clearOptimizationProposals: vi.fn(),
      threeGeometry: { id: "stepped-geometry" },
    },
    simpleSteppedModelMock: {
      params: {
        trayWidth: 180,
        trayDepth: 150,
        rows: [
          { id: "row-1", name: "前排", slotIds: ["simple-slot-1", "simple-slot-2"] },
          { id: "row-2", name: "后排", slotIds: ["simple-slot-3"] },
        ],
        slots: [
          {
            id: "simple-slot-1",
            rowId: "row-1",
            shape: "circle",
            diameter: 25,
            x: -20,
            y: 0,
          },
          {
            id: "simple-slot-2",
            rowId: "row-1",
            shape: "circle",
            diameter: 25,
            x: 20,
            y: 0,
          },
          {
            id: "simple-slot-3",
            rowId: "row-2",
            shape: "circle",
            diameter: 40,
            x: 0,
            y: 0,
          },
        ],
        firstRowHeight: 5,
        stepHeight: 5,
        rowGap: 6,
        spacing: 5,
        outerMarginIndependent: false,
        outerMargin: 5,
        holeDepth: 3,
        cornerRadius: 4,
      },
      derivedLayout: {
        trayWidth: 180,
        trayDepth: 150,
        minimumTrayWidth: 180,
        minimumTrayDepth: 150,
        trayHeight: 10,
        highestTopHeight: 10,
        slotCount: 3,
        activeRows: [
          {
            id: "row-1",
            name: "前排",
            x: 0,
            y: 0,
            length: 180,
            depth: 50,
            centerY: 25,
            holeCenterX: 90,
            topHeight: 5,
            extraHeight: 0,
            slots: [],
          },
          {
            id: "row-2",
            name: "后排",
            x: 0,
            y: 56,
            length: 180,
            depth: 94,
            centerY: 103,
            holeCenterX: 90,
            topHeight: 10,
            extraHeight: 5,
            slots: [],
          },
        ],
        rowBands: [
          {
            id: "row-1",
            name: "前排",
            x: 0,
            y: 0,
            width: 180,
            depth: 50,
            topHeight: 5,
            isActive: true,
          },
          {
            id: "row-2",
            name: "后排",
            x: 0,
            y: 56,
            width: 180,
            depth: 94,
            topHeight: 10,
            isActive: false,
          },
        ],
      },
      activeRowId: "row-1",
      effectiveDimensions: { width: 180, depth: 150, height: 10 },
      setParams: vi.fn(),
      updateParam: vi.fn(),
      setActiveRow: vi.fn(),
      addRow: vi.fn(),
      removeRow: vi.fn(),
      renameRow: vi.fn(),
      clearRow: vi.fn(),
      reorderRows: vi.fn(),
      addSlotToRow: vi.fn(),
      removeSlot: vi.fn(),
      updateSlotPosition: vi.fn(),
      updateMultipleSlots: vi.fn(),
      updateMultipleSlotsLive: vi.fn(),
      updateSlotRotation: vi.fn(),
      duplicateSlots: vi.fn(),
      canvasParams: simpleSteppedCanvasParams,
      saveSnapshot: vi.fn(),
      undo: vi.fn(),
      canUndo: true,
      resizeTray: vi.fn(),
      trimTray: vi.fn(),
      threeGeometry: { id: "simple-stepped-geometry" },
      volume: 30,
      isGenerating: false,
      isPreviewStale: true,
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
    },
    gridDraftsMock: createDraftControllerMock("grid"),
    customDraftsMock: createDraftControllerMock("custom"),
    simpleSteppedDraftsMock: createDraftControllerMock("simple-stepped"),
    steppedDraftsMock: createDraftControllerMock("stepped"),
  };
});

vi.mock("next/dynamic", async () => {
  const ReactModule = await import("react");

  return {
    default(
      loader: () => Promise<{ default: React.ComponentType<unknown> }>,
      options?: { loading?: () => React.ReactNode },
    ) {
      return function DynamicComponent(props: unknown) {
        const [Resolved, setResolved] =
          ReactModule.useState<React.ComponentType<unknown> | null>(null);

        ReactModule.useEffect(() => {
          let active = true;

          void loader().then((module) => {
            if (active) {
              setResolved(() => module.default);
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

vi.mock("@/hooks/useSteppedLayout", () => ({
  useSteppedLayout: () => steppedModelMock,
}));

vi.mock("@/hooks/useSimpleSteppedLayout", () => ({
  useSimpleSteppedLayout: () => simpleSteppedModelMock,
}));

vi.mock("@/hooks/useModeDrafts", () => ({
  useModeDrafts: ({ mode }: { mode: AppMode }) => {
    if (mode === "grid") {
      return gridDraftsMock;
    }
    if (mode === "custom") {
      return customDraftsMock;
    }
    if (mode === "simple-stepped") {
      return simpleSteppedDraftsMock;
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
        <button type="button" onClick={() => onModeChange("simple-stepped")}>
          切到简易阶梯
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

vi.mock("@/components/SimpleSteppedPanel", () => ({
  default() {
    return <div data-testid="simple-stepped-panel" />;
  },
}));

vi.mock("@/components/SteppedPanel", () => ({
  default({
    selectedSlotIds,
    previewGroupId,
    draftActions,
    onPreviewGroupChange,
    optimizationProposals,
    isOptimizingLayout,
    onGenerateOptimizationProposals,
    onApplyOptimizationProposal,
    onClearOptimizationProposals,
  }: {
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
  }) {
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
  },
}));

vi.mock("@/components/LayoutCanvas", () => ({
  default({
    isActive,
    focusedGroupId,
    outlinePreview,
    rowBands,
    onResizeTray,
    slotMoveScopeResolver,
    onSelectionChange,
    onEditInteractionChange,
  }: {
    isActive?: boolean;
    focusedGroupId?: string | null;
    outlinePreview?: GroupOutlinePreview[] | null;
    rowBands?: Array<{ id: string }>;
    onResizeTray?: (width: number, depth: number) => void;
    slotMoveScopeResolver?: (draggingId: string, selectedIds: string[]) => string[];
    onSelectionChange?: (ids: string[]) => void;
    onEditInteractionChange?: (isInteracting: boolean) => void;
  }) {
    const scopedDragIds = slotMoveScopeResolver?.("simple-slot-1", [
      "simple-slot-1",
      "simple-slot-2",
      "simple-slot-3",
    ]) ?? [];

    return (
      <div
        data-testid="layout-canvas"
        data-active={String(Boolean(isActive))}
        data-focused-group-id={focusedGroupId ?? ""}
        data-outline-count={outlinePreview?.length ?? 0}
        data-row-band-count={rowBands?.length ?? 0}
        data-has-resize-tray={String(Boolean(onResizeTray))}
        data-scoped-drag-ids={scopedDragIds.join(",")}
      >
        <button
          type="button"
          onClick={() => onSelectionChange?.(["slot-1"])}
        >
          选择阶梯槽位
        </button>
        <button
          type="button"
          onClick={() => onEditInteractionChange?.(true)}
        >
          开始编辑
        </button>
        <button
          type="button"
          onClick={() => onEditInteractionChange?.(false)}
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
  beforeEach(() => {
    gridModelMock.handleGenerate.mockReset();
    customModelMock.handleGenerate.mockReset();
    simpleSteppedModelMock.handleGenerate.mockReset();
    steppedModelMock.handleGenerate.mockReset();
    steppedModelMock.setActiveGroup.mockReset();
    steppedModelMock.pauseOutlinePreview.mockReset();
    steppedModelMock.resumeOutlinePreview.mockReset();
    steppedModelMock.generateOptimizationProposals.mockReset();
    steppedModelMock.applyOptimizationProposal.mockReset();
    steppedModelMock.clearOptimizationProposals.mockReset();
    steppedModelMock.isOptimizingLayout = false;
    for (const draftMock of [
      gridDraftsMock,
      customDraftsMock,
      simpleSteppedDraftsMock,
      steppedDraftsMock,
    ]) {
      draftMock.getDraftList.mockClear();
      draftMock.openDialog.mockReset();
      draftMock.closeDialog.mockReset();
      draftMock.saveCurrentDraft.mockReset();
      draftMock.saveAsNewDraft.mockReset();
      draftMock.loadDraft.mockReset();
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

  it("wires simple stepped mode through the panel, canvas, and 3D regenerate flow", async () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "切到简易阶梯" }));
    await screen.findByTestId("simple-stepped-panel");

    expect(screen.getByTestId("layout-canvas")).toHaveAttribute(
      "data-row-band-count",
      "2",
    );
    expect(screen.getByTestId("layout-canvas")).toHaveAttribute(
      "data-has-resize-tray",
      "true",
    );
    expect(screen.getByTestId("layout-canvas")).toHaveAttribute(
      "data-scoped-drag-ids",
      "simple-slot-1,simple-slot-2",
    );

    fireEvent.click(screen.getByRole("button", { name: "3D 预览" }));

    await waitFor(() => {
      expect(simpleSteppedModelMock.handleGenerate).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("tray-viewer")).toHaveAttribute(
      "data-geometry-id",
      "simple-stepped-geometry",
    );
    expect(screen.getByTestId("tray-viewer")).toHaveAttribute(
      "data-is-stale",
      "true",
    );
  });

  it("syncs stepped selection to the active group, pauses outline preview, and resets stepped UI state on mode changes", async () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "切到阶梯" }));
    await screen.findByTestId("stepped-panel");

    fireEvent.click(screen.getByRole("button", { name: "选择阶梯槽位" }));
    await waitFor(() => {
      expect(steppedModelMock.setActiveGroup).toHaveBeenCalledWith("group-1");
    });

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
    expect(gridDraftsMock.loadDraft).toHaveBeenCalledWith("draft-1");
    expect(gridDraftsMock.renameDraftItem).toHaveBeenCalledWith(
      "draft-1",
      "Renamed",
    );
    expect(gridDraftsMock.deleteDraftItem).toHaveBeenCalledWith("draft-1");
    expect(gridDraftsMock.exportDraftItem).toHaveBeenCalledWith("draft-1");
    expect(gridDraftsMock.closeDialog).toHaveBeenCalledTimes(1);
    expect(gridDraftsMock.getDraftList).toHaveBeenCalledTimes(6);
  });
});
