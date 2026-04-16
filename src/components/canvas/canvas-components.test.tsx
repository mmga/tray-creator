import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCanvasCollisionState } from "@/lib/canvas-collision-model";
import AlignPanel from "@/components/canvas/AlignPanel";
import { CanvasOverlayLayer } from "@/components/canvas/CanvasOverlayLayer";
import { CanvasSlotLayer } from "@/components/canvas/CanvasSlotLayer";
import MirrorPanel from "@/components/canvas/MirrorPanel";
import type {
  FreeSlot,
  GroupOutlinePreview,
  SlotGroup,
  SteppedSlot,
} from "@/types/custom-tray";

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

function createSteppedSlot(overrides: Partial<SteppedSlot> = {}): SteppedSlot {
  return {
    id: "slot-1",
    x: 40,
    y: 50,
    shape: "ellipse",
    width: 40,
    height: 20,
    rotation: 170,
    groupId: "group-1",
    ...overrides,
  };
}

function createGroup(overrides: Partial<SlotGroup> = {}): SlotGroup {
  return {
    id: "group-1",
    name: "组 1",
    color: "#3b82f6",
    bottomHeight: 10,
    useGroupSmoothingRadius: false,
    groupSmoothingRadius: 60,
    useGroupDisconnectDistance: false,
    groupDisconnectDistance: 0,
    ...overrides,
  };
}

