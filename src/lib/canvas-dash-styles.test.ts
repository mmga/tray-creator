import { describe, expect, it } from "vitest";

import { getCanvasDashAttributes } from "@/lib/canvas-dash-styles";

describe("canvas dash styles", () => {
  it("keeps the boundary style visually stable while zooming", () => {
    expect(getCanvasDashAttributes("boundary", 1)).toEqual({
      strokeWidth: 0.5,
      strokeDasharray: "3 3",
      strokeOpacity: 0.88,
    });
    expect(getCanvasDashAttributes("boundary", 2)).toEqual({
      strokeWidth: 0.25,
      strokeDasharray: "1.5 1.5",
      strokeOpacity: 0.88,
    });
  });

  it("provides separate guide and alert rhythms", () => {
    expect(getCanvasDashAttributes("guide", 1).strokeDasharray).toBe("2 2");
    expect(getCanvasDashAttributes("alert", 1).strokeDasharray).toBe("3 2");
  });
});
