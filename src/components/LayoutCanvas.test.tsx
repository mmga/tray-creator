import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LayoutCanvas from "@/components/LayoutCanvas";
import type {
  CustomLayoutParams,
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";

const {
  flushScheduledLiveUpdatesMock,
  scheduleLiveUpdatesMock,
  startActionPanelResizeMock,
  stopActionPanelResizeMock,
  resetZoomMock,
  useCanvasKeyboardMock,
} = vi.hoisted(() => ({
  flushScheduledLiveUpdatesMock: vi.fn(),
  scheduleLiveUpdatesMock: vi.fn(),
  startActionPanelResizeMock: vi.fn(),
  stopActionPanelResizeMock: vi.fn(),
  resetZoomMock: vi.fn(),
  useCanvasKeyboardMock: vi.fn(),
}));

vi.mock("@/lib/perf", () => ({
  measurePerf: (_label: string, fn: () => unknown) => fn(),
}));

vi.mock("@/hooks/useCanvasZoom", () => ({
  useCanvasZoom: () => ({
    zoom: 1,
    setPan: vi.fn(),
    viewBox: "-20 -20 320 320",
    viewW: 320,
    viewH: 320,
    minX: -20,
    minY: -20,
    isSpacePressed: false,
    setIsSpacePressed: vi.fn(),
    isPanning: false,
    setIsPanning: vi.fn(),
    panStartRef: { current: { x: 0, y: 0 } },
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
    actionPanelWidth: 200,
    isResizingActionPanel: false,
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
  }: {
    showEffectiveBaseplate: boolean;
    focusedGroupId?: string | null;
    outlinePreview?: GroupOutlinePreview[] | null;
  }) {
    return (
      <g
        data-testid="canvas-overlay-layer"
        data-show-effective-baseplate={String(showEffectiveBaseplate)}
        data-focused-group-id={focusedGroupId ?? ""}
        data-outline-count={outlinePreview?.length ?? 0}
      />
    );
  },
}));

vi.mock("@/components/canvas/CanvasSlotLayer", () => ({
  CanvasSlotLayer({
    slots,
    selectedIds,
    focusedGroupId,
    onSlotPointerDown,
    onSlotRotatePointerDown,
  }: {
    slots: Array<{ id: string; x: number; y: number; rotation: number }>;
    selectedIds: ReadonlySet<string>;
    focusedGroupId?: string | null;
    onSlotPointerDown: (event: React.PointerEvent, slotId: string) => void;
    onSlotRotatePointerDown: (
      event: React.PointerEvent,
      slot: { id: string; x: number; y: number; rotation: number },
    ) => void;
  }) {
    return (
      <g
        data-testid="canvas-slot-layer"
        data-selected-ids={Array.from(selectedIds).join(",")}
        data-focused-group-id={focusedGroupId ?? ""}
      >
        {slots.map((slot) => (
          <React.Fragment key={slot.id}>
            <g
              data-testid={`canvas-slot-${slot.id}`}
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
    enableBaseHole: false,
    baseHoleSize: "25",
    ...overrides,
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
    activeGroupId: "group-1",
    spacing: 5,
    holeDepth: 3,
    smoothingRadius: 60,
    disconnectDistance: 0,
    ...overrides,
  };
}

describe("LayoutCanvas", { timeout: 15000 }, () => {
  beforeEach(() => {
    flushScheduledLiveUpdatesMock.mockReset();
    scheduleLiveUpdatesMock.mockReset();
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
      <LayoutCanvas
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
    expect(onSaveSnapshot).toHaveBeenCalledTimes(1);
    expect(onEditInteractionChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("canvas-slot-layer")).toHaveAttribute(
      "data-selected-ids",
      "slot-1",
    );

    rerender(
      <LayoutCanvas
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
      <LayoutCanvas
        isActive={true}
        params={createCustomParams()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开镜像面板" }));
    expect(screen.getByTestId("alignment-toolbar")).toHaveAttribute(
      "data-active-tab-id",
      "mirror",
    );

    rerender(
      <LayoutCanvas
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
      <LayoutCanvas
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
      <LayoutCanvas
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

  it("uses simple stepped row bands to switch overflow semantics and drag scoping", async () => {
    const slotMoveScopeResolver = vi.fn(() => ["slot-1"]);
    const onSaveSnapshot = vi.fn();
    const onEditInteractionChange = vi.fn();

    render(
      <LayoutCanvas
        params={createCustomParams({
          trayWidth: 280,
          trayDepth: 270,
          slots: [
            {
              id: "slot-1",
              x: 72,
              y: 48,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
            {
              id: "slot-2",
              x: 112,
              y: 48,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
          ],
        })}
        rowBands={[
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
        ]}
        slotMoveScopeResolver={slotMoveScopeResolver}
        onResizeTray={vi.fn()}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSaveSnapshot={onSaveSnapshot}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    expect(screen.getByTestId("canvas-overlay-layer")).toHaveAttribute(
      "data-show-effective-baseplate",
      "false",
    );
    expect(screen.getByText(/打印边框超限/)).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId("canvas-slot-slot-1"), {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 32,
      clientY: 44,
    });

    await waitFor(() => {
      expect(slotMoveScopeResolver).toHaveBeenCalledWith("slot-1", ["slot-1"]);
    });
    expect(onSaveSnapshot).toHaveBeenCalledTimes(1);
    expect(onEditInteractionChange).toHaveBeenCalledWith(true);
  });

  it("schedules snapped live rotation updates while rotating a slot", async () => {
    const onSaveSnapshot = vi.fn();
    const onEditInteractionChange = vi.fn();
    const { container } = render(
      <LayoutCanvas
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

  it("resizes simple stepped trays from the drag handles and clamps to row bounds", async () => {
    const onResizeTray = vi.fn();
    const onSaveSnapshot = vi.fn();
    const onEditInteractionChange = vi.fn();
    const { container } = render(
      <LayoutCanvas
        params={createCustomParams({
          trayWidth: 220,
          trayDepth: 150,
          slots: [
            {
              id: "slot-1",
              x: 72,
              y: 48,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
          ],
        })}
        rowBands={[
          {
            id: "row-1",
            name: "前排",
            x: 0,
            y: 0,
            width: 180,
            depth: 60,
            topHeight: 5,
            isActive: true,
          },
          {
            id: "row-2",
            name: "后排",
            x: 0,
            y: 70,
            width: 180,
            depth: 60,
            topHeight: 10,
            isActive: false,
          },
        ]}
        onResizeTray={onResizeTray}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSaveSnapshot={onSaveSnapshot}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    const svg = container.querySelector("svg");
    const rightHandle = container.querySelector<SVGRectElement>(
      'rect[style*="cursor: ew-resize"]',
    );
    expect(svg).not.toBeNull();
    expect(rightHandle).not.toBeNull();

    fireEvent.pointerDown(rightHandle!, {
      pointerId: 9,
      pointerType: "mouse",
      clientX: 220,
      clientY: 40,
    });

    await waitFor(() => {
      expect(screen.getByTestId("alignment-toolbar")).toHaveAttribute(
        "data-enable-copy-preview",
        "false",
      );
    });
    expect(onSaveSnapshot).toHaveBeenCalledTimes(1);
    expect(onEditInteractionChange).toHaveBeenCalledWith(true);

    fireEvent.pointerMove(svg!, {
      pointerId: 9,
      pointerType: "mouse",
      clientX: 120,
      clientY: 40,
    });

    await waitFor(() => {
      expect(onResizeTray).toHaveBeenCalledWith(180, 150);
    });

    fireEvent.pointerUp(svg!, {
      pointerId: 9,
      pointerType: "mouse",
    });

    await waitFor(() => {
      expect(screen.getByTestId("alignment-toolbar")).toHaveAttribute(
        "data-enable-copy-preview",
        "true",
      );
    });
    expect(onEditInteractionChange).toHaveBeenLastCalledWith(false);
  });

  it("adds slots through ctrl marquee selection on the canvas background", async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(
      <LayoutCanvas
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

  it("routes zoom controls, keyboard hints, and action panel resize interactions", async () => {
    const { container } = render(
      <LayoutCanvas
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

  it("clears the current selection when clicking the canvas background without ctrl", async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(
      <LayoutCanvas
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

  it("resizes simple stepped trays from the bottom and corner handles", async () => {
    const onResizeTray = vi.fn();
    const onSaveSnapshot = vi.fn();
    const onEditInteractionChange = vi.fn();
    const { container } = render(
      <LayoutCanvas
        params={createCustomParams({
          trayWidth: 220,
          trayDepth: 150,
          slots: [
            {
              id: "slot-1",
              x: 72,
              y: 48,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
            },
          ],
        })}
        rowBands={[
          {
            id: "row-1",
            name: "前排",
            x: 0,
            y: 0,
            width: 180,
            depth: 60,
            topHeight: 5,
            isActive: true,
          },
          {
            id: "row-2",
            name: "后排",
            x: 0,
            y: 70,
            width: 180,
            depth: 60,
            topHeight: 10,
            isActive: false,
          },
        ]}
        onResizeTray={onResizeTray}
        onUpdateSlot={vi.fn()}
        onRemoveSlot={vi.fn()}
        onSaveSnapshot={onSaveSnapshot}
        onEditInteractionChange={onEditInteractionChange}
      />,
    );

    const svg = container.querySelector("svg");
    const bottomHandle = container.querySelector<SVGRectElement>(
      'rect[style*="cursor: ns-resize"]',
    );
    const cornerHandle = container.querySelector<SVGRectElement>(
      'rect[style*="cursor: nwse-resize"]',
    );
    expect(svg).not.toBeNull();
    expect(bottomHandle).not.toBeNull();
    expect(cornerHandle).not.toBeNull();

    fireEvent.pointerDown(bottomHandle!, {
      pointerId: 3,
      pointerType: "mouse",
      clientX: 120,
      clientY: 150,
    });
    fireEvent.pointerMove(svg!, {
      pointerId: 3,
      pointerType: "mouse",
      clientX: 120,
      clientY: 80,
    });

    await waitFor(() => {
      expect(onResizeTray).toHaveBeenCalledWith(220, 130);
    });

    fireEvent.pointerUp(svg!, {
      pointerId: 3,
      pointerType: "mouse",
    });

    fireEvent.pointerDown(cornerHandle!, {
      pointerId: 4,
      pointerType: "mouse",
      clientX: 220,
      clientY: 150,
    });
    fireEvent.pointerMove(svg!, {
      pointerId: 4,
      pointerType: "mouse",
      clientX: 120,
      clientY: 80,
    });

    await waitFor(() => {
      expect(onResizeTray).toHaveBeenCalledWith(180, 130);
    });

    fireEvent.pointerUp(svg!, {
      pointerId: 4,
      pointerType: "mouse",
    });

    expect(onSaveSnapshot).toHaveBeenCalledTimes(2);
    expect(onEditInteractionChange).toHaveBeenNthCalledWith(1, true);
    expect(onEditInteractionChange).toHaveBeenLastCalledWith(false);
  });
});
