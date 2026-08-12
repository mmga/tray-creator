import { describe, expect, it } from "vitest";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";
import {
  getRoundBaseCavityDimensions,
  ROUND_BASE_SHELL_THICKNESS,
} from "@/lib/round-base-profile";

describe("round base profile", () => {
  it("derives an open underside with a uniform 2mm shell", () => {
    expect(ROUND_BASE_SHELL_THICKNESS).toBe(2);
    expect(getRoundBaseCavityDimensions(
      BASE_CONVERTER_DEFAULTS.roundBaseSnapshot,
    )).toEqual({
      depth: 2,
      bottomDiameter: 28,
      ceilingDiameter: 26.5,
    });
  });
});
