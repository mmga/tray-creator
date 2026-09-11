import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import { createBaseBody } from "@/lib/model-utils";

describe("createBaseBody", () => {
  it("lofts a sharp-cornered bevel as an exact rectangular frustum", () => {
    const body = createBaseBody(25, 25, 4, 0, 1.5);
    const [min, max] = measurements.measureBoundingBox(body);

    expect(max[0] - min[0]).toBeCloseTo(25, 5);
    expect(max[1] - min[1]).toBeCloseTo(25, 5);
    expect(max[2] - min[2]).toBeCloseTo(4, 5);
    // 25→22 的方锥台理论体积 h/3·(A1+A2+√(A1A2)) = 2212
    expect(measurements.measureVolume(body)).toBeCloseTo(2212, 6);
  });

  it("keeps the bevel solid when the top corner radius collapses to zero", () => {
    // 顶面圆角归零时两端剖面顶点数不同，修复前该实体体积仅约 760
    const body = createBaseBody(25, 25, 4, 1, 1.5);
    const [min, max] = measurements.measureBoundingBox(body);

    expect(max[0] - min[0]).toBeCloseTo(25, 5);
    expect(max[1] - min[1]).toBeCloseTo(25, 5);
    expect(max[2] - min[2]).toBeCloseTo(4, 5);
    expect(measurements.measureVolume(body)).toBeCloseTo(2210.816762, 4);
  });

  it("keeps the bevel volume unchanged when both ends stay rounded", () => {
    const body = createBaseBody(25, 25, 4, 4, 2);
    const [min, max] = measurements.measureBoundingBox(body);

    expect(max[0] - min[0]).toBeCloseTo(25, 5);
    expect(max[1] - min[1]).toBeCloseTo(25, 5);
    expect(max[2] - min[2]).toBeCloseTo(4, 5);
    expect(measurements.measureVolume(body)).toBeCloseTo(2088.533952, 4);
  });
});
