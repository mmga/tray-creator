import { render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ParamSlider } from "@/components/ui/ParamSlider";

describe("ParamSlider with Radix Slider", () => {
  it("does not call onChange while rendering a controlled value", () => {
    const onChange = vi.fn();

    render(
      <ParamSlider
        label="列数"
        value={30}
        config={{ min: 1, max: 30, step: 1 }}
        onChange={onChange}
        unit="个"
      />,
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not loop when the parent stores slider changes in state", () => {
    const onRender = vi.fn();

    function StatefulHarness() {
      const [value, setValue] = useState(30);
      onRender(value);
      return (
        <ParamSlider
          label="列数"
          value={value}
          config={{ min: 1, max: 30, step: 1 }}
          onChange={setValue}
          unit="个"
        />
      );
    }

    render(<StatefulHarness />);

    expect(onRender).toHaveBeenCalledTimes(1);
  });
});
