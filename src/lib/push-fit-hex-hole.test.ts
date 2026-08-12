import { describe, expect, it } from "vitest";
import {
  createPushFitHexHoleVertices,
  validatePushFitHexHolePlacement,
} from "@/lib/push-fit-hex-hole";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";

describe("push-fit hex hole", () => {
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
});
