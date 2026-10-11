import { geometries } from "@jscad/modeling";
import { ELLIPSE_PROFILE_EXPONENT, RENDER_CONFIG } from "@/lib/config";
import type { ContouredFootprintPoint as Point, ContouredFootprintSlot } from "@/lib/contoured-footprint";

const MIN_ANGLE = 20 * Math.PI / 180;
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function centerHull(slots: readonly ContouredFootprintSlot[]) {
  const sorted = slots.map(slot => ({ x: slot.cx, y: slot.cy }))
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .filter((point, i, points) => i === 0 || point.x !== points[i - 1].x || point.y !== points[i - 1].y);
  if (sorted.length < 3) return sorted;
  const half = (points: Point[]) => {
    const hull: Point[] = [];
    for (const point of points) {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop();
      hull.push(point);
    }
    return hull.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

function slotSupport(slot: ContouredFootprintSlot, nx: number, ny: number) {
  const angle = slot.rotation * Math.PI / 180;
  const u = nx * Math.cos(angle) + ny * Math.sin(angle);
  const v = -nx * Math.sin(angle) + ny * Math.cos(angle);
  const a = slot.profile.width / 2 * Math.abs(u);
  const b = slot.profile.height / 2 * Math.abs(v);
  const p = slot.shape === "circle" ? 2 : slot.profile.profileExponent ?? ELLIPSE_PROFILE_EXPONENT;
  const m = Math.max(a, b);
  const q = p / (p - 1);
  let support = p <= 1 ? a + b : m === 0 ? 0
    : m * ((a / m) ** q + (b / m) ** q) ** (1 / q);
  // 零外扩建模使用标准椭圆，同时包住画布记录的超椭圆槽形。
  if (slot.profile.outerOffset === 0) support = Math.max(support, Math.hypot(a, b));
  return support + slot.profile.outerOffset;
}

/** 输入校验由共享轮廓构造入口负责，几何只在局部坐标计算以减少平移误差。 */
export function createPolygonalFootprint(slots: readonly ContouredFootprintSlot[], margin: number, cornerRadius = 0) {
  const radius = Math.min(cornerRadius, margin);
  const minX = Math.min(...slots.map(slot => slot.cx));
  const maxX = Math.max(...slots.map(slot => slot.cx));
  const minY = Math.min(...slots.map(slot => slot.cy));
  const maxY = Math.max(...slots.map(slot => slot.cy));
  const origin = { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
  const scale = Math.max(1, maxX - minX, maxY - minY, margin,
    ...slots.map(slot => Math.max(slot.profile.width, slot.profile.height) + slot.profile.outerOffset));
  const epsilon = scale * 1e-9;
  const hull = centerHull(slots);
  const area2 = hull.length < 3 ? 0 : hull.slice(1, -1)
    .reduce((sum, point, i) => sum + cross(hull[0], point, hull[i + 2]), 0);
  const nearCollinear = area2 <= Math.max((maxX - minX) ** 2 + (maxY - minY) ** 2, 1e-12) * 1e-6;
  const angles = nearCollinear ? [-Math.PI, -Math.PI / 2, 0, Math.PI / 2]
    : hull.map((point, i) => {
      const next = hull[(i + 1) % hull.length];
      return Math.atan2(-(next.x - point.x), next.y - point.y);
    }).sort((a, b) => a - b);
  const protectedAngles = angles.flatMap((angle, i) => {
    const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + Math.PI * 2;
    return next - angle > Math.PI - MIN_ANGLE ? [angle, (angle + next) / 2] : [angle];
  });
  const planes = protectedAngles.map(angle => {
    const nx = Math.cos(angle), ny = Math.sin(angle);
    const d = Math.max(...slots.map(slot => nx * (slot.cx - origin.x) + ny * (slot.cy - origin.y)
      + slotSupport(slot, nx, ny))) + margin - radius + epsilon;
    return { nx, ny, d };
  });
  // 法线间隔最多 160°，此包围框足以包含所有半平面交点。
  const reach = Math.max(...planes.map(plane => Math.abs(plane.d))) / Math.sin(MIN_ANGLE / 2) + scale;
  let points: Point[] = [{ x: -reach, y: -reach }, { x: reach, y: -reach },
    { x: reach, y: reach }, { x: -reach, y: reach }];
  for (const { nx, ny, d } of planes) {
    const clipped: Point[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const da = nx * a.x + ny * a.y - d, db = nx * b.x + ny * b.y - d;
      if (da <= 0) clipped.push(a);
      if ((da <= 0) !== (db <= 0)) {
        const t = da / (da - db);
        clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    points = clipped;
  }
  points = points.filter((point, i, ring) => {
    const previous = ring[(i + ring.length - 1) % ring.length];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > epsilon;
  });
  points = points.filter((point, i, ring) => {
    const a = ring[(i + ring.length - 1) % ring.length], b = ring[(i + 1) % ring.length];
    return Math.abs(cross(a, point, b)) > 1e-10 * Math.hypot(point.x - a.x, point.y - a.y)
      * Math.hypot(b.x - point.x, b.y - point.y);
  });
  if (points.length < 3 || points.some((point, i) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return true;
    const a = points[(i + points.length - 1) % points.length], b = points[(i + 1) % points.length];
    const cosine = ((a.x - point.x) * (b.x - point.x) + (a.y - point.y) * (b.y - point.y))
      / (Math.hypot(a.x - point.x, a.y - point.y) * Math.hypot(b.x - point.x, b.y - point.y));
    return cosine > Math.cos(MIN_ANGLE - 1e-7);
  })) throw new Error("直边包络生成了退化轮廓或无效尖角");

  const sideCount = points.length;
  const cornerMarkers = points.map(point => ({ x: point.x + origin.x, y: point.y + origin.y }));
  if (radius > 0) {
    // 安全内核向外加圆，切线交点使离散圆弧只向外偏差，不侵蚀凹槽边距。
    points = points.flatMap((point, i, ring) => {
      const previous = ring[(i + ring.length - 1) % ring.length], next = ring[(i + 1) % ring.length];
      const start = Math.atan2(-(point.x - previous.x), point.y - previous.y);
      const end = Math.atan2(-(next.x - point.x), next.y - point.y);
      const sweep = (end - start + Math.PI * 2) % (Math.PI * 2);
      const middle = start + sweep / 2;
      cornerMarkers[i] = {
        x: point.x + radius * Math.cos(middle) + origin.x,
        y: point.y + radius * Math.sin(middle) + origin.y,
      };
      const segments = Math.max(1, Math.ceil(sweep * RENDER_CONFIG.cylinderSegments / (Math.PI * 2)));
      const step = sweep / segments;
      const distance = radius / Math.cos(step / 2);
      return Array.from({ length: segments }, (_, j) => {
        const angle = start + (j + 0.5) * step;
        return { x: point.x + distance * Math.cos(angle), y: point.y + distance * Math.sin(angle) };
      });
    });
  }
  const boundaryPlanes = points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    const length = Math.hypot(next.x - point.x, next.y - point.y);
    const nx = (next.y - point.y) / length, ny = -(next.x - point.x) / length;
    return { nx, ny, d: nx * point.x + ny * point.y };
  });
  return {
    sideCount,
    cornerMarkers,
    geometry: geometries.geom2.fromPoints(points.map(point => [point.x + origin.x, point.y + origin.y])),
    containsExpandedCircle: (x: number, y: number, radius: number) =>
      Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(radius) && radius >= 0
      && boundaryPlanes.every(({ nx, ny, d }) => nx * (x - origin.x) + ny * (y - origin.y) + radius <= d + epsilon * 0.01),
  };
}
