import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GridLayoutPreview } from "@/components/GridLayoutPreview";
import {
  createOldWorldGridSlotSnapshot,
  DEFAULT_TRAY_PARAMS,
} from "@/lib/grid-config";

describe("GridLayoutPreview", () => {
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
