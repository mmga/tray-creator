import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BaseConverterPreview } from "@/components/BaseConverterPreview";

describe("BaseConverterPreview", () => {
  it("renders the selected standard conversion and fixed-clearance recess", () => {
    const { container } = render(
      <BaseConverterPreview params={{
        sourceStandardId: "source-50x100",
        targetStandardId: "target-ellipse-70x105",
        floorThickness: 1.2,
        recessDepth: 2,
      }} />,
    );

    expect(screen.getByLabelText("转换底盘 2D 图")).toBeInTheDocument();
    expect(screen.getByText(/50 × 100mm → 70 × 105mm/)).toBeInTheDocument();
    const recess = container.querySelector("rect[clip-path]");
    expect(recess).toHaveAttribute("width", "50.4");
    expect(recess).toHaveAttribute("height", "100.4");
  });
});
