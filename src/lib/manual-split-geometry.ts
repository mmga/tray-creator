export type SplitPoint = [number, number];
export type SplitRing = SplitPoint[];

export interface SplitRegion {
  outer: SplitRing;
  holes: SplitRing[];
}

export const SPLIT_EPSILON = 0.0001;

export function splitDistance(a: SplitPoint, b: SplitPoint) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function cross(a: SplitPoint, b: SplitPoint, p: SplitPoint) {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

export function ringEdges(ring: SplitRing): [SplitPoint, SplitPoint][] {
  return ring.map((point, i) => [point, ring[(i + 1) % ring.length]]);
}

export function splitRingArea(ring: SplitRing) {
  return ringEdges(ring).reduce((area, [a, b]) => area + a[0] * b[1] - b[0] * a[1], 0) / 2;
}

export function projectSplitPoint(point: SplitPoint, a: SplitPoint, b: SplitPoint): SplitPoint {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return a;
  const t = Math.min(1, Math.max(0, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
  return [a[0] + t * dx, a[1] + t * dy];
}

export function nearestSplitBoundary(point: SplitPoint, ring: SplitRing) {
  return ringEdges(ring).reduce<{ point: SplitPoint; edge: number; distance: number }>(
    (nearest, [a, b], edge) => {
      const projected = projectSplitPoint(point, a, b);
      const distance = splitDistance(projected, point);
      return distance < nearest.distance ? { point: projected, edge, distance } : nearest;
    },
    { point, edge: -1, distance: Infinity },
  );
}

export function pointInSplitRing([x, y]: SplitPoint, ring: SplitRing) {
  let inside = false;
  for (const [[ax, ay], [bx, by]] of ringEdges(ring)) {
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) {
      inside = !inside;
    }
  }
  return inside;
}

export function splitBounds(ring: SplitRing) {
  const min: SplitPoint = [Infinity, Infinity];
  const max: SplitPoint = [-Infinity, -Infinity];
  for (const [x, y] of ring) {
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
  }
  return { min, max };
}

function pointOnSegment(point: SplitPoint, a: SplitPoint, b: SplitPoint) {
  if (point[0] < Math.min(a[0], b[0]) - SPLIT_EPSILON ||
      point[0] > Math.max(a[0], b[0]) + SPLIT_EPSILON ||
      point[1] < Math.min(a[1], b[1]) - SPLIT_EPSILON ||
      point[1] > Math.max(a[1], b[1]) + SPLIT_EPSILON) return false;
  return splitDistance(point, projectSplitPoint(point, a, b)) <= SPLIT_EPSILON;
}

function properIntersection(a: SplitPoint, b: SplitPoint, c: SplitPoint, d: SplitPoint) {
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

function sharesPoint(a: SplitPoint, b: SplitPoint) {
  return splitDistance(a, b) <= SPLIT_EPSILON;
}

function intersects(a: SplitPoint, b: SplitPoint, c: SplitPoint, d: SplitPoint) {
  return properIntersection(a, b, c, d) || pointOnSegment(a, c, d) ||
    pointOnSegment(b, c, d) || pointOnSegment(c, a, b) || pointOnSegment(d, a, b);
}

export function splitSegmentAvoidsRing(a: SplitPoint, b: SplitPoint, ring: SplitRing) {
  for (let i = 0; i < ring.length; i++) {
    if (intersects(a, b, ring[i], ring[(i + 1) % ring.length])) return false;
  }
  return !pointInSplitRing(a, ring);
}

export function splitSegmentClear(a: SplitPoint, b: SplitPoint, region: SplitRegion, obstacles: SplitRing[]) {
  if (sharesPoint(a, b)) return false;
  const middle: SplitPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (!pointInSplitRing(middle, region.outer) || pointOnRing(middle, region.outer)) return false;
  for (const [c, d] of ringEdges(region.outer)) {
    if ((properIntersection(a, b, c, d) && !pointOnSegment(a, c, d) && !pointOnSegment(b, c, d)) ||
        (pointOnSegment(c, a, b) && !sharesPoint(c, a) && !sharesPoint(c, b)) ||
        (pointOnSegment(d, a, b) && !sharesPoint(d, a) && !sharesPoint(d, b)) ||
        (pointOnSegment(a, c, d) && pointOnSegment(b, c, d))) return false;
  }
  return region.holes.every((ring) => splitSegmentAvoidsRing(a, b, ring)) &&
    obstacles.every((ring) => splitSegmentAvoidsRing(a, b, ring));
}

function pointOnRing(point: SplitPoint, ring: SplitRing) {
  return nearestSplitBoundary(point, ring).distance <= SPLIT_EPSILON;
}

/** 切线与原边界的两段分别闭合，共享同一组切线坐标。 */
export function cutSplitRegion(region: SplitRegion, path: SplitRing, obstacles: SplitRing[]) {
  if (path.length < 2 || path.some((point) => !point.every(Number.isFinite))) return null;
  const outer = region.outer;
  const start = nearestSplitBoundary(path[0], outer);
  const end = nearestSplitBoundary(path[path.length - 1], outer);
  if (start.distance > SPLIT_EPSILON || end.distance > SPLIT_EPSILON ||
      sharesPoint(start.point, end.point)) return null;
  const points = [start.point, ...path.slice(1, -1), end.point];
  if (points.slice(1, -1).some((point) => pointOnRing(point, outer))) return null;
  for (let i = 1; i < points.length; i++) {
    if (!splitSegmentClear(points[i - 1], points[i], region, obstacles)) return null;
    if (i >= 2 && (pointOnSegment(points[i], points[i - 2], points[i - 1]) ||
        pointOnSegment(points[i - 2], points[i - 1], points[i]))) return null;
    for (let j = 1; j < i - 1; j++) {
      if (intersects(points[i - 1], points[i], points[j - 1], points[j])) return null;
    }
  }
  function arc(from: typeof start, to: typeof end) {
    const vertices = [from.point];
    const wraps = from.edge !== to.edge ||
      splitDistance(outer[from.edge], from.point) > splitDistance(outer[to.edge], to.point);
    if (wraps) {
      let edge = from.edge;
      do {
        edge = (edge + 1) % outer.length;
        const vertex = outer[edge];
        if (!sharesPoint(vertices[vertices.length - 1], vertex) && !sharesPoint(vertex, to.point)) {
          vertices.push(vertex);
        }
      } while (edge !== to.edge);
    }
    return vertices;
  }
  const forward = [...arc(start, end), ...points.slice(1).reverse()];
  const backward = [...arc(end, start), ...points.slice(0, -1)];
  if ([forward, backward].some((ring) => ring.length < 3 || splitRingArea(ring) <= SPLIT_EPSILON)) return null;
  return {
    path: points,
    children: [forward, backward].map((ring): SplitRegion => ({
      outer: ring,
      holes: region.holes.filter((hole) => pointInSplitRing(hole[0], ring)),
    })) as [SplitRegion, SplitRegion],
  };
}
