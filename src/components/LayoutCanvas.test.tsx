import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LayoutCanvas from "@/components/LayoutCanvas";
import type {
  CustomLayoutParams,
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { CanvasSlotUpdate } from "@/lib/canvas-types";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";

const {
  actionPanelResizeState,
  calculateCanvasDragPositionMock,
  calculateCanvasDragSnapMock,
  canvasZoomState,
  flushScheduledLiveUpdatesMock,
  scheduleLiveUpdatesMock,
  setIsPanningMock,
  setIsSpacePressedMock,
  setPanMock,
  startActionPanelResizeMock,
  stopActionPanelResizeMock,
  resetZoomMock,
  useCanvasKeyboardMock,
} = vi.hoisted(() => ({
  actionPanelResizeState: {
    actionPanelWidth: 200,
    isResizingActionPanel: false,
  },
  calculateCanvasDragPositionMock: vi.fn(),
  calculateCanvasDragSnapMock: vi.fn(),
  canvasZoomState: {
    isSpacePressed: false,
    isPanning: false,
    panStartRef: { current: { x: 0, y: 0 } },
  },
  flushScheduledLiveUpdatesMock: vi.fn(),
  scheduleLiveUpdatesMock: vi.fn(),
  setIsPanningMock: vi.fn((value: boolean) => {
    canvasZoomState.isPanning = value;
  }),
  setIsSpacePressedMock: vi.fn((value: boolean) => {
    canvasZoomState.isSpacePressed = value;
  }),
  setPanMock: vi.fn(),
  startActionPanelResizeMock: vi.fn(),
  stopActionPanelResizeMock: vi.fn(),
  resetZoomMock: vi.fn(),
  useCanvasKeyboardMock: vi.fn(),
}));

vi.mock("@/lib/perf", () => ({
  measurePerf: (_label: string, fn: () => unknown) => fn(),
}));

vi.mock("@/lib/canvas-snap-engine", () => ({
  calculateCanvasDragPosition: calculateCanvasDragPositionMock,
  calculateCanvasDragSnap: calculateCanvasDragSnapMock,
}));

vi.mock("@/hooks/useCanvasZoom", () => ({
  useCanvasZoom: () => ({
    zoom: 1,
    setPan: setPanMock,
    viewBox: "-20 -20 320 320",
    viewW: 320,
    viewH: 320,
    minX: -20,
    minY: -20,
    isSpacePressed: canvasZoomState.isSpacePressed,
    setIsSpacePressed: setIsSpacePressedMock,
    isPanning: canvasZoomState.isPanning,
    setIsPanning: setIsPanningMock,
    panStartRef: canvasZoomState.panStartRef,
    handleWheel: vi.fn(),
    handleTouchStart: vi.fn(),
    handleTouchMove: vi.fn(),
    handleTouchEnd: vi.fn(),
    resetZoom: resetZoomMock,
  }),
}));

vi.mock("@/hooks/useCanvasKeyboard", () => ({
  useCanvasKeyboard: useCanvasKeyboardMock,
}));

vi.mock("@/hooks/useActionPanelResize", () => ({
  useActionPanelResize: () => ({
    actionPanelWidth: actionPanelResizeState.actionPanelWidth,
    isResizingActionPanel: actionPanelResizeState.isResizingActionPanel,
    startActionPanelResize: startActionPanelResizeMock,
    stopActionPanelResize: stopActionPanelResizeMock,
  }),
}));

vi.mock("@/hooks/useLiveSlotUpdates", () => ({
  useLiveSlotUpdates: () => ({
    flushScheduledLiveUpdates: flushScheduledLiveUpdatesMock,
    scheduleLiveUpdates: scheduleLiveUpdatesMock,
  }),
}));

vi.mock("@/components/AlignmentToolbar", () => ({
  default({
    selectedIds,
    activeTabId,
    onActiveTabChange,
    enableCopyPreview,
  }: {
    selectedIds: Set<string>;
    activeTabId: string | null;
    onActiveTabChange: (tabId: string | null) => void;
    enableCopyPreview: boolean;
  }) {
    return (
      <div
        data-testid="alignment-toolbar"
        data-selected-ids={Array.from(selectedIds).join(",")}
        data-active-tab-id={activeTabId ?? ""}
        data-enable-copy-preview={String(enableCopyPreview)}
      >
        <button type="button" onClick={() => onActiveTabChange("mirror")}>
          打开镜像面板
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/canvas/CanvasOverlayLayer", () => ({
  CanvasOverlayLayer({
    showEffectiveBaseplate,
    focusedGroupId,
    outlinePreview,
    sideBevelWidth,
  }: {
    showEffectiveBaseplate: boolean;
    focusedGroupId?: string | null;
    outlinePreview?: GroupOutlinePreview[] | null;
    sideBevelWidth?: number;
  }) {
    return (
      <g
        data-testid="canvas-overlay-layer"
        data-show-effective-baseplate={String(showEffectiveBaseplate)}
        data-focused-group-id={focusedGroupId ?? ""}
        data-outline-count={outlinePreview?.length ?? 0}
        data-side-bevel-width={sideBevelWidth ?? 0}
      />
    );
  },
}));

vi.mock("@/components/canvas/CanvasSlotLayer", () => ({
  CanvasSlotLayer({
    slots,
    selectedIds,
    hoveredId,
    focusedGroupId,
    onSlotPointerDown,
    onSlotPointerEnter,
    onSlotPointerLeave,
    onSlotRotatePointerDown,
  }: {
    slots: Array<{ id: string; x: number; y: number; rotation: number }>;
    selectedIds: ReadonlySet<string>;
    hoveredId: string | null;
    focusedGroupId?: string | null;
    onSlotPointerDown: (event: React.PointerEvent, slotId: string) => void;
    onSlotPointerEnter: (slotId: string) => void;
    onSlotPointerLeave: () => void;
    onSlotRotatePointerDown: (
      event: React.PointerEvent,
      slot: { id: string; x: number; y: number; rotation: number },
    ) => void;
  }) {
    return (
      <g
        data-testid="canvas-slot-layer"
        data-selected-ids={Array.from(selectedIds).join(",")}
        data-hovered-id={hoveredId ?? ""}
        data-focused-group-id={focusedGroupId ?? ""}
      >
        {slots.map((slot) => (
          <React.Fragment key={slot.id}>
            <g
              data-testid={`canvas-slot-${slot.id}`}
              onPointerEnter={() => onSlotPointerEnter(slot.id)}
              onPointerLeave={() => onSlotPointerLeave()}
              onPointerDown={(event) => onSlotPointerDown(event, slot.id)}
            />
            <g
              data-testid={`canvas-rotate-${slot.id}`}
              onPointerDown={(event) => onSlotRotatePointerDown(event, slot)}
            />
          </React.Fragment>
        ))}
      </g>
    );
  },
}));

vi.mock("@/components/canvas/CanvasStatusBar", () => ({
  CanvasStatusBar({
    selectedIds,
    collisionErrorCount,
  }: {
    selectedIds: ReadonlySet<string>;
    collisionErrorCount: number;
  }) {
    return (
      <div
        data-testid="canvas-status-bar"
        data-selected-count={selectedIds.size}
        data-collision-count={collisionErrorCount}
      />
    );
  },
}));

vi.mock("@/components/canvas/CanvasZoomControls", () => ({
  CanvasZoomControls({
    onResetZoom,
    onShowHints,
  }: {
    onResetZoom: () => void;
    onShowHints: () => void;
  }) {
    return (
      <div>
        <button type="button" onClick={onResetZoom}>
          重置缩放
        </button>
        <button type="button" onClick={onShowHints}>
          显示快捷键
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/canvas/KeyboardHintsOverlay", () => ({
  KeyboardHintsOverlay({
    showHints,
    onClose,
  }: {
    showHints: boolean;
    onClose: () => void;
  }) {
    return (
      <div data-testid="keyboard-hints" data-open={String(showHints)}>
        <button type="button" onClick={onClose}>
          关闭快捷键
        </button>
      </div>
    );
  },
}));

function createCustomParams(
  overrides: Partial<CustomLayoutParams> = {},
): CustomLayoutParams {
  return {
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
      },
    ],
    spacing: 5,
    boundarySpacing: 5,
    boundarySpacingIndependent: false,
    baseThickness: 3,
    holeDepth: 3,
    cornerRadius: 6,
    sideBevelWidth: 0,
    baseHoleSize: "25",
    ...overrides,
    baseHoleStructure: overrides.baseHoleStructure ?? "none",
    magnetPostHoleDiameter: overrides.magnetPostHoleDiameter ?? 5,
    magnetPostHoleDepth: overrides.magnetPostHoleDepth ?? 2,
  };
}

function createSteppedParams(
  overrides: Partial<SteppedLayoutParams> = {},
): SteppedLayoutParams {
  return {
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
    smoothingRadius: 60,
    disconnectDistance: 0,
    baseHoleSize: "25",
    ...overrides,
    enableSplitAssembly: overrides.enableSplitAssembly ?? false,
    baseHoleStructure: overrides.baseHoleStructure ?? "none",
    magnetPostHoleDiameter: overrides.magnetPostHoleDiameter ?? 5,
    magnetPostHoleDepth: overrides.magnetPostHoleDepth ?? 2,
  };
}

interface TestLayoutCanvasProps {
  isActive?: boolean;
  params: CustomLayoutParams | SteppedLayoutParams;
  onUpdateSlot: (id: string, x: number, y: number) => void;
  onRemoveSlot: (id: string) => void;
  onResizeTray?: (width: number, depth: number) => void;
  onUpdateSlotRotation?: (id: string, rotation: number) => void;
  onUpdateMultipleSlots?: (updates: CanvasSlotUpdate[]) => void;
  onLiveUpdateMultipleSlots?: (updates: CanvasSlotUpdate[]) => void;
  onInsertSlots?: (slots: SymmetryInsertSlot[]) => void;
  onDuplicateSlots?: (ids: string[]) => string[] | void;
  onUndo?: () => void;
  onSaveSnapshot?: () => void;
  onSelectionChange?: (ids: string[]) => void;
  onEditInteractionChange?: (isInteracting: boolean) => void;
  outlinePreview?: GroupOutlinePreview[] | null;
  focusedGroupId?: string | null;
  slotMoveScopeResolver?: (draggingId: string, selectedIds: string[]) => string[];
}

function TestLayoutCanvas({
  isActive,
  params,
  onUpdateSlot,
  onRemoveSlot,
  onUpdateSlotRotation,
  onUpdateMultipleSlots,
  onLiveUpdateMultipleSlots,
  onInsertSlots,
  onDuplicateSlots,
  onUndo,
  onSaveSnapshot,
  onSelectionChange,
  onEditInteractionChange,
  outlinePreview,
  focusedGroupId,
  slotMoveScopeResolver,
}: TestLayoutCanvasProps) {
  const isStepped = "groups" in params;
  const boundarySpacing =
    "boundarySpacingIndependent" in params && params.boundarySpacingIndependent
      ? (params.boundarySpacing ?? params.spacing)
      : params.spacing;

  return (
    <LayoutCanvas
      isActive={isActive}
      model={{
        trayFrame: {
          width: params.trayWidth,
          depth: params.trayDepth,
          spacing: params.spacing,
          boundarySpacing,
          cornerRadius: "cornerRadius" in params ? (params.cornerRadius ?? 0) : 0,
          sideBevelWidth: "sideBevelWidth" in params ? params.sideBevelWidth : 0,
          showEffectiveBaseplate: !isStepped,
          showMaxBuildBoundary: false,
        },
        slots: params.slots,
        overlays: {
          focusedGroupId,
          groupOutlines: outlinePreview,
          slotGroups: isStepped ? params.groups : null,
        },
        interactions: {
          slotMoveScopeResolver,
        },
      }}
      commands={{
        updateSlotPosition: onUpdateSlot,
        removeSlot: onRemoveSlot,
        updateSlotRotation: onUpdateSlotRotation,
        updateMultipleSlots: onUpdateMultipleSlots,
        liveUpdateMultipleSlots: onLiveUpdateMultipleSlots,
        insertSlots: onInsertSlots,
        duplicateSlots: onDuplicateSlots,
        undo: onUndo,
        saveSnapshot: onSaveSnapshot,
        selectionChanged: onSelectionChange,
        editInteractionChanged: onEditInteractionChange,
      }}
    />
  );
}

describe("LayoutCanvas", { timeout: 15000 }, () => {
  beforeEach(() => {
    actionPanelResizeState.actionPanelWidth = 200;
    actionPanelResizeState.isResizingActionPanel = false;
    calculateCanvasDragSnapMock.mockReset();
    calculateCanvasDragPositionMock.mockReset();
    canvasZoomState.isSpacePressed = false;
    canvasZoomState.isPanning = false;
    canvasZoomState.panStartRef.current = { x: 0, y: 0 };
    flushScheduledLiveUpdatesMock.mockReset();
    scheduleLiveUpdatesMock.mockReset();
    setIsPanningMock.mockClear();
    setIsSpacePressedMock.mockClear();
    setPanMock.mockClear();
    startActionPanelResizeMock.mockReset();
    stopActionPanelResizeMock.mockReset();
    resetZoomMock.mockReset();
    useCanvasKeyboardMock.mockReset();

    Object.defineProperty(SVGSVGElement.prototype, "getScreenCTM", {
      configurable: true,
      writable: true,
      value() {
        return {
          a: 1,
          inverse() {
            return this;
          },
        };
      },
    });
    Object.defineProperty(SVGSVGElement.prototype, "createSVGPoint", {
      configurable: true,
      writable: true,
      value() {
        return {
          x: 0,
          y: 0,
          matrixTransform() {
            return { x: this.x, y: this.y };
          },
        };
      },
    });

    Object.defineProperty(Element.prototype, "setPointerCapture", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it("selects slots through the slot layer and sanitizes removed selections", async () => {
    const onSelectionChange = vi.fn();
    const onSaveSnapshot = vi.fn();
    const onEditInteractionChange = vi.fn();

    const { rerender } = render(
      <TestLayoutCanvas
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSelectionChange={onSelectionChange}
        onSaveSnapshot={onSaveSnapshot}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    onSelectionChange.mockClear();

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 32,
      clientY: 44,
    });

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenLastCalledWith(["slot-1"]);
    });
    onSelectionChange.mockClear();
    rerender(
      <TestLayoutCanvas
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSelectionChange={onSelectionChange}
        onSaveSnapshot={onSaveSnapshot}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );
    expect(onSelectionChange).not.toHaveBeenCalled();

    expect(onSaveSnapshot).toHaveBeenCalledTimes(1);
    expect(onEditInteractionChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
      "data-selected-ids",
      "slot-1",
    );

    rerender(
      <TestLayoutCanvas
        params={createCustomParams({ slots: [] })}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSelectionChange={onSelectionChange}
        onSaveSnapshot={onSaveSnapshot}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenLastCalledWith([]);
    });
    expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
      "data-selected-ids",
      "",
    );
  });

  it("moves keyboard focus back to the 2D canvas when selecting a slot", () => {
    const { container } = render(
      <TestLayoutCanvas
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
      />,
    );

    const toolbarButton = screen.getByRole("button", { name: "打开镜像面板" });
    toolbarButton.focus();
    expect(toolbarButton).toHaveFocus();

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 32,
      clientY: 44,
    });

    expect(container.querySelector("svg")).toHaveFocus();
  });

  it("tracks hovered slots and supports boundary spacing overrides", async () => {
    render(
      <TestLayoutCanvas
        params={createCustomParams({
          boundarySpacingIndependent: true,
          boundarySpacing: 18,
        })}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
      />,
    );

    fireEvent.pointerEnter(screen.getByTestId("canvas-slot-slot-1"));

    await waitFor(() => {
      expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
        "data-hovered-id",
        "slot-1",
      );
    });

    fireEvent.pointerLeave(screen.getByTestId("canvas-slot-slot-1"));

    await waitFor(() => {
      expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
        "data-hovered-id",
        "",
      );
    });
  });

  it("flushes live updates and hides the active toolbar tab when the canvas becomes inactive", async () => {
    const onEditInteractionChange = vi.fn();
    let frameCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallback = callback;
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    const { rerender } = render(
      <TestLayoutCanvas
        isActive={true}
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开镜像面板" }));
    expect(screen.getByRole("complementary", { name: "布局工具" })).toHaveClass(
      "w-full",
      "h-1/2",
      "lg:h-full",
    );
    expect(screen.getByTestId("alignment-toolbar")).toHaveAttribute(
      "data-active-tab-id",
      "mirror",
    );

    rerender(
      <TestLayoutCanvas
        isActive={false}
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    expect(frameCallback).not.toBeNull();
    if (!frameCallback) {
      throw new Error("requestAnimationFrame callback was not scheduled");
    }
    const scheduledFrame = frameCallback as FrameRequestCallback;
    scheduledFrame(0);

    await waitFor(() => {
      expect(flushScheduledLiveUpdatesMock).toHaveBeenCalledTimes(1);
    });
    expect(onEditInteractionChange).toHaveBeenCalledWith(false);
    expect(stopActionPanelResizeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("alignment-toolbar")).toHaveAttribute(
      "data-active-tab-id",
      "",
    );

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("shows effective baseplate overflow for custom layouts", () => {
    render(
      <TestLayoutCanvas
        params={createCustomParams({
          slots: [
            {
              id: "slot-oversized",
              x: 130,
              y: 130,
              shape: "ellipse",
              width: 320,
              height: 60,
              rotation: 0,
            },
          ],
        })}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
      />,
    );

    expect(screen.getByTestId("canvas-overlay-layer")).toHaveAttribute(
      "data-show-effective-baseplate",
      "true",
    );
    expect(screen.getByText(/有效底板超限/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("有效底板超限");
  });

  it("forwards stepped outline preview and focused group state to canvas layers", () => {
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

    render(
      <TestLayoutCanvas
        params={createSteppedParams()}
        focusedGroupId="group-1"
        outlinePreview={outlinePreview}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
      />,
    );

    expect(screen.getByTestId("canvas-overlay-layer")).toHaveAttribute(
      "data-show-effective-baseplate",
      "false",
    );
    expect(screen.getByTestId("canvas-overlay-layer")).toHaveAttribute(
      "data-focused-group-id",
      "group-1",
    );
    expect(screen.getByTestId("canvas-overlay-layer")).toHaveAttribute(
      "data-outline-count",
      "1",
    );
    expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
      "data-focused-group-id",
      "group-1",
    );
    expect(screen.getByTestId("alignment-toolbar")).toHaveAttribute(
      "data-enable-copy-preview",
      "true",
    );
  });

  it("adds a protection gap between slots from different stepped heights", () => {
    render(
      <TestLayoutCanvas
        params={createSteppedParams({
          spacing: 5,
          groups: [
            {
              id: "low",
              name: "低层",
              color: "#22c55e",
              bottomHeight: 8,
              useGroupSmoothingRadius: false,
              groupSmoothingRadius: 60,
              useGroupDisconnectDistance: false,
              groupDisconnectDistance: 0,
            },
            {
              id: "high",
              name: "高层",
              color: "#38bdf8",
              bottomHeight: 16,
              useGroupSmoothingRadius: false,
              groupSmoothingRadius: 60,
              useGroupDisconnectDistance: false,
              groupDisconnectDistance: 0,
            },
          ],
          slots: [
            {
              id: "low-slot",
              x: 100,
              y: 120,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
              groupId: "low",
            },
            {
              id: "high-slot",
              x: 130.5,
              y: 120,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
              groupId: "high",
            },
          ],
        })}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
      />,
    );

    expect(screen.getByTestId("canvas-status-bar")).toHaveAttribute(
      "data-collision-count",
      "1",
    );
  });


  it("requires selecting a slot before dragging it", async () => {
    const { container } = render(
      <TestLayoutCanvas
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 3,
      pointerType: "mouse",
      clientX: 100,
      clientY: 120,
    });
    fireEvent.pointerMove(svg!, {
      pointerId: 3,
      pointerType: "mouse",
      clientX: 130,
      clientY: 150,
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
        "data-selected-ids",
        "slot-1",
      );
    });
    expect(calculateCanvasDragSnapMock).not.toHaveBeenCalled();
    expect(scheduleLiveUpdatesMock).not.toHaveBeenCalled();

    fireEvent.pointerUp(svg!, {
      pointerId: 3,
      pointerType: "mouse",
    });
    flushScheduledLiveUpdatesMock.mockClear();

    calculateCanvasDragSnapMock.mockReturnValue({
      finalX: 130,
      finalY: 150,
      guides: [],
    });

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 4,
      pointerType: "mouse",
      clientX: 100,
      clientY: 120,
    });
    fireEvent.pointerMove(svg!, {
      pointerId: 4,
      pointerType: "mouse",
      clientX: 130,
      clientY: 150,
    });

    await waitFor(() => {
      expect(calculateCanvasDragSnapMock).toHaveBeenCalledTimes(1);
    });
    expect(scheduleLiveUpdatesMock).toHaveBeenCalledWith([
      {
        id: "slot-1",
        x: 130,
        y: 150,
      },
    ]);
  });

  it("schedules snapped live rotation updates while rotating a slot", async () => {
    const onSaveSnapshot = vi.fn();
    const onEditInteractionChange = vi.fn();
    const { container } = render(
      <TestLayoutCanvas
        params={createCustomParams({
          trayDepth: 160,
          slots: [
            {
              id: "slot-1",
              x: 100,
              y: 120,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
          ],
        })}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSaveSnapshot={onSaveSnapshot}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    fireEvent.pointerDown(screen.getByTestId("canvas-rotate-slot-1"), {
      pointerId: 7,
      pointerType: "mouse",
      clientX: 120,
      clientY: 40,
    });

    fireEvent.pointerMove(svg!, {
      pointerId: 7,
      pointerType: "mouse",
      clientX: 100,
      clientY: 20,
      shiftKey: true,
    });

    await waitFor(() => {
      expect(scheduleLiveUpdatesMock).toHaveBeenCalledWith([
        {
          id: "slot-1",
          x: 100,
          y: 120,
          rotation: 90,
        },
      ]);
    });
    expect(onSaveSnapshot).toHaveBeenCalledTimes(1);
    expect(onEditInteractionChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("alignment-toolbar")).toHaveAttribute(
      "data-enable-copy-preview",
      "false",
    );

    fireEvent.pointerUp(svg!, {
      pointerId: 7,
      pointerType: "mouse",
    });

    await waitFor(() => {
      expect(flushScheduledLiveUpdatesMock).toHaveBeenCalledTimes(1);
    });
    expect(onEditInteractionChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("alignment-toolbar")).toHaveAttribute(
      "data-enable-copy-preview",
      "true",
    );
  });



  it("adds slots through ctrl marquee selection on the canvas background", async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(
      <TestLayoutCanvas
        params={createCustomParams({
          slots: [
            {
              id: "slot-1",
              x: 100,
              y: 120,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
            {
              id: "slot-2",
              x: 140,
              y: 100,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
          ],
        })}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSelectionChange={onSelectionChange}
      />,
    );

    const svg = container.querySelector("svg");
    const viewport = svg?.parentElement as HTMLDivElement | null;
    expect(svg).not.toBeNull();
    expect(viewport).not.toBeNull();

    Object.defineProperty(viewport, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 400,
        bottom: 400,
        width: 400,
        height: 400,
        toJSON: () => "",
      }),
    });

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 140,
    });
    fireEvent.pointerUp(svg!, {
      pointerId: 1,
      pointerType: "mouse",
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
        "data-selected-ids",
        "slot-1",
      );
    });

    onSelectionChange.mockClear();

    fireEvent.pointerDown(svg!, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: 90,
      clientY: 110,
      ctrlKey: true,
    });
    fireEvent.pointerMove(svg!, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: 150,
      clientY: 170,
      ctrlKey: true,
    });
    fireEvent.pointerUp(svg!, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: 150,
      clientY: 170,
      ctrlKey: true,
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
        "data-selected-ids",
        "slot-1,slot-2",
      );
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith(["slot-1", "slot-2"]);
  });

  it("toggles the selected slot off when ctrl-clicking it again", async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(
      <TestLayoutCanvas
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSelectionChange={onSelectionChange}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 140,
    });
    fireEvent.pointerUp(svg!, {
      pointerId: 1,
      pointerType: "mouse",
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
        "data-selected-ids",
        "slot-1",
      );
    });

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 2,
      pointerType: "mouse",
      clientX: 100,
      clientY: 140,
      ctrlKey: true,
    });
    fireEvent.pointerUp(svg!, {
      pointerId: 2,
      pointerType: "mouse",
      ctrlKey: true,
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
        "data-selected-ids",
        "",
      );
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it("routes zoom controls, keyboard hints, and action panel resize interactions", async () => {
    const { container } = render(
      <TestLayoutCanvas
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
      />,
    );

    expect(screen.getByTestId("keyboard-hints")).toHaveAttribute(
      "data-open",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "显示快捷键" }));
    expect(screen.getByTestId("keyboard-hints")).toHaveAttribute(
      "data-open",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "关闭快捷键" }));
    expect(screen.getByTestId("keyboard-hints")).toHaveAttribute(
      "data-open",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "重置缩放" }));
    expect(resetZoomMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "打开镜像面板" }));
    expect(screen.getByTestId("alignment-toolbar")).toHaveAttribute(
      "data-active-tab-id",
      "mirror",
    );

    const panelResizer = container.querySelector("div.cursor-col-resize");
    expect(panelResizer).not.toBeNull();

    fireEvent.pointerDown(panelResizer!, {
      pointerId: 5,
      pointerType: "mouse",
      clientX: 284,
    });

    await waitFor(() => {
      expect(startActionPanelResizeMock).toHaveBeenCalledWith(284);
    });
  });

  it("bypasses magnetic snapping while Shift is held during a drag", async () => {
    const { container } = render(
      <TestLayoutCanvas
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 120,
    });
    fireEvent.pointerUp(svg!, { pointerId: 1, pointerType: "mouse" });

    calculateCanvasDragPositionMock.mockReturnValue({ x: 123, y: 87 });

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 2,
      pointerType: "mouse",
      clientX: 100,
      clientY: 120,
    });
    fireEvent.pointerMove(svg!, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: 130,
      clientY: 150,
      shiftKey: true,
    });

    await waitFor(() => {
      expect(calculateCanvasDragPositionMock).toHaveBeenCalledTimes(1);
    });
    expect(calculateCanvasDragSnapMock).not.toHaveBeenCalled();
    expect(scheduleLiveUpdatesMock).toHaveBeenCalledWith([
      { id: "slot-1", x: 123, y: 87 },
    ]);
  });

  it("forwards side bevel width to the 2D overlay layer", () => {
    render(
      <TestLayoutCanvas
        params={createCustomParams({ sideBevelWidth: 3 })}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
      />,
    );

    expect(screen.getByTestId("canvas-overlay-layer")).toHaveAttribute(
      "data-side-bevel-width",
      "3",
    );
  });

  it("pans the 2D canvas while dragging with the middle mouse button", async () => {
    const onSelectionChange = vi.fn();
    const onSaveSnapshot = vi.fn();
    const { container, rerender } = render(
      <TestLayoutCanvas
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSelectionChange={onSelectionChange}
        onSaveSnapshot={onSaveSnapshot}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    fireEvent.pointerDown(svg!, {
      pointerId: 11,
      pointerType: "mouse",
      button: 1,
      clientX: 40,
      clientY: 50,
    });

    expect(setIsPanningMock).toHaveBeenCalledWith(true);
    expect(canvasZoomState.panStartRef.current).toEqual({ x: 40, y: 50 });
    expect(onSaveSnapshot).not.toHaveBeenCalled();

    rerender(
      <TestLayoutCanvas
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSelectionChange={onSelectionChange}
        onSaveSnapshot={onSaveSnapshot}
      />,
    );

    fireEvent.pointerMove(svg!, {
      pointerId: 11,
      pointerType: "mouse",
      buttons: 4,
      clientX: 55,
      clientY: 62,
    });

    await waitFor(() => {
      expect(setPanMock).toHaveBeenCalledTimes(1);
    });
    const updater = setPanMock.mock.calls[0]?.[0] as
      | ((prev: { x: number; y: number }) => { x: number; y: number })
      | undefined;
    expect(updater?.({ x: 2, y: 3 })).toEqual({ x: 17, y: 15 });
    expect(canvasZoomState.panStartRef.current).toEqual({ x: 55, y: 62 });
    expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
      "data-selected-ids",
      "",
    );
  });

  it("renders cursor and panel classes for active zoom and resize states", () => {
    canvasZoomState.isSpacePressed = true;
    canvasZoomState.isPanning = true;
    actionPanelResizeState.isResizingActionPanel = true;

    const { container } = render(
      <TestLayoutCanvas
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
      />,
    );

    const viewport = container.querySelector("div.relative.min-h-0.min-w-0.flex-1");
    const svg = container.querySelector("svg");
    const aside = container.querySelector("aside");

    expect(viewport).toHaveClass("cursor-grab");
    expect(viewport).toHaveClass("cursor-grabbing");
    expect(svg).not.toHaveClass("cursor-crosshair");
    expect(aside).not.toHaveClass("transition-[width]");
  });

  it("clears the current selection when clicking the canvas background without ctrl", async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(
      <TestLayoutCanvas
        params={createCustomParams({
          slots: [
            {
              id: "slot-1",
              x: 100,
              y: 120,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
          ],
        })}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSelectionChange={onSelectionChange}
      />,
    );

    const svg = container.querySelector("svg");
    const viewport = svg?.parentElement as HTMLDivElement | null;
    expect(svg).not.toBeNull();
    expect(viewport).not.toBeNull();

    Object.defineProperty(viewport, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 400,
        bottom: 400,
        width: 400,
        height: 400,
        toJSON: () => "",
      }),
    });

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 140,
    });
    fireEvent.pointerUp(svg!, {
      pointerId: 1,
      pointerType: "mouse",
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
        "data-selected-ids",
        "slot-1",
      );
    });

    onSelectionChange.mockClear();

    fireEvent.pointerDown(svg!, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerUp(svg!, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: 20,
      clientY: 20,
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
        "data-selected-ids",
        "",
      );
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });


  it("cancels drag interaction when the scoped move set is empty", async () => {
    const slotMoveScopeResolver = vi.fn(() => []);
    const onSaveSnapshot = vi.fn();
    const onEditInteractionChange = vi.fn();

    render(
      <TestLayoutCanvas
        params={createCustomParams({
          slots: [
            {
              id: "slot-1",
              x: 100,
              y: 120,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
          ],
        })}
        slotMoveScopeResolver={slotMoveScopeResolver}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSaveSnapshot={onSaveSnapshot}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 6,
      pointerType: "mouse",
      clientX: 100,
      clientY: 140,
    });

    await waitFor(() => {
      expect(slotMoveScopeResolver).toHaveBeenCalledWith("slot-1", ["slot-1"]);
    });
    expect(onSaveSnapshot).not.toHaveBeenCalled();
    expect(onEditInteractionChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("alignment-toolbar")).toHaveAttribute(
      "data-enable-copy-preview",
      "true",
    );
  });

  it("ignores secondary touch pointers and only drags with the primary touch", async () => {
    const onSaveSnapshot = vi.fn();
    const onEditInteractionChange = vi.fn();
    const { container } = render(
      <TestLayoutCanvas
        params={createCustomParams({
          slots: [
            {
              id: "slot-1",
              x: 100,
              y: 120,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
            {
              id: "slot-2",
              x: 150,
              y: 120,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
          ],
        })}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSaveSnapshot={onSaveSnapshot}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
      clientY: 140,
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
        "data-selected-ids",
        "slot-1",
      );
    });
    expect(onSaveSnapshot).toHaveBeenCalledTimes(1);

    fireEvent.pointerUp(svg!, {
      pointerId: 1,
      pointerType: "touch",
    });
    flushScheduledLiveUpdatesMock.mockClear();

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
      clientY: 140,
    });

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-2"), {
      pointerId: 2,
      pointerType: "touch",
      clientX: 150,
      clientY: 140,
    });

    expect(onSaveSnapshot).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
      "data-selected-ids",
      "slot-1",
    );

    fireEvent.pointerMove(svg!, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 155,
      clientY: 150,
    });

    expect(calculateCanvasDragSnapMock).not.toHaveBeenCalled();
    expect(scheduleLiveUpdatesMock).not.toHaveBeenCalled();

    calculateCanvasDragSnapMock.mockReturnValue({
      finalX: 130,
      finalY: 150,
      guides: [],
    });

    fireEvent.pointerMove(svg!, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 130,
      clientY: 150,
    });

    await waitFor(() => {
      expect(calculateCanvasDragSnapMock).toHaveBeenCalledTimes(1);
    });
    expect(scheduleLiveUpdatesMock).toHaveBeenCalledWith([
      {
        id: "slot-1",
        x: 130,
        y: 150,
      },
    ]);
    expect(onEditInteractionChange).toHaveBeenCalledWith(true);

    fireEvent.pointerUp(svg!, {
      pointerId: 1,
      pointerType: "touch",
    });

    await waitFor(() => {
      expect(flushScheduledLiveUpdatesMock).toHaveBeenCalledTimes(1);
    });
    expect(onEditInteractionChange).toHaveBeenLastCalledWith(false);
  });
});
