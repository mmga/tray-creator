import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftNumberInput } from "@/components/ui/DraftNumberInput";

describe("DraftNumberInput", () => {
  it("keeps an empty editing draft without committing zero", () => {
    const onValueChange = vi.fn();
    render(
      <DraftNumberInput
        aria-label="尺寸"
        value={25}
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByRole("spinbutton", { name: "尺寸" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });

    expect(input).toHaveValue(null);
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(input).toHaveValue(25);
  });

  it("commits finite values and follows external values when idle", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <DraftNumberInput
        aria-label="尺寸"
        value={25}
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByRole("spinbutton", { name: "尺寸" });

    fireEvent.change(input, { target: { value: "42.5" } });
    expect(onValueChange).toHaveBeenCalledWith(42.5);
    fireEvent.blur(input);

    rerender(
      <DraftNumberInput
        aria-label="尺寸"
        value={30}
        onValueChange={onValueChange}
      />,
    );
    expect(input).toHaveValue(30);
  });

  it("keeps the in-progress text when the external value changes while focused", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <DraftNumberInput
        aria-label="尺寸"
        value={25}
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByRole("spinbutton", { name: "尺寸" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "30" } });
    rerender(
      <DraftNumberInput
        aria-label="尺寸"
        value={40}
        onValueChange={onValueChange}
      />,
    );

    expect(input).toHaveValue(30);
  });
});
