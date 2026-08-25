import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GridLayoutPreview } from "@/components/GridLayoutPreview";
import {
  createOldWorldGridSlotSnapshot,
  DEFAULT_TRAY_PARAMS,
} from "@/lib/grid-config";

describe("GridLayoutPreview", () => {
  it("shows the removed island only when both effective spacings are zero", () => {
    const { container, rerender } = render(
      <GridLayoutPreview
        params={{
          ...DEFAULT_TRAY_PARAMS,
          rows: 2,
          columns: 2,
          spacing: 0,
        }}
      />,
    );

    expect(container.querySelector("[data-grid-island-cut]")).toBeInTheDocument();

    rerender(
      <GridLayoutPreview
        params={{
          ...DEFAULT_TRAY_PARAMS,
          rows: 2,
          columns: 2,
          spacingIndependent: true,
          spacingX: 0,
          spacingY: 0.1,
        }}
      />,
    );

    expect(container.querySelector("[data-grid-island-cut]")).not.toBeInTheDocument();
  });

  it("uses nominal Old World base pitch for zero-spacing ranked arrays", () => {
    const { container, getByText } = render(
      <GridLayoutPreview
        params={{
          ...DEFAULT_TRAY_PARAMS,
          ...createOldWorldGridSlotSnapshot({
            id: "old-world-25x25",
            name: "旧世界 25×25mm",
            width: 25,
            height: 25,
          }),
          rows: 1,
          columns: 2,
          spacing: 0,
        }}
      />,
    );

    const slots = [...container.querySelectorAll('rect[fill="#eab308"]')];
    const firstX = Number(slots[0]?.getAttribute("x"));
    const secondX = Number(slots[1]?.getAttribute("x"));

    expect(secondX - firstX).toBeCloseTo(25, 5);
    expect(getByText("50.4 × 25.4 mm")).toBeInTheDocument();
  });

  it("renders Old World slots as rectangles instead of circles", () => {
    const { container } = render(
      <GridLayoutPreview
        params={{
          ...DEFAULT_TRAY_PARAMS,
          ...createOldWorldGridSlotSnapshot({
            id: "old-world-30x60",
            name: "旧世界 30×60mm",
            width: 30,
            height: 60,
          }),
          rows: 1,
          columns: 2,
        }}
      />,
    );

    expect(container.querySelectorAll('circle[fill="#eab308"]')).toHaveLength(0);
    expect(container.querySelectorAll('rect[fill="#eab308"]')).toHaveLength(2);
  });
});