describe("MirrorPanel", { timeout: 15000 }, () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it("mirrors selected slots and reports out-of-bounds and spacing collisions", () => {
    const selectedSlots: FreeSlot[] = [
      {
        id: "slot-1",
        x: 10,
        y: 50,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
      },
    ];
    const unselectedSlots: FreeSlot[] = [
      {
        id: "slot-2",
        x: 90,
        y: 50,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
      },
    ];
    const onUpdateSlots = vi.fn();

    render(
      <MirrorPanel
        allSlots={[...selectedSlots, ...unselectedSlots]}
        selectedSlots={selectedSlots}
        unselectedSlots={unselectedSlots}
        onUpdateSlots={onUpdateSlots}
        enableCopyPreview={false}
        spacing={6}
        trayWidth={100}
        trayDepth={100}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /左右镜/ }));

    expect(onUpdateSlots).toHaveBeenCalledWith([
      {
        id: "slot-1",
        x: 90,
        y: 50,
        rotation: 180,
      },
    ]);
    expect(toastMock).toHaveBeenNthCalledWith(
      1,
      "info",
      expect.stringContaining("超出托盘边界"),
    );
    expect(toastMock).toHaveBeenNthCalledWith(
      2,
      "info",
      expect.stringContaining("间距冲突"),
    );
  });

  it("previews mirror-copy issues and inserts only valid mirrored slots", async () => {
    const selectedSlots: FreeSlot[] = [
      {
        id: "slot-1",
        x: 20,
        y: 50,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
      },
      {
        id: "slot-2",
        x: 35,
        y: 80,
        shape: "circle",
        width: 20,
        height: 20,
        rotation: 0,
      },
    ];
    const existingDuplicate: FreeSlot = {
      id: "slot-3",
      x: 100,
      y: 50,
      shape: "circle",
      width: 25,
      height: 25,
      rotation: 180,
    };
    const onInsertSlots = vi.fn();

    const { container } = render(
      <MirrorPanel
        allSlots={[...selectedSlots, existingDuplicate]}
        selectedSlots={selectedSlots}
        unselectedSlots={[existingDuplicate]}
        onUpdateSlots={vi.fn()}
        onInsertSlots={onInsertSlots}
        enableCopyPreview={true}
        spacing={4}
        trayWidth={120}
        trayDepth={100}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector('[data-symmetry-preview="mirror-x"]'),
      ).toHaveTextContent("左右重合1");
    });

    fireEvent.click(screen.getByRole("button", { name: /左右复/ }));

    expect(onInsertSlots).toHaveBeenCalledWith([
      {
        x: 85,
        y: 80,
        shape: "circle",
        width: 20,
        height: 20,
        rotation: 180,
      },
    ]);
    expect(toastMock).toHaveBeenCalledWith(
      "info",
      expect.stringContaining("1 个副本与现有槽位重合"),
    );
  });

  it("renders safe mirror-copy previews when both axes can insert cleanly", async () => {
    const selectedSlots: FreeSlot[] = [
      {
        id: "slot-1",
        x: 30,
        y: 30,
        shape: "ellipse",
        width: 24,
        height: 16,
        rotation: 10,
      },
    ];

    const { container } = render(
      <MirrorPanel
        allSlots={selectedSlots}
        selectedSlots={selectedSlots}
        unselectedSlots={[]}
        onUpdateSlots={vi.fn()}
        onInsertSlots={vi.fn()}
        enableCopyPreview={true}
        spacing={4}
        trayWidth={120}
        trayDepth={100}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector('[data-symmetry-preview="mirror-x"]'),
      ).toHaveTextContent("左右安全");
      expect(
        container.querySelector('[data-symmetry-preview="mirror-y"]'),
      ).toHaveTextContent("上下安全");
    });

    expect(
      container.querySelector('[data-symmetry-preview="mirror-x"]'),
    ).toHaveClass("border-[#2a3a25]");
    expect(
      container.querySelector('[data-symmetry-preview="mirror-y"]'),
    ).toHaveClass("border-[#2a3a25]");
  });

  it("skips only spacing-collision copies while inserting remaining mirrored slots", () => {
    const selectedSlots: FreeSlot[] = [
      {
        id: "slot-1",
        x: 20,
        y: 40,
        shape: "circle",
        width: 20,
        height: 20,
        rotation: 0,
      },
      {
        id: "slot-2",
        x: 35,
        y: 80,
        shape: "circle",
        width: 20,
        height: 20,
        rotation: 0,
      },
    ];
    const collisionOnlySlot: FreeSlot = {
      id: "slot-3",
      x: 85,
      y: 80,
      shape: "circle",
      width: 20,
      height: 20,
      rotation: 0,
    };
    const onInsertSlots = vi.fn();

    render(
      <MirrorPanel
        allSlots={[...selectedSlots, collisionOnlySlot]}
        selectedSlots={selectedSlots}
        unselectedSlots={[collisionOnlySlot]}
        onUpdateSlots={vi.fn()}
        onInsertSlots={onInsertSlots}
        enableCopyPreview={false}
        spacing={4}
        trayWidth={120}
        trayDepth={100}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /左右复/ }));

    expect(onInsertSlots).toHaveBeenCalledWith([
      {
        x: 100,
        y: 40,
        shape: "circle",
        width: 20,
        height: 20,
        rotation: 180,
      },
    ]);
    expect(toastMock).toHaveBeenCalledWith(
      "info",
      expect.stringContaining("1 个副本会产生间距冲突"),
    );
    expect(toastMock).not.toHaveBeenCalledWith(
      "info",
      expect.stringContaining("与现有槽位重合"),
    );
  });
});

