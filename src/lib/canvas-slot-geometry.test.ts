import { describe, expect, it } from "vitest";
import {
  calculateEffectiveBaseplate,
  getEllipseBoundingBox,
  getSlotLabelRotation,
  normalizeDisplayAngle,
} from "@/lib/canvas-slot-geometry";

describe("canvas slot geometry", () => {
  it("normalizes display angles and keeps label rotations readable", () => {
    expect(normalizeDisplayAngle(270)).toBe(-90);
    expect(normalizeDisplayAngle(180)).toBe(180);
    expect(getSlotLabelRotation(150)).toBe(30);
    expect(getSlotLabelRotation(-120)).toBe(-60);
  });

  it("calculates tolerance-aware bounding boxes", () => {
    expect(getEllipseBoundingBox(20, 10, 0)).toEqual({
      halfW: 10.2,
      halfH: 5.2,
    });

    expect(getEllipseBoundingBox(20, 10, 0, "ellipse")).toEqual({
      halfW: 10.4,
      halfH: 5.4,
    });

    const diagonalEllipse = getEllipseBoundingBox(20, 10, 45, "ellipse");
    expect(diagonalEllipse.halfW).toBeCloseTo(Math.sqrt(62.5) + 0.4, 5);
    expect(diagonalEllipse.halfH).toBeCloseTo(Math.sqrt(62.5) + 0.4, 5);

    const rotated = getEllipseBoundingBox(20, 10, 90);
    expect(rotated.halfW).toBeCloseTo(5.2, 5);
    expect(rotated.halfH).toBeCloseTo(10.2, 5);
  });

  it("builds effective baseplate bounds in canvas coordinates", () => {
    expect(calculateEffectiveBaseplate([], 200, 5)).toEqual({
      hasSlots: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });

    expect(
      calculateEffectiveBaseplate(
        [
          { x: 30, y: 40, width: 20, height: 20, rotation: 0, shape: "circle" },
          { x: 80, y: 100, width: 20, height: 20, rotation: 0, shape: "circle" },
        ],
        200,
        7,
      ),
    ).toEqual({
      hasSlots: true,
      x: 12.8,
      y: 82.8,
      width: 84.4,
      height: 94.4,
    });
  });
});
