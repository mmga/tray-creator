import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { ParamSlider } from "@/components/ui/ParamSlider";

vi.mock("@/components/ui/slider", () => ({
  Slider({
    value,
    min,
    max,
    step,
    onKeyDownCapture,
    onValueChange,
  }: {
    value: number[];
    min: number;
    max: number;
    step?: number;
    onKeyDownCapture?: React.KeyboardEventHandler<HTMLDivElement>;
    onValueChange?: (value: number[]) => void;
  }) {
    return (
      <div>
        <div
          data-testid="slider-props"
          data-value={String(value[0])}
          data-min={String(min)}
          data-max={String(max)}
          data-step={String(step)}
        />
        <div
          role="slider"
          tabIndex={0}
          onKeyDownCapture={onKeyDownCapture}
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
    expect(screen.getByTestId("slider-props")).toHaveAttribute(
      "data-step",
      "1",
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

  it("blocks arrow-key parameter changes while allowing precise typed values", () => {
    const onChange = vi.fn();
    const onParentKeyDown = vi.fn();

    render(
      <div onKeyDown={onParentKeyDown}>
        <ParamSlider
          label="长度"
          value={10}
          config={{ min: 0, max: 260, step: 1 }}
          onChange={onChange}
        />
      </div>,
    );

    const input = screen.getByRole("spinbutton");
    expect(input).toHaveAttribute("step", "any");

    expect(fireEvent.keyDown(input, { key: "ArrowUp" })).toBe(false);
    fireEvent.change(input, { target: { value: "10.15" } });

    expect(onParentKeyDown).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(10.15);
  });

  it("keeps the slider step but blocks slider arrow keys", () => {
    const onChange = vi.fn();
    const onParentKeyDown = vi.fn();

    render(
      <div onKeyDown={onParentKeyDown}>
        <ParamSlider
          label="长度"
          value={10}
          config={{ min: 0, max: 260, step: 1 }}
          onChange={onChange}
        />
      </div>,
    );

    expect(screen.getByTestId("slider-props")).toHaveAttribute(
      "data-step",
      "1",
    );
    expect(fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" })).toBe(false);

    expect(onParentKeyDown).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