describe("AlignPanel", { timeout: 15000 }, () => {
  it("disables all actions when fewer than two slots are selected", () => {
    render(
      <AlignPanel
        selectedSlots={[
          {
            id: "slot-1",
            x: 20,
            y: 20,
            shape: "circle",
            width: 25,
            height: 25,
            rotation: 0,
          },
        ]}
        onUpdateSlots={vi.fn()}
        spacing={6}
      />,
    );

    expect(screen.getByRole("button", { name: /左/ })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /中/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /右/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /上/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /下/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /一排/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /一列/ })).toBeDisabled();
    expect(screen.getByText("排布间距自动使用当前槽距 6 mm。")).toBeInTheDocument();
  });

  it("aligns selected slots and arranges them into rows or columns", () => {
    const selectedSlots: FreeSlot[] = [
      {
        id: "slot-1",
        x: 20,
        y: 20,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
      },
      {
        id: "slot-2",
        x: 60,
        y: 60,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
      },
      {
        id: "slot-3",
        x: 100,
        y: 30,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
      },
    ];
    const onUpdateSlots = vi.fn();

    render(
      <AlignPanel
        selectedSlots={selectedSlots}
        onUpdateSlots={onUpdateSlots}
        spacing={6}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /左/ }));
    expect(onUpdateSlots).toHaveBeenLastCalledWith([
      { id: "slot-1", x: 20, y: 20 },
      { id: "slot-2", x: 20, y: 60 },
      { id: "slot-3", x: 20, y: 30 },
    ]);

    fireEvent.click(screen.getAllByRole("button", { name: /中/ })[0]!);
    expect(onUpdateSlots).toHaveBeenLastCalledWith([
      { id: "slot-1", x: 60, y: 20 },
      { id: "slot-2", x: 60, y: 60 },
      { id: "slot-3", x: 60, y: 30 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /右/ }));
    expect(onUpdateSlots).toHaveBeenLastCalledWith([
      { id: "slot-1", x: 100, y: 20 },
      { id: "slot-2", x: 100, y: 60 },
      { id: "slot-3", x: 100, y: 30 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /上/ }));
    expect(onUpdateSlots).toHaveBeenLastCalledWith([
      { id: "slot-1", x: 20, y: 60 },
      { id: "slot-2", x: 60, y: 60 },
      { id: "slot-3", x: 100, y: 60 },
    ]);

    fireEvent.click(screen.getAllByRole("button", { name: /中/ })[1]!);
    expect(onUpdateSlots).toHaveBeenLastCalledWith([
      { id: "slot-1", x: 20, y: 40 },
      { id: "slot-2", x: 60, y: 40 },
      { id: "slot-3", x: 100, y: 40 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /下/ }));
    expect(onUpdateSlots).toHaveBeenLastCalledWith([
      { id: "slot-1", x: 20, y: 20 },
      { id: "slot-2", x: 60, y: 20 },
      { id: "slot-3", x: 100, y: 20 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /一排/ }));
    expect(onUpdateSlots).toHaveBeenLastCalledWith([
      { id: "slot-1", x: 28.8, y: 40 },
      { id: "slot-2", x: 60, y: 40 },
      { id: "slot-3", x: 91.2, y: 40 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /一列/ }));
    expect(onUpdateSlots).toHaveBeenLastCalledWith([
      { id: "slot-1", x: 60, y: 8.8 },
      { id: "slot-3", x: 60, y: 40 },
      { id: "slot-2", x: 60, y: 71.2 },
    ]);
  });
});

describe("CanvasSlotLayer", { timeout: 15000 }, () => {
  it("renders selected stepped slots with readable labels and forwards pointer handlers", () => {
    const slot = createSteppedSlot();
    const steppedGroupMetaById = new Map([[slot.groupId, createGroup()]]);
    const collisionState = buildCanvasCollisionState([slot], 5);
    const onSlotPointerDown = vi.fn();
    const onSlotPointerEnter = vi.fn();
    const onSlotPointerLeave = vi.fn();
    const onSlotRotatePointerDown = vi.fn((event: React.PointerEvent) => {
      event.stopPropagation();
    });

    const { container } = render(
      <svg>
        <CanvasSlotLayer
          slots={[slot]}
          trayDepth={100}
          spacing={5}
          zoom={1}
          selectedIds={new Set([slot.id])}
          hoveredId={null}
          draggingId={null}
          focusedGroupId="group-2"
          steppedGroupMetaById={steppedGroupMetaById}
          collisionState={collisionState}
          isSpacePressed={false}
          onSlotPointerDown={onSlotPointerDown}
          onSlotPointerEnter={onSlotPointerEnter}
          onSlotPointerLeave={onSlotPointerLeave}
          onSlotRotatePointerDown={onSlotRotatePointerDown}
        />
      </svg>,
    );

    const translatedGroup = container.querySelector(
      'g[transform="translate(40, 50)"]',
    );
    const rotateHandle = container.querySelector("g.cursor-pointer");
    const labelGroup = container.querySelector('g[transform="rotate(10)"]');

    expect(translatedGroup).toHaveStyle({ opacity: "0.18" });
    expect(container.querySelector('ellipse[fill="#f97316"]')).not.toBeNull();
    expect(labelGroup).not.toBeNull();
    expect(container).toHaveTextContent("40x20");
    expect(rotateHandle).not.toBeNull();

    fireEvent.pointerEnter(translatedGroup!);
    fireEvent.pointerLeave(translatedGroup!);
    fireEvent.pointerDown(translatedGroup!);
    fireEvent.pointerDown(rotateHandle!);

    expect(onSlotPointerEnter).toHaveBeenCalledWith(slot.id);
    expect(onSlotPointerLeave).toHaveBeenCalledWith(slot.id);
    expect(onSlotPointerDown).toHaveBeenCalledWith(expect.anything(), slot.id);
    expect(onSlotRotatePointerDown).toHaveBeenCalledWith(
      expect.anything(),
      slot,
    );
  });
});

