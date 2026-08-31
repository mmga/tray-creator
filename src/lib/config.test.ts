import { describe, expect, it } from "vitest";
import {
  BASE_PRESETS,
  getBaseHoleMinBaseThickness,
  getBaseHoleMinBottomWall,
  getBaseHolePreset,
} from "@/lib/config";
import { CUSTOM_BASE_PRESETS } from "@/lib/custom-config";

describe("base presets", () => {
  it("keeps the 10mm base out of fixed presets", () => {
    expect(CUSTOM_BASE_PRESETS.some((preset) => preset.diameter === 10)).toBe(false);
    expect(BASE_PRESETS.some((preset) => preset.diameter === 10)).toBe(false);
  });
});

describe("base hole config", () => {
  it("derives the minimum base thickness from the resolved preset depth", () => {
    expect(getBaseHolePreset("20")).toMatchObject({
      diameter: 20.2,
      depth: 1,
    });
    expect(getBaseHolePreset("25")).toMatchObject({
      diameter: 25.2,
      depth: 1.2,
    });
    expect(getBaseHolePreset("40")).toMatchObject({
      diameter: 40.4,
      depth: 1.4,
    });
    expect(getBaseHoleMinBottomWall("20")).toBeCloseTo(0.6, 5);
    expect(getBaseHoleMinBottomWall("25")).toBeCloseTo(0.6, 5);
    expect(getBaseHoleMinBottomWall("40")).toBeCloseTo(0.4, 5);
    expect(getBaseHoleMinBaseThickness("20")).toBeCloseTo(2.2, 5);
    expect(getBaseHoleMinBaseThickness("25")).toBeCloseTo(2.4, 5);
    expect(getBaseHoleMinBaseThickness("40")).toBeCloseTo(2.4, 5);
  });
});
