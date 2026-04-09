import { describe, expect, it } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import {
  calculateCustomPrice,
  calculateGridPrice,
  calculateSteppedPrice,
  calculateWeight,
} from "@/lib/pricing";

describe("pricing", () => {
  it("calculates printed weight from model volume", () => {
    expect(calculateWeight(0)).toBe(0);
    expect(calculateWeight(1000)).toBeCloseTo(0.744, 5);
  });

  it("prices grid layouts by slot count, diameter tier and base holes", () => {
    expect(
      calculateGridPrice({
        ...DEFAULT_TRAY_PARAMS,
        rows: 2,
        columns: 3,
        holeDiameter: 25,
        enableBaseHole: false,
      }),
    ).toBe(3);

    expect(
      calculateGridPrice({
        ...DEFAULT_TRAY_PARAMS,
        rows: 2,
        columns: 3,
        holeDiameter: 50,
        enableBaseHole: true,
      }),
    ).toBeCloseTo(9.6, 5);
  });

  it("returns zero for non-positive volume and scales custom and stepped prices from weight", () => {
    expect(calculateCustomPrice(CUSTOM_LAYOUT_DEFAULTS, 0)).toBe(0);
    expect(calculateSteppedPrice(STEPPED_LAYOUT_DEFAULTS, -1)).toBe(0);
    expect(calculateCustomPrice(CUSTOM_LAYOUT_DEFAULTS, 1000)).toBeCloseTo(
      0.2976,
      5,
    );
    expect(calculateSteppedPrice(STEPPED_LAYOUT_DEFAULTS, 2000)).toBeCloseTo(
      0.5952,
      5,
    );
  });
});
