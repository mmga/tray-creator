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
    onPointerDownCapture,
    onPointerCancel,
    onValueChange,
    onValueCommit,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
  }: {
    value: number[];
    min: number;
    max: number;
    step?: number;
    onKeyDownCapture?: React.KeyboardEventHandler<HTMLDivElement>;
    onPointerDownCapture?: React.PointerEventHandler<HTMLDivElement>;
    onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
    onValueChange?: (value: number[]) => void;
    onValueCommit?: (value: number[]) => void;
    "aria-label"?: string;
    "aria-describedby"?: string;
  }) {
    return (
      <div
        onPointerDownCapture={onPointerDownCapture}
        onPointerCancel={onPointerCancel}
      >
        <div
          data-testid="slider-props"
          data-value={String(value[0])}
          data-min={String(min)}
          data-max={String(max)}
          data-step={String(step)}
        />
        <div
          role="slider"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-valuenow={value[0]}
          tabIndex={0}
          onKeyDownCapture={onKeyDownCapture}
        />
        <button
          type="button"
          onClick={() => onValueChange?.([value[0]])}
        >
          emit same value
        </button>
        <button
          type="button"
          onClick={() => onValueChange?.([value[0] + 1])}
        >
          preview next value
        </button>
        <button type="button" onClick={() => onValueCommit?.(value)}>
          commit value
        </button>
      </div>
    );
  },
}));

describe("ParamSlider", () => {
  it("将可见标签和单位关联到输入及滑块", () => {
    render(
      <ParamSlider
        label="长度"
        value={10}
        config={{ min: 0, max: 20, step: 1 }}
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByRole("spinbutton", { name: "长度" });
    const slider = screen.getByRole("slider", { name: "长度滑块" });
    expect(input).toHaveAccessibleDescription("mm");
    expect(slider).toHaveAccessibleDescription("mm");
  });

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
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);

    expect(onParentKeyDown).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(10.15);
  });

  it("keeps intermediate text until a complete in-range value is committed", () => {
    const onChange = vi.fn();

    render(
      <ParamSlider
        label="长度"
        value={260}
        config={{ min: 10, max: 5000, step: 0.1 }}
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("spinbutton");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1" } });
    expect(input).toHaveValue(1);
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.change(input, { target: { value: "100" } });
    expect(input).toHaveValue(100);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it("restores the last valid value when the text is invalid on blur", () => {
    const onChange = vi.fn();

    render(
      <ParamSlider
        label="长度"
        value={260}
        config={{ min: 10, max: 5000, step: 0.1 }}
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("spinbutton");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(input).toHaveValue(260);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("can treat slider bounds as a common range while accepting finite typed values outside it", () => {
    const onChange = vi.fn();

    render(
      <ParamSlider
        label="底厚"
        value={1.2}
        config={{ min: 0.8, max: 5, step: 0.1 }}
        onChange={onChange}
        allowOutOfRangeInput
      />,
    );

    const input = screen.getByRole("spinbutton");
    expect(input).not.toHaveAttribute("min");
    expect(input).not.toHaveAttribute("max");
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(8);
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

  it("把一次滑动表达为 begin、preview、commit 生命周期", () => {
    const begin = vi.fn();
    const preview = vi.fn();
    const commit = vi.fn();
    const cancel = vi.fn();

    render(
      <ParamSlider
        label="长度"
        value={10}
        config={{ min: 0, max: 20, step: 1 }}
        onChange={vi.fn()}
        onContinuousChangeStart={begin}
        onContinuousChange={preview}
        onContinuousChangeCommit={commit}
        onContinuousChangeCancel={cancel}
      />,
    );

    const previewButton = screen.getByRole("button", { name: "preview next value" });
    fireEvent.pointerDown(previewButton);
    fireEvent.click(previewButton);
    fireEvent.click(screen.getByRole("button", { name: "commit value" }));

    expect(begin).toHaveBeenCalledTimes(1);
    expect(preview).toHaveBeenCalledWith(11);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("begin 被拒绝时不进入连续预览", () => {
    const preview = vi.fn();
    const commit = vi.fn();

    render(
      <ParamSlider
        label="长度"
        value={10}
        config={{ min: 0, max: 20, step: 1 }}
        onChange={vi.fn()}
        onContinuousChangeStart={() => false}
        onContinuousChange={preview}
        onContinuousChangeCommit={commit}
      />,
    );

    const previewButton = screen.getByRole("button", { name: "preview next value" });
    fireEvent.pointerDown(previewButton);
    fireEvent.click(previewButton);
    fireEvent.click(screen.getByRole("button", { name: "commit value" }));

    expect(preview).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});
