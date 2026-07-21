import { describe, expect, it } from "vitest";
import { calculateSteppedEffectiveDimensions } from "@/lib/stepped-layout-math";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";

describe("stepped layout math", () => {
  it("独立边界间距决定派生尺寸", () => {
    const params = {
      ...STEPPED_LAYOUT_DEFAULTS,
      spacing: 3,
      boundarySpacing: 11,
      boundarySpacingIndependent: true,
      slots: [{
        id: "slot-1",
        x: 50,
        y: 50,
        shape: "circle" as const,
        width: 25,
        height: 25,
        rotation: 0,
        groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
      }],
    };

    const dimensions = calculateSteppedEffectiveDimensions(params);

    expect(dimensions.width).toBeCloseTo(47.2, 1);
    expect(dimensions.depth).toBeCloseTo(47.2, 1);
  });
});
