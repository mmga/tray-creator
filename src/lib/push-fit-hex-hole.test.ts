import { describe, expect, it } from "vitest";
import {
  clampPushFitHexHoleOffset,
  createPushFitHexHoleVertices,
  createPushFitHexWallOuterVertices,
  validatePushFitHexHolePlacement,
} from "@/lib/push-fit-hex-hole";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";

describe("push-fit hex hole", () => {
  it("expands the wall outer profile by 2mm on every flat", () => {
    const outer = createPushFitHexWallOuterVertices(
      { acrossFlats: 3, offsetX: 2, offsetY: -1 },
      2,
    );

    expect(Math.max(...outer.map((point) => point.y)))
      .toBeCloseTo(-1 + 3.5, 8);
    expect(Math.min(...outer.map((point) => point.y)))
      .toBeCloseTo(-1 - 3.5, 8);
  });

  it("creates a regular hexagon from its final across-flats size", () => {
    const vertices = createPushFitHexHoleVertices({
      acrossFlats: 3,
      offsetX: 2,
      offsetY: -1,
    });

    expect(vertices).toHaveLength(6);
    expect(Math.max(...vertices.map((point) => point.y))
      - Math.min(...vertices.map((point) => point.y))).toBeCloseTo(3, 8);
    expect(vertices[0]).toEqual({
      x: expect.closeTo(2 + Math.sqrt(3), 8),
      y: expect.closeTo(-1, 8),
    });
  });

  it("checks all six vertices against the top profile and minimum wall", () => {
    const profile = BASE_CONVERTER_DEFAULTS.roundBaseSnapshot;
    const vertexRadius = 3 / Math.sqrt(3);
    const legalOffset = profile.nominalDiameter / 2
      - profile.topInset
      - 0.6
      - vertexRadius;

    expect(validatePushFitHexHolePlacement(profile, {
      acrossFlats: 3,
      offsetX: legalOffset,
      offsetY: 0,
    })).toBeNull();
    expect(validatePushFitHexHolePlacement(profile, {
      acrossFlats: 3,
      offsetX: legalOffset + 0.01,
      offsetY: 0,
    })).toContain("至少 0.6mm 顶面壁厚");
  });

  it("limits a drag to the last legal point along its movement direction", () => {
    const profile = BASE_CONVERTER_DEFAULTS.roundBaseSnapshot;
    const hole = BASE_CONVERTER_DEFAULTS.pushFitHexHole;
    const clamped = clampPushFitHexHoleOffset(profile, hole, {
      x: 30,
      y: 8,
    });

    expect(validatePushFitHexHolePlacement(profile, {
      ...hole,
      offsetX: clamped.x,
      offsetY: clamped.y,
    })).toBeNull();
    expect(clamped.x).toBeLessThan(30);
    expect(clamped.y / clamped.x).toBeCloseTo(8 / 30, 5);
  });
});
