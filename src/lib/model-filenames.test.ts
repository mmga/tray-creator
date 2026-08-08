import { describe, expect, it } from "vitest";
import {
  generateCustomSTLFilename,
  generateSTLFilename,
} from "@/lib/model-filenames";

describe("model filenames", () => {
  it("generates stable filenames for grid and custom exports", () => {
    expect(generateSTLFilename(4, 3, 32)).toBe("tray_3x4_32mm.stl");
    expect(generateCustomSTLFilename(120, 90, 5)).toBe(
      "tray_custom_120x90_5slots.stl",
    );
  });
});