describe("CanvasOverlayLayer", { timeout: 15000 }, () => {
  it("renders effective baseplate, symmetry guides, collision links, and focused outlines", () => {
    const slots: SteppedSlot[] = [
      createSteppedSlot({
        id: "slot-1",
        x: 20,
        y: 30,
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "group-1",
      }),
      createSteppedSlot({
        id: "slot-2",
        x: 40,
        y: 30,
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "group-2",
      }),
    ];
    const collisionState = buildCanvasCollisionState(slots, 5);
    const outlinePreview: GroupOutlinePreview[] = [
      {
        key: "group-1-outline",
        groupId: "group-1",
        color: "#22c55e",
        bottomHeight: 10,
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 20 },
          { x: 20, y: 40 },
        ],
      },
      {
        key: "group-2-outline",
        groupId: "group-2",
        color: "#ef4444",
        bottomHeight: 16,
        points: [
          { x: 40, y: 30 },
          { x: 60, y: 30 },
          { x: 50, y: 45 },
        ],
      },
    ];

    const { container } = render(
      <svg>
        <CanvasOverlayLayer
          trayWidth={120}
          trayDepth={100}
          zoom={1}
          minX={-20}
          minY={-20}
          viewW={160}
          viewH={140}
          showEffectiveBaseplate={true}
          effectiveBaseplate={{
            hasSlots: true,
            x: 5,
            y: 10,
            width: 80,
            height: 60,
          }}
          cornerRadius={6}
          symmetryAxes={{ vertical: 60, horizontal: 25 }}
          collisionState={collisionState}
          focusedGroupId="group-1"
          guideLines={[
            { axis: "x", value: 15 },
            { axis: "y", value: 35 },
          ]}
          outlinePreview={outlinePreview}
        />
      </svg>,
    );

    expect(
      container.querySelector('rect[stroke="#8b7355"]'),
    ).toHaveAttribute("rx", "6");
    expect(
      container.querySelector('line[data-symmetry-axis="mirror-x"]'),
    ).toHaveAttribute("x1", "60");
    expect(
      container.querySelector('line[data-symmetry-axis="mirror-y"]'),
    ).toHaveAttribute("y1", "75");
    expect(container.querySelectorAll('line[stroke="#38bdf8"]')).toHaveLength(4);
    expect(container.querySelector('line[stroke="#ef4444"]')).toHaveAttribute(
      "opacity",
      "0.5",
    );
    expect(container.querySelector('path[stroke="#22c55e"]')).toHaveAttribute(
      "stroke-opacity",
      "0.85",
    );
    expect(container.querySelector('path[stroke="#22c55e"]')).toHaveAttribute(
      "d",
      "M 10.00 80.00 L 30.00 80.00 L 20.00 60.00 Z",
    );
    expect(container.querySelector('path[stroke="#ef4444"]')).toHaveAttribute(
      "stroke-opacity",
      "0.16",
    );
  });
});
