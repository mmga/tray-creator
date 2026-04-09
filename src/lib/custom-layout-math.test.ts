import { describe, expect, it } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import {
  calculateCustomEffectiveDimensions,
  resolveCustomBoundarySpacing,
} from "@/lib/custom-layout-math";

describe("custom layout math", () => {
  it("resolves boundary spacing from either the shared spacing or the override", () => {
    expect(
      resolveCustomBoundarySpacing({
        ...CUSTOM_LAYOUT_DEFAULTS,
        spacing: 6,
        boundarySpacing: 12,
        boundarySpacingIndependent: false,
      }),
    ).toBe(6);

    expect(
      resolveCustomBoundarySpacing({
        ...CUSTOM_LAYOUT_DEFAULTS,
        spacing: 6,
        boundarySpacing: 12,
        boundarySpacingIndependent: true,
      }),
    ).toBe(12);
  });

  it("returns zero extents for empty layouts", () => {
    expect(
      calculateCustomEffectiveDimensions(CUSTOM_LAYOUT_DEFAULTS),
    ).toEqual({
      width: 0,
      depth: 0,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    });
  });

  it("calculates effective dimensions from slot bounds and boundary spacing", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      spacing: 5,
      boundarySpacing: 7,
      boundarySpacingIndependent: true,
      slots: [
        {
          id: "slot-1",
          x: 30,
          y: 40,
          shape: "circle" as const,
          width: 20,
          height: 20,
          rotation: 0,
        },
        {
          id: "slot-2",
          x: 80,
          y: 100,
          shape: "circle" as const,
          width: 20,
          height: 20,
          rotation: 0,
        },
      ],
    };

    expect(calculateCustomEffectiveDimensions(params)).toEqual({
      width: 85,
      depth: 95,
      minX: 19.8,
      maxX: 90.2,
      minY: 29.8,
      maxY: 110.2,
    });
  });
});
