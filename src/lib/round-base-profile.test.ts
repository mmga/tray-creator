import { describe, expect, it } from "vitest";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";
import {
  getRoundBaseCavityDimensions,
  getRoundBaseOuterDiameterAtHeight,
  ROUND_BASE_SHELL_THICKNESS,
} from "@/lib/round-base-profile";

describe("round base profile", () => {
  it("derives an open underside with a uniform 1.2mm shell", () => {
    expect(ROUND_BASE_SHELL_THICKNESS).toBe(1.2);
    expect(getRoundBaseCavityDimensions(
      BASE_CONVERTER_DEFAULTS.roundBaseSnapshot,
    )).toEqual({
      depth: 2.8,
      bottomDiameter: 29.6,
      ceilingDiameter: 27.5,
    });
  });

  it("interpolates the tapered outer diameter at the wall bottom height", () => {
    const profile = BASE_CONVERTER_DEFAULTS.roundBaseSnapshot;

    expect(getRoundBaseOuterDiameterAtHeight(profile, 1)).toBeCloseTo(31.25, 8);
    expect(getRoundBaseOuterDiameterAtHeight(profile, -1)).toBe(32);
    expect(getRoundBaseOuterDiameterAtHeight(profile, 10)).toBe(29);
  });
});
