import {
  nearestSplitBoundary, pointInSplitRing, ringEdges, splitBounds, splitDistance,
  type SplitPoint, type SplitRing,
} from "./manual-split-geometry";

export interface SplitSnap {
  point: SplitPoint;
  label: string;
}

export function splitRingCenter(ring: SplitRing): SplitPoint {
  const { min, max } = splitBounds(ring);
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
}

export function splitAxisIntersections(ring: SplitRing, axis: 0 | 1, value: number): SplitRing {
  return ringEdges(ring).flatMap(([a, b]): SplitPoint[] => {
    if ((a[axis] <= value) === (b[axis] <= value)) return [];
    const t = (value - a[axis]) / (b[axis] - a[axis]);
    return [[a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]];
  }).filter((point, i, all) => all.findIndex((p) => splitDistance(point, p) < 0.001) === i);
}

export function buildEndpointSnaps(
  ring: SplitRing, center: SplitPoint, start?: SplitPoint, symmetry = false,
): SplitSnap[] {
  const candidates = ringEdges(ring).flatMap(([a, b], i, edges): SplitSnap[] => {
    const length = splitDistance(a, b);
    const previous = edges[(i + edges.length - 1) % edges.length][0];
    const next = edges[(i + 1) % edges.length][1];
    if (length < 4 || (ring.length > 8 &&
        length < 2 * Math.min(splitDistance(previous, a), splitDistance(b, next)))) return [];
    return [{ point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], label: "边中点" }];
  });
  const axes = [0, 1] as const;
  for (const axis of axes) {
    candidates.push(...splitAxisIntersections(ring, axis, center[axis])
      .map((point) => ({ point, label: "中心线交点" })));
    if (!start) continue;
    candidates.push(...splitAxisIntersections(ring, axis, start[axis])
      .map((point) => ({ point, label: axis === 0 ? "垂直对齐" : "水平对齐" })));
    if (symmetry) {
      const mirror: SplitPoint = [...start];
      mirror[axis] = center[axis] * 2 - mirror[axis];
      candidates.unshift({
        point: mirror,
        label: nearestSplitBoundary(mirror, ring).distance <= 0.0001
          ? (axis === 0 ? "关于竖轴对称" : "关于横轴对称")
          : "镜像参考",
      });
    }
  }
  return candidates.filter(({ point }) => !start || splitDistance(start, point) > 0.001);
}

function facingPoint(ring: SplitRing, from: SplitPoint, to: SplitPoint) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  let best = Infinity;
  for (const [a, b] of ringEdges(ring)) {
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const det = dx * ey - dy * ex;
    if (Math.abs(det) < 1e-8) continue;
    const ax = a[0] - from[0];
    const ay = a[1] - from[1];
    const t = (ax * ey - ay * ex) / det;
    const u = (ax * dy - ay * dx) / det;
    if (t >= 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}

export function slotGapMidpoint(a: SplitRing, b: SplitRing): SplitPoint | null {
  const from = splitRingCenter(a);
  const to = splitRingCenter(b);
  const facingA = facingPoint(a, from, to);
  const facingB = facingPoint(b, to, from);
  if (facingA + facingB >= 1) return null;
  const ratio = (facingA + 1 - facingB) / 2;
  return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
}

export function nearestSlotGap(pointer: SplitPoint, grooves: SplitRing[], obstacles: SplitRing[]): SplitSnap | null {
  const near = grooves.map((groove) => ({ groove, distance: nearestSplitBoundary(pointer, groove).distance }))
    .sort((a, b) => a.distance - b.distance).slice(0, 4);
  let match: SplitSnap | null = null;
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      const point = slotGapMidpoint(near[i].groove, near[j].groove);
      if (point && !obstacles.some((ring) => pointInSplitRing(point, ring)) &&
          (!match || splitDistance(point, pointer) < splitDistance(match.point, pointer))) {
        match = { point, label: "槽间中点" };
      }
    }
  }
  return match;
}

/** 用屏幕距离排序，缩放前后都保持同样的捕捉范围。 */
export function chooseSplitSnap(pointer: SplitPoint, candidates: SplitSnap[], unitsPerPixel: number, previous?: SplitSnap) {
  if (previous && splitDistance(pointer, previous.point) <= unitsPerPixel * 13 &&
      candidates.some(({ point, label }) => label === previous.label && splitDistance(point, previous.point) < 0.001)) {
    return previous;
  }
  return candidates
    .map((snap) => ({ snap, distance: splitDistance(pointer, snap.point) }))
    .filter(({ distance }) => distance <= unitsPerPixel * 9)
    .sort((a, b) => a.distance - b.distance)[0]?.snap;
}

export function gridSplitGuides(obstacles: SplitRing[], axis: 0 | 1) {
  const intervals = obstacles.map((ring) => splitBounds(ring))
    .map(({ min, max }) => [min[axis], max[axis]])
    .sort((a, b) => a[0] - b[0]);
  const positions: number[] = [];
  let end = intervals[0]?.[1] ?? Infinity;
  for (const [low, high] of intervals.slice(1)) {
    if (low - end > 0.001) positions.push((low + end) / 2);
    end = Math.max(end, high);
  }
  return positions;
}
