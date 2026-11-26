import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AlignPanel from "@/components/canvas/AlignPanel";
import type { FreeSlot } from "@/types/custom-tray";

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

describe("AlignPanel", { timeout: 15000 }, () => {
  it("aligns selected slots to the left edge of the selection bounds", () => {
    const onUpdateSlots = vi.fn();

    render(
      <AlignPanel
        selectedSlots={[
          createSlot({ id: "slot-1", x: 30, y: 40 }),
          createSlot({ id: "slot-2", x: 70, y: 80 }),
        ]}
        onUpdateSlots={onUpdateSlots}
        spacing={5}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /左/ }));

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { id: "slot-1", x: 30, y: 40 },
      { id: "slot-2", x: 30, y: 80 },
    ]);
  });

  it("re-arranges a selection into a centered row using the current spacing", () => {
    const onUpdateSlots = vi.fn();

    render(
      <AlignPanel
        selectedSlots={[
          createSlot({ id: "slot-1", x: 20, y: 30 }),
          createSlot({ id: "slot-2", x: 80, y: 70 }),
        ]}
        onUpdateSlots={onUpdateSlots}
        spacing={5}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /一排/ }));

    const updates = onUpdateSlots.mock.calls[0]?.[0];
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ id: "slot-1", y: 50 });
    expect(updates[1]).toMatchObject({ id: "slot-2", y: 50 });
    expect(updates[0].x).toBeCloseTo(34.8, 5);
    expect(updates[1].x).toBeCloseTo(65.2, 5);
  });

  it("disables align and arrange actions when fewer than two slots are selected", () => {
    render(
      <AlignPanel
        selectedSlots={[createSlot()]}
        onUpdateSlots={vi.fn()}
        spacing={5}
      />,
    );

    expect(screen.getByRole("button", { name: /左/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /一排/ })).toBeDisabled();
  });

  it("水平按实际槽宽均分容器留白，保留槽位顺序与 Y 坐标", () => {
    const onUpdateSlots = vi.fn();
    render(
      <AlignPanel
        selectedSlots={[
          createSlot({ id: "right", x: 120, y: 35, slotWidth: 10 }),
          createSlot({ id: "left", x: 50, y: 40, slotWidth: 20 }),
          createSlot({ id: "middle", x: 85, y: 60, slotWidth: 30 }),
        ]}
        distributionArea={{ x: 10, y: 5, width: 140, depth: 100, cornerRadius: 0 }}
        spacing={5}
        onUpdateSlots={onUpdateSlots}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "容器内水平均布" }));
    expect(onUpdateSlots).toHaveBeenCalledExactlyOnceWith([
      { id: "left", x: 40, y: 40 },
      { id: "middle", x: 85, y: 60 },
      { id: "right", x: 125, y: 35 },
    ]);
  });

  it("竖直均布保留 X 坐标，空间紧时优先满足最小槽距", () => {
    const onUpdateSlots = vi.fn();
    render(
      <AlignPanel
        selectedSlots={[
          createSlot({ id: "front", x: 15, y: 20, slotWidth: 20 }),
          createSlot({ id: "back", x: 45, y: 36, slotWidth: 20 }),
        ]}
        distributionArea={{ x: 0, y: 5, width: 65, depth: 52, cornerRadius: 0 }}
        spacing={8}
        onUpdateSlots={onUpdateSlots}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "容器内竖直均布" }));
    expect(onUpdateSlots).toHaveBeenCalledExactlyOnceWith([
      { id: "front", x: 15, y: 17 },
      { id: "back", x: 45, y: 45 },
    ]);
  });

  it("容器尺寸不够保留最小槽距时禁用对应方向", () => {
    render(
      <AlignPanel
        selectedSlots={[
          createSlot({ id: "first", x: 15, y: 15, slotWidth: 30 }),
          createSlot({ id: "second", x: 47, y: 70, slotWidth: 30 }),
        ]}
        distributionArea={{ x: 0, y: 0, width: 64, depth: 100, cornerRadius: 0 }}
        spacing={5}
        onUpdateSlots={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "容器内水平均布" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "容器内竖直均布" })).toBeEnabled();
  });
});
