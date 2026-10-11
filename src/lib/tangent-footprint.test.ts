import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import { constructContouredFootprints, type ContouredFootprintSlot } from "@/lib/contoured-footprint";
import { slotSupport } from "@/lib/polygonal-footprint";

function circle(cx: number, cy: number, radius = 5): ContouredFootprintSlot {
  return { id: `${cx}-${cy}-${radius}`, cx, cy, shape: "circle", rotation: 0,
    profile: { width: radius * 2, height: radius * 2, outerOffset: 0 } };
}
function build(slots: ContouredFootprintSlot[], margin = 5) {
  const outcome = constructContouredFootprints({ requests: [{ key: "tangent", constructionStyle: "polygonal",
    polygonCornerStyle: "tangent", slots, slotSpacing: 5, boundarySpacing: margin, smoothingRadius: 0, disconnectDistance: 0 }] });
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.value.footprints[0];
}
function checkSafety(slots: ContouredFootprintSlot[], margin: number, result: ReturnType<typeof build>) {
  const ring = result.bodies[0].outerOutline;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y), nx = (b.y - a.y) / length, ny = -(b.x - a.x) / length;
    for (const slot of slots) {
      expect(nx * (a.x - slot.cx) + ny * (a.y - slot.cy) - slotSupport(slot, nx, ny)).toBeGreaterThanOrEqual(margin - 1e-5);
    }
  }
}

describe("凹槽相切包络", () => {
  it("等径三角布局的直边为公切线，转角沿凹槽加边距且不额外膨胀", () => {
    const slots = [circle(0, 0), circle(60, 0), circle(30, 50)];
    const result = build(slots, 2), ring = result.bodies[0].outerOutline;
    expect(result.polygonSideCount).toBe(3);
    expect(result.polygonCornerMarkers).toHaveLength(3);
    expect(ring.filter((a, i) => Math.hypot(a.x - ring[(i + 1) % ring.length].x, a.y - ring[(i + 1) % ring.length].y) > 40)).toHaveLength(3);
    for (const marker of result.polygonCornerMarkers!) {
      expect(Math.min(...slots.map(slot => Math.hypot(marker.x - slot.cx, marker.y - slot.cy)))).toBeCloseTo(7, 5);
    }
    expect(result.bounds).toMatchObject({ minX: expect.closeTo(-7, 5), maxX: expect.closeTo(67, 5),
      minY: expect.closeTo(-7, 5), maxY: expect.closeTo(57, 5) });
    const idealArea = 1500 + (60 + 2 * Math.hypot(30, 50)) * 7 + Math.PI * 49;
    expect(Math.abs(result.area / idealArea - 1)).toBeLessThan(0.001);
    checkSafety(slots, 2, result);
  });

  it("用户十槽配置保留五条真实公切线和五个转角标记，包括小角度转折", () => {
    const slots = [[75.7,174.4,14.45],[111.9,174.4,14.45],[92.6,139,16.2],
      [130,139,16.2],[167.4,139,16.2],[130,69.8,20.2],[111.45,106.5,16.2],
      [148.85,106.5,16.2],[184.2,174.4,14.45],[148.2,174.4,14.45]]
      .map(([x,y,r]) => circle(x,y,r));
    const result = build(slots);
    expect(result.polygonSideCount).toBe(5);
    expect(result.polygonCornerMarkers).toHaveLength(5);
    const ring = result.bodies[0].outerOutline;
    let tangentCount = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const length = Math.hypot(b.x-a.x,b.y-a.y), nx = (b.y-a.y)/length, ny = -(b.x-a.x)/length;
      const contacts = slots.filter(slot => Math.abs(nx*(a.x-slot.cx)+ny*(a.y-slot.cy)-slot.profile.width/2-5)<1e-5);
      if (contacts.length >= 2) tangentCount++;
    }
    expect(tangentCount).toBe(5);
    checkSafety(slots, 5, result);
    expect(build(slots.toReversed()).bodies[0].outerOutline).toEqual(ring);
  });

  it("单圆及被大圆完全包住时没有虚构直边，双圆形成两条公切线", () => {
    for (const slots of [[circle(0,0,20)], [circle(0,0,20),circle(2,1,3)], [circle(0,0,20),circle(0,0,20)]]) {
      const result = build(slots.map((slot,i)=>({...slot,id:String(i)})));
      expect(result.polygonSideCount).toBe(0);
      expect(result.polygonCornerMarkers).toHaveLength(0);
      expect(result.bounds!.maxX - result.bounds!.minX).toBeCloseTo(50, 5);
    }
    const capsule = build([circle(0,0),circle(60,0)]);
    expect(capsule.polygonSideCount).toBe(2);
    expect(capsule.polygonCornerMarkers).toHaveLength(2);
    expect(build([]).polygonSideCount).toBe(0);
  });

  it.each([0.5, 1, 1.5, 2, 3, 100])("旋转椭圆指数 %s 与圆槽混合时安全包含完整边距", p => {
    const slots: ContouredFootprintSlot[] = [circle(-50,0), circle(50,0,8),
      { id: "ellipse", cx: 0, cy: 40, shape: "ellipse", rotation: 37,
        profile: { width: 60, height: 24, profileExponent: p, outerOffset: 0 } }];
    for (const margin of [0, 5]) {
      const result = build(slots, margin);
      expect(result.area).toBeGreaterThan(0);
      checkSafety(slots, margin, result);
      expect(measurements.measureArea(result.bodies[0].geometry)).toBeGreaterThan(0);
    }
  });

  it("指数不大于 1 时安全矩形自身的真实直边仍计数", () => {
    const slot: ContouredFootprintSlot = { id: "rectangle-profile", cx: 0, cy: 0, shape: "ellipse", rotation: 37,
      profile: { width: 60, height: 24, profileExponent: 1, outerOffset: 0 } };
    const result = build([slot]);
    expect(result.polygonSideCount).toBe(4);
    expect(result.polygonCornerMarkers).toHaveLength(4);
    checkSafety([slot], 5, result);
  });
});
