import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import {
  constructContouredFootprints,
  type ContouredFootprintPlan,
  type ContouredFootprintSlot,
} from "@/lib/contoured-footprint";

const { measureArea } = measurements;

function makeCircleSlot(
  id: string,
  cx: number,
  cy: number,
  diameter: number,
): ContouredFootprintSlot {
  return {
    id,
    cx,
    cy,
    rotation: 0,
    shape: "circle",
    profile: {
      width: diameter,
      height: diameter,
      outerOffset: 0,
    },
  };
}

function makeEllipseSlot(
  id: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
): ContouredFootprintSlot {
  return {
    id,
    cx,
    cy,
    rotation: 30,
    shape: "ellipse",
    profile: {
      width,
      height,
      outerOffset: 1,
      profileExponent: 2,
    },
  };
}

function plan(
  requests: ContouredFootprintPlan["requests"],
): ContouredFootprintPlan {
  return { requests };
}

function request(
  key: string,
  slots: readonly ContouredFootprintSlot[],
) {
  return {
    key,
    slots,
    slotSpacing: 5,
    boundarySpacing: 5,
    smoothingRadius: 60,
    disconnectDistance: 0,
  };
}

function unwrap(
  outcome: ReturnType<typeof constructContouredFootprints>,
) {
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.value;
}

describe("Contoured Footprint Construction", () => {
  it("一次按请求顺序派生 custom 与多个 stepped 高度带", () => {
    const result = unwrap(constructContouredFootprints(plan([
      request("custom-baseplate", [makeCircleSlot("a", 0, 0, 25)]),
      request("stepped-group:low", [
        makeCircleSlot("a", 0, 0, 25),
        makeCircleSlot("b", 200, 200, 25),
      ]),
      request("stepped-group:high", [makeEllipseSlot("e", 40, 20, 50, 25)]),
    ])));

    expect(result.footprints.map((item) => item.key)).toEqual([
      "custom-baseplate",
      "stepped-group:low",
      "stepped-group:high",
    ]);
    expect(result.footprints.map((item) => item.bodyCount)).toEqual([1, 2, 1]);
  });

  it("从权威 Geom2 派生 bounds、面积、完整轮廓与 Contour Body Count", () => {
    const footprint = unwrap(constructContouredFootprints(plan([
      request("custom-baseplate", [makeEllipseSlot("e", 30, 40, 50, 25)]),
    ]))).footprints[0];

    expect(footprint.bodyCount).toBe(footprint.bodies.length);
    expect(footprint.bounds).toEqual(expect.objectContaining({
      minX: expect.any(Number),
      maxX: expect.any(Number),
      minY: expect.any(Number),
      maxY: expect.any(Number),
    }));
    expect(footprint.area).toBeCloseTo(
      footprint.bodies.reduce(
        (sum, body) => sum + Math.abs(measureArea(body.geometry)),
        0,
      ),
      5,
    );
    expect(footprint.bodies[0].outlines.length).toBeGreaterThan(0);
    expect(footprint.bodies[0].outlines[0].length).toBeGreaterThan(2);
  });

  it("空请求成功返回零实体，多个有效实体不构成错误", () => {
    const result = unwrap(constructContouredFootprints(plan([
      request("empty", []),
      {
        ...request("multi", [
          makeCircleSlot("a", 0, 0, 25),
          makeCircleSlot("b", 200, 200, 25),
        ]),
        smoothingRadius: 0,
      },
    ])));

    expect(result.footprints[0]).toMatchObject({
      bodyCount: 0,
      bounds: null,
      area: 0,
    });
    expect(result.footprints[1].bodyCount).toBe(2);
  });

  it("相同 Slot Geometry Snapshots 与参数产生语义等价结果", () => {
    const slots = [
      makeCircleSlot("a", 0, 0, 25),
      makeEllipseSlot("b", 35, 0, 40, 25),
    ];
    const result = unwrap(constructContouredFootprints(plan([
      request("custom", slots),
      request("stepped", slots),
    ])));

    expect(result.footprints[0].bodyCount).toBe(result.footprints[1].bodyCount);
    expect(result.footprints[0].bounds).toEqual(result.footprints[1].bounds);
    expect(result.footprints[0].area).toBeCloseTo(result.footprints[1].area, 8);
  });

  it("底孔包含判断消费同一权威结果", () => {
    const footprint = unwrap(constructContouredFootprints(plan([
      request("custom", [makeCircleSlot("a", 50, 50, 25)]),
    ]))).footprints[0];

    expect(footprint.containsExpandedCircle(50, 50, 8)).toBe(true);
    expect(footprint.containsExpandedCircle(0, 0, 8)).toBe(false);
  });

  it("重复请求 key 原子失败且返回稳定错误码", () => {
    const outcome = constructContouredFootprints(plan([
      request("same", [makeCircleSlot("a", 0, 0, 25)]),
      request("same", [makeCircleSlot("b", 20, 0, 25)]),
    ]));

    expect(outcome).toMatchObject({
      ok: false,
      error: { code: "duplicate-request-key" },
    });
  });

  it("无效 Slot Geometry Snapshot 在构造前阻止整个计划", () => {
    const invalid = makeCircleSlot("invalid", Number.NaN, 0, 25);
    const outcome = constructContouredFootprints(plan([
      request("valid", [makeCircleSlot("a", 0, 0, 25)]),
      request("invalid", [invalid]),
    ]));

    expect(outcome).toMatchObject({
      ok: false,
      error: {
        code: "invalid-slot-geometry-snapshot",
        requestKey: "invalid",
      },
    });
  });
});
