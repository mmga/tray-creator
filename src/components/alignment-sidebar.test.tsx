import { fireEvent, render, screen } from "@testing-library/react";
import { AlignCenterHorizontal, FlipHorizontal } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AlignmentToolbar from "@/components/AlignmentToolbar";
import EditSidebar from "@/components/canvas/EditSidebar";
import type { FreeSlot } from "@/types/custom-tray";
import type { EditSidebarTab } from "@/components/canvas/EditSidebar";

const { alignPanelSpy, mirrorPanelSpy } = vi.hoisted(() => ({
  alignPanelSpy: vi.fn(),
  mirrorPanelSpy: vi.fn(),
}));

vi.mock("@/components/canvas/AlignPanel", () => ({
  default(props: { selectedSlots: Array<{ id: string }>; spacing: number }) {
    alignPanelSpy(props);
    return (
      <div data-testid="align-panel-mock">
        {`align:${props.selectedSlots.map((slot) => slot.id).join(",")}:${props.spacing}`}
      </div>
    );
  },
}));

vi.mock("@/components/canvas/MirrorPanel", () => ({
  default(props: {
    selectedSlots: Array<{ id: string }>;
    unselectedSlots: Array<{ id: string }>;
    enableCopyPreview: boolean;
    spacing: number;
    trayWidth: number;
    trayDepth: number;
  }) {
    mirrorPanelSpy(props);
    return (
      <div data-testid="mirror-panel-mock">
        {`mirror:${props.selectedSlots.map((slot) => slot.id).join(",")}:${props.unselectedSlots.map((slot) => slot.id).join(",")}:${String(props.enableCopyPreview)}:${props.spacing}:${props.trayWidth}:${props.trayDepth}`}
      </div>
    );
  },
}));

function createSlot(overrides: Partial<FreeSlot> = {}): FreeSlot {
  return {
    id: "slot-1",
    x: 30,
    y: 40,
    shape: "circle",
    width: 25,
    height: 25,
    rotation: 0,
    ...overrides,
  };
}

describe("EditSidebar", { timeout: 15000 }, () => {
  it("renders the active tab content and toggles tabs through button clicks", () => {
    const onTabChange = vi.fn();
    const tabs: EditSidebarTab[] = [
      {
        id: "align",
        label: "对齐",
        summary: "边缘对齐与等距排布",
        icon: AlignCenterHorizontal,
        content: <div>align-content</div>,
      },
      {
        id: "mirror",
        label: "镜像",
        summary: "按托盘中心轴翻转或复制选区",
        icon: FlipHorizontal,
        content: <div>mirror-content</div>,
      },
    ];

    render(
      <EditSidebar
        tabs={tabs}
        activeTabId="align"
        onTabChange={onTabChange}
        selectionCount={2}
      />,
    );

    expect(screen.getByText("align-content")).toBeInTheDocument();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByText("边缘对齐与等距排布")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /对齐/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /镜像/ }));

    expect(onTabChange).toHaveBeenNthCalledWith(1, null);
    expect(onTabChange).toHaveBeenNthCalledWith(2, "mirror");
  });
});

describe("AlignmentToolbar", { timeout: 15000 }, () => {
  beforeEach(() => {
    alignPanelSpy.mockReset();
    mirrorPanelSpy.mockReset();
  });

  it("derives selected and unselected slots for the mirror tab", () => {
    const onActiveTabChange = vi.fn();
    const slots = [
      createSlot({ id: "slot-1" }),
      createSlot({ id: "slot-2", x: 80 }),
    ];

    render(
      <AlignmentToolbar
        selectedIds={new Set(["slot-1"])}
        slots={slots}
        onUpdateSlots={vi.fn()}
        onInsertSlots={vi.fn()}
        enableCopyPreview={true}
        spacing={6}
        trayWidth={260}
        trayDepth={180}
        activeTabId="mirror"
        onActiveTabChange={onActiveTabChange}
      />,
    );

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByTestId("mirror-panel-mock")).toHaveTextContent(
      "mirror:slot-1:slot-2:true:6:260:180",
    );
    expect(mirrorPanelSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedSlots: [slots[0]],
        unselectedSlots: [slots[1]],
        enableCopyPreview: true,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /镜像/ }));
    expect(onActiveTabChange).toHaveBeenCalledWith(null);
  });

  it("prefers explicit selectedSlots and unselectedSlots overrides for the align tab", () => {
    const slots = [
      createSlot({ id: "slot-1" }),
      createSlot({ id: "slot-2", x: 80 }),
      createSlot({ id: "slot-3", x: 120 }),
    ];
    const selectedSlots = [slots[2]!];
    const unselectedSlots = [slots[0]!, slots[1]!];

    render(
      <AlignmentToolbar
        selectedIds={new Set()}
        slots={slots}
        selectedSlots={selectedSlots}
        unselectedSlots={unselectedSlots}
        onUpdateSlots={vi.fn()}
        enableCopyPreview={false}
        spacing={8}
        trayWidth={260}
        trayDepth={180}
        activeTabId="align"
        onActiveTabChange={vi.fn()}
      />,
    );

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByTestId("align-panel-mock")).toHaveTextContent(
      "align:slot-3:8",
    );
    expect(alignPanelSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedSlots,
        spacing: 8,
      }),
    );
  });
});
