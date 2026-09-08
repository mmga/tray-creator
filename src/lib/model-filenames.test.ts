import { describe, expect, it } from "vitest";
import {
  generateCustomBoxSTLFilename,
  generateCustomSTLFilename,
  generateGridBoxSTLFilename,
  generateSTLFilename,
} from "@/lib/model-filenames";

describe("model filenames", () => {
  it("generates stable filenames for grid and custom exports", () => {
    expect(generateSTLFilename(4, 3, 32)).toBe("tray_3x4_32mm.stl");
    expect(generateCustomSTLFilename(120, 90, 5)).toBe(
      "tray_custom_120x90_5slots.stl",
    );
  });

  it("generates body and lid filenames for box exports", () => {
    expect(generateGridBoxSTLFilename(200, 150, 50, 3, 2, "body")).toBe(
      "box_grid_200x150x50_3x2_body.stl",
    );
    expect(generateGridBoxSTLFilename(200, 150, 50, 3, 2, "lid")).toBe(
      "box_grid_200x150x50_3x2_lid.stl",
    );
    expect(generateCustomBoxSTLFilename(200, 150, 50, 4, "body")).toBe(
      "box_custom_200x150x50_4slots_body.stl",
    );
    expect(generateCustomBoxSTLFilename(200, 150, 50, 4, "lid")).toBe(
      "box_custom_200x150x50_4slots_lid.stl",
    );
  });
});
