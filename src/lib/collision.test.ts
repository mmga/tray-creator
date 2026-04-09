import { describe, expect, it } from "vitest";
import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";

describe("collision helpers", () => {
  it("builds ellipse polygons with the requested step count", () => {
    const polygon = getEllipsePolygon(10, 20, 30, 10, 0, 2, 8);

    expect(polygon).toHaveLength(8);
    expect(polygon[0].x).toBeCloseTo(27, 5);
    expect(polygon[0].y).toBeCloseTo(20, 5);
  });

  it("detects overlap and treats only touching edges as non-intersecting", () => {
    const overlappingA = getEllipsePolygon(0, 0, 20, 20, 0);
    const overlappingB = getEllipsePolygon(15, 0, 20, 20, 0);
    const touching = getEllipsePolygon(20.4, 0, 20, 20, 0);
    const distant = getEllipsePolygon(40, 0, 20, 20, 0);

    expect(polygonsIntersect(overlappingA, overlappingB)).toBe(true);
    expect(polygonsIntersect(overlappingA, touching)).toBe(false);
    expect(polygonsIntersect(overlappingA, distant)).toBe(false);
  });

  it("accounts for rotation and optional margin expansion", () => {
    const rotated = getEllipsePolygon(0, 0, 20, 10, 45, 0, 16);
    const expanded = getEllipsePolygon(0, 0, 20, 10, 45, 5, 16);

    const rotatedMaxRadius = Math.max(
      ...rotated.map((point) => Math.hypot(point.x, point.y)),
    );
    const expandedMaxRadius = Math.max(
      ...expanded.map((point) => Math.hypot(point.x, point.y)),
    );

    expect(expandedMaxRadius).toBeGreaterThan(rotatedMaxRadius);
  });
});
