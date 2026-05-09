import { describe, expect, it } from "vitest";
import {
  getBaseHoleMinBaseThickness,
  getBaseHoleMinBottomWall,
  getBaseHolePreset,
  resolveBaseHolePresetKey,
} from "@/lib/config";

describe("base hole config", () => {
  it("resolves the large preset for larger slot sizes", () => {
    expect(resolveBaseHolePresetKey(25)).toBe("25");
    expect(resolveBaseHolePresetKey(59.9)).toBe("25");
    expect(resolveBaseHolePresetKey(60)).toBe("40");
    expect(resolveBaseHolePresetKey(120)).toBe("40");
  });

  it("derives the minimum base thickness from the resolved preset depth", () => {
    expect(getBaseHolePreset("25")).toMatchObject({ diameter: 25, depth: 1.2 });
    expect(getBaseHolePreset("40")).toMatchObject({ diameter: 40, depth: 1.4 });
    expect(getBaseHoleMinBottomWall("25")).toBeCloseTo(0.6, 5);
    expect(getBaseHoleMinBottomWall("40")).toBeCloseTo(0.4, 5);
    expect(getBaseHoleMinBaseThickness("25")).toBeCloseTo(2.4, 5);
    expect(getBaseHoleMinBaseThickness("40")).toBeCloseTo(2.4, 5);
  });
});
