import { describe, expect, it, vi } from "vitest";
import { geometries } from "@jscad/modeling";
import { generateOutlineGeom2, type OutlineCircle } from "@/lib/outline-geometry";

const { geom2 } = geometries;

describe("outline geometry", () => {

  it("falls back to the unsmoothed union when inset collapses", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const geom = generateOutlineGeom2([{ cx: 0, cy: 0, rOuter: 0.2 }], 4, 32);

    expect(geom).not.toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("Inset collapsed");

    const outlines = geom2.toOutlines(geom!);
    const distances = outlines[0].map(([x, y]) => Math.hypot(x, y));
    expect(Math.max(...distances)).toBeLessThan(0.25);

    warnSpy.mockRestore();
  });

  it("repairs sub-tolerance cracks left by circle union before extracting outlines", () => {
    const circles: OutlineCircle[] = [
      { cx: 15, cy: 21.7, rOuter: 40.2 },
      { cx: 150.5, cy: 87.1, rOuter: 40.2 },
      { cx: 49.6, cy: -19.7, rOuter: 12.7 },
      { cx: 104.2, cy: -10.9, rOuter: 20.2 },
      { cx: 117.8, cy: 39.5, rOuter: 30.2 },
    ];

    const outline = generateOutlineGeom2(circles, 25.6, 64);

    expect(outline).not.toBeNull();
    expect(() => geom2.toOutlines(outline!)).not.toThrow();
  });

});
