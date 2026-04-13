import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import {
  calculateCustomTrayDimensions,
  createCustomTrayModel,
} from "@/lib/custom-tray-model";

const { measureBoundingBox, measureVolume } = measurements;

describe("custom tray model", () => {
  it("falls back to configured tray dimensions when there are no slots", () => {
    expect(calculateCustomTrayDimensions(CUSTOM_LAYOUT_DEFAULTS)).toEqual({
      width: 260,
      depth: 260,
      height: 6,
    });
  });

  it("derives occupied bounds from rotated slots and boundary spacing", () => {
    const dimensions = calculateCustomTrayDimensions({
      ...CUSTOM_LAYOUT_DEFAULTS,
      spacing: 8,
      boundarySpacingIndependent: true,
      boundarySpacing: 10,
      slots: [
        {
          id: "slot-1",
          x: 10,
          y: 10,
          width: 40,
          height: 20,
          rotation: 0,
          shape: "ellipse",
        },
        {
          id: "slot-2",
          x: 80,
          y: 20,
          width: 30,
          height: 50,
          rotation: 90,
          shape: "ellipse",
        },
      ],
    });

    expect(dimensions.width).toBe(136);
    expect(dimensions.depth).toBe(56);
    expect(dimensions.height).toBe(6);
  });

  it("keeps positive volume and removes more material when enabling base holes", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseThickness: 3.2,
      enableBaseHole: true as const,
      baseHoleSize: "25" as const,
      slots: [
        {
          id: "slot-1",
          x: 30,
          y: 40,
          width: 40,
          height: 20,
          rotation: 30,
          shape: "ellipse",
        },
      ],
    };
    const plainModel = createCustomTrayModel({ ...params, enableBaseHole: false });
    const baseHoleModel = createCustomTrayModel(params);

    const plainVolume = measureVolume(plainModel);
    const baseHoleVolume = measureVolume(baseHoleModel);
    const [[minX, minY, minZ], [maxX, maxY, maxZ]] =
      measureBoundingBox(baseHoleModel);
    const dimensions = calculateCustomTrayDimensions(params);

    expect(plainVolume).toBeGreaterThan(0);
    expect(baseHoleVolume).toBeGreaterThan(0);
    expect(baseHoleVolume).toBeLessThan(plainVolume);
    expect(maxX - minX).toBeCloseTo(dimensions.width, 1);
    expect(maxY - minY).toBeCloseTo(dimensions.depth, 1);
    expect(maxZ - minZ).toBeCloseTo(dimensions.height, 1);
  });
});
