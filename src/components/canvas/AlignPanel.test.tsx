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
    expect(updates[1].x).toBeCloseTo(65, 5);
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
});
