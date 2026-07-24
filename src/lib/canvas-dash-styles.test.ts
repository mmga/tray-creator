import { describe, expect, it } from "vitest";

import { getCanvasDashAttributes } from "@/lib/canvas-dash-styles";

describe("canvas dash styles", () => {
  it("keeps the boundary style visually stable while zooming", () => {
    expect(getCanvasDashAttributes("boundary", 1)).toEqual({
      strokeWidth: 0.2,
      strokeDasharray: "0.5 0.5",
      strokeOpacity: 0.8,
    });
    expect(getCanvasDashAttributes("boundary", 2)).toEqual({
      strokeWidth: 0.1,
      strokeDasharray: "0.25 0.25",
      strokeOpacity: 0.8,
    });
  });

  it("provides separate guide and alert rhythms", () => {
    expect(getCanvasDashAttributes("guide", 1).strokeDasharray).toBe("1 1");
    expect(getCanvasDashAttributes("alert", 1).strokeDasharray).toBe("1 1");
  });
});
