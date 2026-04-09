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
    baseThickness: 3,
    holeDepth: 3,
    cornerRadius: 4,
    enableBaseHole: false,
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
    cornerRadius: 6,
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
      threeGeometry: { id: "stepped-geometry" },
    },
    simpleSteppedModelMock: {
      params: {
        trayWidth: 120,
        trayDepth: 120,
        rows: [],
        slots: [],
        firstRowHeight: 5,
        stepHeight: 5,
        rowGap: 0,
        spacing: 5,
        outerMarginIndependent: false,
        outerMargin: 5,
        holeDepth: 3,
        cornerRadius: 4,
      },
      derivedLayout: {
        trayWidth: 120,
        trayDepth: 120,
        minimumTrayWidth: 0,
        minimumTrayDepth: 0,
        trayHeight: 0,
        highestTopHeight: 0,
        slotCount: 0,
        activeRows: [],
        rowBands: [],
      },
      activeRowId: null,
      effectiveDimensions: { width: 120, depth: 120, height: 0 },
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
      canvasParams: customParams,
      saveSnapshot: vi.fn(),
      undo: vi.fn(),
      canUndo: false,
      resizeTray: vi.fn(),
      trimTray: vi.fn(),
      threeGeometry: { id: "simple-stepped-geometry" },
      volume: 0,
      isGenerating: false,
      isPreviewStale: false,
      handleGenerate: vi.fn(),
      handleExportSTL: vi.fn(),
    },
    steppedDraftsMock: {
      isDialogOpen: true,
      getDraftList: vi.fn(() => [
        {
          id: "draft-1",
          title: "Draft 1",
          updatedAt: Date.UTC(2025, 0, 1),
          slotCount: 1,
          groupCount: 1,
          trayWidth: 260,
          trayDepth: 260,
        },
      ]),
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
      saveCurrentDraft: vi.fn(),
      currentDraftId: "draft-1",
      draftNameInput: "Draft 1",
      setDraftNameInput: vi.fn(),
      saveAsNewDraft: vi.fn(),
      loadDraft: vi.fn(),
      renameDraftItem: vi.fn(),
      deleteDraftItem: vi.fn(),
      exportDraftItem: vi.fn(),
    },
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

vi.mock("@/hooks/useSteppedDrafts", () => ({
  useSteppedDrafts: () => steppedDraftsMock,
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
    currentDraftId,
    onPreviewGroupChange,
  }: {
    selectedSlotIds: string[];
    previewGroupId: string | null;
    currentDraftId: string | null;
    onPreviewGroupChange: (groupId: string | null) => void;
  }) {
    return (
      <div
        data-testid="stepped-panel"
        data-selected-slot-ids={selectedSlotIds.join(",")}
        data-preview-group-id={previewGroupId ?? ""}
        data-current-draft-id={currentDraftId ?? ""}
      >
        <button type="button" onClick={() => onPreviewGroupChange("group-1")}>
          设置预览组
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/LayoutCanvas", () => ({
  default({
    isActive,
    focusedGroupId,
    outlinePreview,
    onSelectionChange,
    onEditInteractionChange,
  }: {
    isActive?: boolean;
    focusedGroupId?: string | null;
    outlinePreview?: GroupOutlinePreview[] | null;
    onSelectionChange?: (ids: string[]) => void;
    onEditInteractionChange?: (isInteracting: boolean) => void;
  }) {
    return (
      <div
        data-testid="layout-canvas"
        data-active={String(Boolean(isActive))}
        data-focused-group-id={focusedGroupId ?? ""}
        data-outline-count={outlinePreview?.length ?? 0}
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

vi.mock("@/components/SteppedDraftDialog", () => ({
  SteppedDraftDialog({
    open,
    drafts,
    currentDraftId,
    onOpenChange,
    onSaveAsNew,
    onSaveCurrent,
    onLoad,
    onRename,
    onDelete,
    onExport,
  }: {
    open: boolean;
    drafts: Array<{ id: string }>;
    currentDraftId: string | null;
    onOpenChange: (open: boolean) => void;
    onSaveAsNew: () => void;
    onSaveCurrent: () => void;
    onLoad: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
    onExport: (id: string) => void;
  }) {
    return (
      <div
        data-testid="stepped-draft-dialog"
        data-open={String(open)}
        data-draft-count={drafts.length}
        data-current-draft-id={currentDraftId ?? ""}
      >
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
    TabsList({ children }: { children: React.ReactNode }) {
      return <div data-testid="tabs-list">{children}</div>;
    },
    TabsTrigger({
      value,
      children,
    }: {
      value: string;
      children: React.ReactNode;
    }) {
      const { value: activeValue, onValueChange } =
        ReactModule.useContext(TabsContext);

      return (
        <button
          type="button"
          data-state={activeValue === value ? "active" : "inactive"}
          onClick={() => onValueChange?.(value)}
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
    steppedModelMock.handleGenerate.mockReset();
    steppedModelMock.setActiveGroup.mockReset();
    steppedModelMock.pauseOutlinePreview.mockReset();
    steppedModelMock.resumeOutlinePreview.mockReset();
    steppedDraftsMock.getDraftList.mockClear();
    steppedDraftsMock.openDialog.mockReset();
    steppedDraftsMock.closeDialog.mockReset();
    steppedDraftsMock.saveCurrentDraft.mockReset();
    steppedDraftsMock.saveAsNewDraft.mockReset();
    steppedDraftsMock.loadDraft.mockReset();
    steppedDraftsMock.renameDraftItem.mockReset();
    steppedDraftsMock.deleteDraftItem.mockReset();
    steppedDraftsMock.exportDraftItem.mockReset();
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

  it("wires stepped draft dialog actions through stepped draft hooks and refreshes the list where needed", async () => {
    render(<Home />);
    await screen.findByTestId("stepped-draft-dialog");
    steppedDraftsMock.getDraftList.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "打开草稿弹窗" }));
    fireEvent.click(screen.getByRole("button", { name: "草稿另存" }));
    fireEvent.click(screen.getByRole("button", { name: "覆盖草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "加载草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "重命名草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "删除草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "导出草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭草稿弹窗" }));

    expect(steppedDraftsMock.openDialog).toHaveBeenCalledTimes(1);
    expect(steppedDraftsMock.saveAsNewDraft).toHaveBeenCalledTimes(1);
    expect(steppedDraftsMock.saveCurrentDraft).toHaveBeenCalledTimes(1);
    expect(steppedDraftsMock.loadDraft).toHaveBeenCalledWith("draft-1");
    expect(steppedDraftsMock.renameDraftItem).toHaveBeenCalledWith(
      "draft-1",
      "Renamed",
    );
    expect(steppedDraftsMock.deleteDraftItem).toHaveBeenCalledWith("draft-1");
    expect(steppedDraftsMock.exportDraftItem).toHaveBeenCalledWith("draft-1");
    expect(steppedDraftsMock.closeDialog).toHaveBeenCalledTimes(1);
    expect(steppedDraftsMock.getDraftList).toHaveBeenCalledTimes(6);
  });
});
