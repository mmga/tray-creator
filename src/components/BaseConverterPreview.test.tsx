import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BaseConverterPreview } from "@/components/BaseConverterPreview";
import {
  BASE_CONVERTER_DEFAULTS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  createConversionGeometrySnapshot,
} from "@/lib/base-converter-config";

describe("BaseConverterPreview", () => {
  it("renders the selected standard conversion and fixed-clearance recess", () => {
    const { container } = render(
      <BaseConverterPreview params={{
        ...BASE_CONVERTER_DEFAULTS,
        sourceStandardId: "source-50x100",
        targetStandardId: "target-ellipse-70x105",
        geometrySnapshot: createConversionGeometrySnapshot(
          SOURCE_BASE_STANDARDS.find((item) => item.id === "source-50x100")!,
          TARGET_BASE_STANDARDS.find((item) => item.id === "target-ellipse-70x105")!,
        ),
      }} />,
    );

    expect(screen.getByLabelText("转换底盘 2D 图")).toBeInTheDocument();
    expect(screen.getByText(/50 × 100mm → 70 × 105mm/)).toBeInTheDocument();
    const recess = container.querySelector("rect[clip-path]");
    expect(recess).toHaveAttribute("width", "50.4");
    expect(recess).toHaveAttribute("height", "100.4");
  });
});
