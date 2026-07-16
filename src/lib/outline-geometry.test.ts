import { describe, expect, it, vi } from "vitest";
import { geometries } from "@jscad/modeling";
import {
  generateOutline,
  generateOutlineGeom2,
  outlinePointsToGeom2,
  type OutlineCircle,
} from "@/lib/outline-geometry";

const { geom2 } = geometries;

function getDistances(
  points: { x: number; y: number }[],
  center: { x: number; y: number },
) {
  return points.map((point) => Math.hypot(point.x - center.x, point.y - center.y));
}

function getCentroid(points: { x: number; y: number }[]) {
  const total = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

describe("outline geometry", () => {
  it("returns null for empty circle input", () => {
    expect(generateOutline([], 10)).toBeNull();
    expect(generateOutlineGeom2([], 10)).toBeNull();
  });

  it("clamps negative smoothing radius to the zero-smoothing outline", () => {
    const circles: OutlineCircle[] = [{ cx: 12, cy: -8, rOuter: 14 }];

    expect(generateOutline(circles, -5, 48)).toEqual(
      generateOutline(circles, 0, 48),
    );
  });

  it("keeps a smoothed single-circle outline on the original radius", () => {
    const outline = generateOutline([{ cx: 3, cy: -4, rOuter: 12 }], 6, 48);

    expect(outline).not.toBeNull();
    const distances = getDistances(outline!.points, { x: 3, y: -4 });

    expect(outline!.segments).toEqual([]);
    expect(Math.min(...distances)).toBeCloseTo(12, 1);
    expect(Math.max(...distances)).toBeCloseTo(12, 1);
  });

  it("chooses the largest outline when union returns multiple disjoint contours", () => {
    const outline = generateOutline(
      [
        { cx: 0, cy: 0, rOuter: 8 },
        { cx: 60, cy: 0, rOuter: 16 },
      ],
      0,
      64,
    );

    expect(outline).not.toBeNull();
    const centroid = getCentroid(outline!.points);
    const distances = getDistances(outline!.points, { x: 60, y: 0 });

    expect(centroid.x).toBeCloseTo(60, 0);
    expect(Math.min(...distances)).toBeGreaterThan(15.5);
    expect(Math.max(...distances)).toBeLessThan(16.5);
  });

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

  it("converts outline points back to geom2 tuples", () => {
    expect(
      outlinePointsToGeom2([
        { x: 1, y: 2 },
        { x: -3, y: 4 },
      ]),
    ).toEqual([
      [1, 2],
      [-3, 4],
    ]);
  });
});
