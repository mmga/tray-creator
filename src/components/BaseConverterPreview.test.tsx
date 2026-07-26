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
        sideBevelWidth: 0,
      }} />,
    );

    expect(screen.getByLabelText("转换底盘 2D 图")).toBeInTheDocument();
    expect(screen.getByText(/50 × 100mm → 70 × 105mm/)).toBeInTheDocument();
    const recess = container.querySelector("rect[clip-path]");
    expect(recess).toHaveAttribute("width", "50.4");
    expect(recess).toHaveAttribute("height", "100.4");
  });

  it("renders a circular recess for round-to-round conversion", () => {
    const { container } = render(
      <BaseConverterPreview params={{
        sourceStandardId: "source-circle-20",
        targetStandardId: "target-circle-25",
        floorThickness: 1.2,
        recessDepth: 2,
        sideBevelWidth: 1,
      }} />,
    );

    expect(screen.getByText(/Ø20mm → Ø25mm/)).toBeInTheDocument();
    const recess = container.querySelector("ellipse[clip-path]");
    expect(recess).toHaveAttribute("rx", "10.2");
    expect(recess).toHaveAttribute("ry", "10.2");
    expect(container.querySelector('ellipse[stroke-dasharray="1.2 0.8"]'))
      .toHaveAttribute("rx", "11.5");
  });
});
