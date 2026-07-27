import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BaseConverterPanel from "@/components/BaseConverterPanel";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";

describe("BaseConverterPanel", () => {
  it("shows standards, fixed clearance, and disabled incompatible targets", () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(
      <BaseConverterPanel
        params={{
          ...BASE_CONVERTER_DEFAULTS,
          sourceStandardId: "source-50x100",
          targetStandardId: "target-ellipse-70x105",
        }}
        updateParam={vi.fn()}
        actions={<div>操作区</div>}
        isGenerating={false}
        isPreviewStale={false}
        volume={0}
      />,
    );

    expect(screen.getByText("0.2 mm")).toBeInTheDocument();
    expect(screen.getByText("50.4 × 100.4 mm")).toBeInTheDocument();
    const targetSelect = screen.getAllByRole("combobox")[1];
    fireEvent.click(targetSelect);
    expect(
      screen.getByText("圆形 · Ø25mm（尺寸不足）").closest('[role="option"]'),
    ).toHaveAttribute("data-disabled");
    const compatibleTargetOption = screen
      .getAllByText("椭圆 · 70 × 105mm")
      .map((element) => element.closest('[role="option"]'))
      .find(Boolean);
    expect(
      compatibleTargetOption,
    ).not.toHaveAttribute("data-disabled");
  });
});
