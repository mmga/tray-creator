import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParamSlider } from "@/components/ui/ParamSlider";

vi.mock("@/components/ui/slider", () => ({
  Slider({
    value,
    min,
    max,
    onValueChange,
  }: {
    value: number[];
    min: number;
    max: number;
    onValueChange?: (value: number[]) => void;
  }) {
    return (
      <div>
        <div
          data-testid="slider-props"
          data-value={String(value[0])}
          data-min={String(min)}
          data-max={String(max)}
        />
        <button
          type="button"
          onClick={() => onValueChange?.([value[0]])}
        >
          emit same value
        </button>
      </div>
    );
  },
}));

describe("ParamSlider", () => {
  it("expands slider bounds to contain the current controlled value", () => {
    const onChange = vi.fn();

    render(
      <ParamSlider
        label="长度"
        value={320}
        config={{ min: 0, max: 260, step: 1 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId("slider-props")).toHaveAttribute(
      "data-value",
      "320",
    );
    expect(screen.getByTestId("slider-props")).toHaveAttribute(
      "data-max",
      "320",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores slider callbacks that repeat the current value", () => {
    const onChange = vi.fn();

    render(
      <ParamSlider
        label="长度"
        value={320}
        config={{ min: 0, max: 260, step: 1 }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "emit same value" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
