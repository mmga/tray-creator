import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CanvasZoomControls } from "@/components/canvas/CanvasZoomControls";

describe("CanvasZoomControls", () => {
  it("provides a visible reset-zoom action", () => {
    const onResetZoom = vi.fn();

    render(
      <CanvasZoomControls
        onResetZoom={onResetZoom}
        onShowHints={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "复原缩放" }));

    expect(onResetZoom).toHaveBeenCalledTimes(1);
  });
});
