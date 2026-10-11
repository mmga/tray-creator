import { geometries } from "@jscad/modeling";
import { slotSupport } from "@/lib/polygonal-footprint";
import { ELLIPSE_PROFILE_EXPONENT } from "@/lib/config";
import type { ContouredFootprintSlot } from "@/lib/contoured-footprint";

const TAU = Math.PI * 2;
const SEGMENTS = 128;
const normalizeAngle = (angle: number) => (angle % TAU + TAU) % TAU;

/** 安全槽形的凸包：直边取外公切线，曲线用外切线交点离散，保证边距不被侵蚀。 */
export function createTangentFootprint(input: readonly ContouredFootprintSlot[], margin: number) {
  const minX = Math.min(...input.map(slot => slot.cx)), maxX = Math.max(...input.map(slot => slot.cx));
  const minY = Math.min(...input.map(slot => slot.cy)), maxY = Math.max(...input.map(slot => slot.cy));
  const origin = { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
  const slots = input.map(slot => ({ ...slot, cx: slot.cx - origin.x, cy: slot.cy - origin.y }));
  const epsilon = Math.max(1, maxX - minX, maxY - minY, margin,
    ...slots.map(slot => Math.max(slot.profile.width, slot.profile.height) + slot.profile.outerOffset)) * 1e-9;
  const support = (slot: ContouredFootprintSlot, angle: number) =>
    slot.cx * Math.cos(angle) + slot.cy * Math.sin(angle)
      + slotSupport(slot, Math.cos(angle), Math.sin(angle)) + margin;
  const envelope = (angle: number) => Math.max(...slots.map(slot => support(slot, angle)));
  const derivative = (slot: ContouredFootprintSlot, angle: number) =>
    (support(slot, angle + 1e-5) - support(slot, angle - 1e-5)) / 2e-5;
  const sampleAngles = Array.from({ length: SEGMENTS + 1 }, (_, i) => i * TAU / SEGMENTS);
  const sampled = slots.map(slot => sampleAngles.map(angle => support(slot, angle)));
  const candidates: number[] = [];
  for (const slot of slots) {
    if (slot.shape !== "ellipse" || (slot.profile.profileExponent ?? ELLIPSE_PROFILE_EXPONENT) > 1) continue;
    for (let i = 0; i < 4; i++) {
      const angle = slot.rotation * Math.PI / 180 + i * Math.PI / 2;
      if (envelope(angle) <= support(slot, angle) + epsilon * 10) candidates.push(normalizeAngle(angle));
    }
  }
  const addTangent = (i: number, j: number, angle: number) => {
    const a = slots[i], b = slots[j], height = support(a, angle);
    if (envelope(angle) > height + epsilon * 10) return;
    // 接触点重合时没有真实直边，例如内切或完全重合的槽形。
    if (Math.abs(derivative(a, angle) - derivative(b, angle)) <= epsilon * 100) return;
    candidates.push(normalizeAngle(angle));
  };
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
    const a = slots[i], b = slots[j];
    if ([a, b].every(slot => slot.shape === "circle" && slot.profile.width === slot.profile.height)) {
      const dx = b.cx - a.cx, dy = b.cy - a.cy, distance = Math.hypot(dx, dy);
      const difference = a.profile.width / 2 + a.profile.outerOffset - b.profile.width / 2 - b.profile.outerOffset;
      if (distance <= Math.abs(difference) + epsilon) continue;
      const base = Math.atan2(dy, dx), offset = Math.acos(difference / distance);
      addTangent(i, j, base - offset);
      addTangent(i, j, base + offset);
      continue;
    }
    // shortcut: 椭圆按 128 个法线区间找根；需要识别更窄的可见弧段时改用自适应细分，安全包含不受影响。
    for (let k = 0; k < SEGMENTS; k++) {
      const leftValue = sampled[i][k] - sampled[j][k];
      const rightValue = sampled[i][k + 1] - sampled[j][k + 1];
      if (Math.abs(leftValue) <= epsilon) addTangent(i, j, sampleAngles[k]);
      if (leftValue * rightValue >= 0) continue;
      let left = sampleAngles[k], right = sampleAngles[k + 1];
      for (let iteration = 0; iteration < 40; iteration++) {
        const middle = (left + right) / 2;
        if ((support(a, middle) - support(b, middle)) * leftValue > 0) left = middle;
        else right = middle;
      }
      addTangent(i, j, (left + right) / 2);
    }
  }
  const uniqueAngles = (angles: number[]) => {
    const sorted = angles.sort((a, b) => a - b)
      .filter((angle, i, all) => i === 0 || angle - all[i - 1] > 1e-7);
    if (sorted.length > 1 && sorted[0] + TAU - sorted[sorted.length - 1] <= 1e-7) sorted.pop();
    return sorted;
  };
  const tangents = uniqueAngles(candidates);
  const angles = uniqueAngles([...tangents, ...sampleAngles.slice(0, -1)]);
  const planes = angles.map(angle => ({ nx: Math.cos(angle), ny: Math.sin(angle), d: envelope(angle) + epsilon }));
  const points = planes.map((a, i) => {
    const b = planes[(i + 1) % planes.length], determinant = a.nx * b.ny - a.ny * b.nx;
    return { x: (a.d * b.ny - a.ny * b.d) / determinant,
      y: (a.nx * b.d - a.d * b.nx) / determinant };
  }).filter((point, i, ring) => {
    const previous = ring[(i + ring.length - 1) % ring.length];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > epsilon;
  });
  if (points.length < 3 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error("相切包络生成了无效轮廓");
  }
  const cornerMarkers = tangents.map((angle, i) => {
    const next = i + 1 < tangents.length ? tangents[i + 1] : tangents[0] + TAU;
    const middle = (angle + next) / 2;
    const slot = slots.reduce((best, item) => support(item, middle) > support(best, middle) ? item : best);
    const height = support(slot, middle), slope = derivative(slot, middle);
    return { x: Math.cos(middle) * height - Math.sin(middle) * slope + origin.x,
      y: Math.sin(middle) * height + Math.cos(middle) * slope + origin.y };
  });
  return {
    sideCount: tangents.length,
    cornerMarkers,
    geometry: geometries.geom2.fromPoints(points.map(point => [point.x + origin.x, point.y + origin.y])),
    containsExpandedCircle: (x: number, y: number, radius: number) =>
      Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(radius) && radius >= 0
      && planes.every(({ nx, ny, d }) => nx * (x - origin.x) + ny * (y - origin.y) + radius <= d + epsilon * 0.01),
  };
}
