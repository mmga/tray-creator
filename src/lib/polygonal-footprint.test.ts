import { describe, expect, it } from "vitest";
import { geometries } from "@jscad/modeling";
import { constructContouredFootprints, type ContouredFootprintSlot } from "@/lib/contoured-footprint";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import { createOffsetSlotShape } from "@/lib/model-utils";

function circle(id: string, cx: number, cy: number, radius = 5): ContouredFootprintSlot {
  return { id, cx, cy, rotation: 0, shape: "circle",
    profile: { width: radius * 2, height: radius * 2, outerOffset: 0 } };
}

function build(slots: ContouredFootprintSlot[], boundarySpacing = 2, cornerRadius = 0) {
  const result = constructContouredFootprints({ requests: [{
    key: "polygon", constructionStyle: "polygonal", slots, boundarySpacing, cornerRadius,
    slotSpacing: 5, smoothingRadius: 0, disconnectDistance: 0,
  }] });
  if (!result.ok) throw new Error(result.error.message);
  return result.value.footprints[0];
}

const triangle = [circle("a", 0, 0), circle("b", 60, 0), circle("c", 30, 50)];

describe("直边包络", () => {
  it("圆角保留主要直边、去掉尖角并安全包含完整边距", () => {
    const sharp = build(triangle);
    const rounded = build(triangle, 2, 1.5);
    const ring = rounded.bodies[0].outerOutline;
    expect(ring.length).toBeGreaterThan(30);
    expect(rounded.area).toBeLessThan(sharp.area);
    expect(ring.filter((point, i) => Math.hypot(point.x - ring[(i + 1) % ring.length].x,
      point.y - ring[(i + 1) % ring.length].y) > 40)).toHaveLength(3);
    for (const slot of triangle) expect(rounded.containsExpandedCircle(slot.cx, slot.cy, 7)).toBe(true);
    const corner = sharp.bodies[0].outerOutline[0];
    expect(rounded.containsExpandedCircle(corner.x, corner.y, 0)).toBe(false);
    expect(build(triangle, 2, 100).bodies[0].outerOutline).toEqual(build(triangle, 2, 2).bodies[0].outerOutline);
    expect(build(triangle, 0, 4).bodies[0].outerOutline).toEqual(build(triangle, 0, 0).bodies[0].outerOutline);
  });

  it("用户十槽配置的圆弧和直边均保住 5mm 边距，圆角区域按真实边界校验", () => {
    const slots = [[75.7,174.4,14.45],[111.9,174.4,14.45],[92.6,139,16.2],
      [130,139,16.2],[167.4,139,16.2],[130,69.8,20.2],[111.45,106.5,16.2],
      [148.85,106.5,16.2],[184.2,174.4,14.45],[148.2,174.4,14.45]]
      .map(([x,y,r], i) => circle(String(i),x,y,r));
    const result = build(slots, 5, 4);
    const ring = result.bodies[0].outerOutline;
    expect(result.bodyCount).toBe(1);
    expect(ring.length).toBeGreaterThan(30);
    for (const slot of slots) {
      expect(result.containsExpandedCircle(slot.cx, slot.cy, slot.profile.width / 2 + 5)).toBe(true);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const distance = ((b.x-a.x)*(slot.cy-a.y)-(b.y-a.y)*(slot.cx-a.x))/Math.hypot(b.x-a.x,b.y-a.y);
        expect(distance).toBeGreaterThanOrEqual(slot.profile.width / 2 + 5 - 1e-6);
      }
    }
    expect(build(slots.toReversed(),5,4).bodies[0].outerOutline).toEqual(ring);
  });

  it.each([-1, Infinity, NaN])("拒绝非法直边圆角半径 %s", cornerRadius => {
    const outcome = constructContouredFootprints({ requests: [{ key: "invalid-radius",
      constructionStyle: "polygonal", slots: triangle, cornerRadius,
      slotSpacing: 5, boundarySpacing: 2, smoothingRadius: 0, disconnectDistance: 0 }] });
    expect(outcome).toMatchObject({ ok: false, error: { code: "invalid-contour-parameters" } });
  });

  it("普通三角分布形成三条边，包含槽位与边距并正确校验斜边", () => {
    const result = build(triangle);
    expect(result.bodyCount).toBe(1);
    expect(result.bodies[0].outerOutline).toHaveLength(3);
    for (const slot of triangle) {
      expect(result.containsExpandedCircle(slot.cx, slot.cy, 7)).toBe(true);
      expect(result.containsExpandedCircle(slot.cx, slot.cy, 7.001)).toBe(false);
    }
    expect(result.containsExpandedCircle(NaN, 0, 1)).toBe(false);
    expect(result.containsExpandedCircle(0, 0, -1)).toBe(false);
  });

  it("四角及内部槽形成四边形，内部大槽仍决定边界", () => {
    const slots = [circle("a", 0, 0), circle("b", 40, 0),
      circle("c", 40, 40), circle("d", 0, 40), circle("inside", 20, 20, 30)];
    const result = build(slots);
    expect(result.bodies[0].outerOutline).toHaveLength(4);
    expect(result.bounds?.minX).toBeCloseTo(-12, 5);
    expect(result.containsExpandedCircle(20, 20, 32)).toBe(true);
  });

  it.each([[], [circle("a", 0, 0)], [circle("a", -30, -10), circle("b", 80, 20)],
    [circle("a", 0, 0), circle("b", 0, 0)],
    [circle("a", 0, 0), circle("b", 50, 0.00001), circle("c", 100, 0)]])(
    "空或退化布局返回空结果或安全矩形：%j", (...slots) => {
      const result = build(slots);
      expect(result.bodyCount).toBe(slots.length ? 1 : 0);
      if (slots.length) {
        expect(result.bodies[0].outerOutline).toHaveLength(4);
        for (const slot of slots) expect(result.containsExpandedCircle(slot.cx, slot.cy, 7)).toBe(true);
      }
    },
  );

  it("尖角增加截角边且不生成过长尖刺", () => {
    const result = build([circle("a", 0, 0), circle("b", 100, 0), circle("c", 2, 20)]);
    expect(result.bodies[0].outerOutline.length).toBeGreaterThanOrEqual(4);
    expect(result.bounds!.minX).toBeGreaterThan(-20);
    expect(result.bounds!.maxX).toBeLessThan(120);
    expect(result.bounds!.minY).toBeGreaterThan(-20);
    expect(result.bounds!.maxY).toBeLessThan(40);
  });

  it.each([0.5, 1, 1.5, 2, 3, 1.000001, 100])("旋转椭圆指数 %s 在零及正外扩下均安全包含二维与三维槽形", (p) => {
    for (const offset of [0, 1.2]) {
      const slot: ContouredFootprintSlot = { id: "ellipse", cx: 20, cy: 20,
        rotation: 37, shape: "ellipse", profile: { width: 60, height: 24,
          outerOffset: offset, profileExponent: p } };
      const result = build([...triangle, slot], 2, 1.5);
      const display = sampleSlotProfilePoints(60, 24, "ellipse", offset, 720, p);
      const model = geometries.geom2.toPoints(createOffsetSlotShape(60, 24, "ellipse", offset, p))
        .map(([x, y]) => ({ x, y }));
      const angle = slot.rotation * Math.PI / 180;
      for (const point of [...display, ...model]) {
        const x = slot.cx + point.x * Math.cos(angle) - point.y * Math.sin(angle);
        const y = slot.cy + point.x * Math.sin(angle) + point.y * Math.cos(angle);
        expect(result.containsExpandedCircle(x, y, 2)).toBe(true);
      }
    }
  });

  it("重排槽位及改 ID 不改变几何；远距离仍是一个实体", () => {
    const slots = triangle.map(slot => ({ ...slot, cx: slot.cx * 10, cy: slot.cy * 10 }));
    const first = build(slots);
    const second = build(slots.toReversed().map((slot, i) => ({ ...slot, id: String(i) })));
    expect(first.bodyCount).toBe(1);
    expect(second.bodies[0].outerOutline).toEqual(first.bodies[0].outerOutline);
    expect(second.bounds).toEqual(first.bounds);
  });

  it.each([0.001, 1000])("尺度 %s 下保持正面积和包含", scale => {
    const slots = triangle.map(slot => ({ ...slot, cx: slot.cx * scale, cy: slot.cy * scale,
      profile: { ...slot.profile, width: 10 * scale, height: 10 * scale } }));
    const result = build(slots, 2 * scale);
    expect(result.area).toBeGreaterThan(0);
    for (const slot of slots) expect(result.containsExpandedCircle(slot.cx, slot.cy, 7 * scale)).toBe(true);
  });
});
