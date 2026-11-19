import {
  cutSplitRegion, pointInSplitRing, projectSplitPoint, splitBounds, splitDistance,
  splitRingArea, splitSegmentAvoidsRing, splitSegmentClear,
  type SplitPoint, type SplitRegion, type SplitRing,
} from "./manual-split-geometry";

const ROUTE_GAP = 0.06;
const MAX_GUIDES_PER_RING = 24;

function unit(x: number, y: number): SplitPoint {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

/** 用外侧支撑线的交点构造绕行顶点，稀疏化后边仍在保护区外。 */
function obstacleGuides(ring: SplitRing) {
  const ordered = splitRingArea(ring) < 0 ? ring.slice().reverse() : ring;
  const count = Math.min(ordered.length, MAX_GUIDES_PER_RING);
  const lines = Array.from({ length: count }, (_, index) => {
    const i = Math.floor(index * ordered.length / count);
    const a = ordered[i];
    const b = ordered[(i + 1) % ordered.length];
    const n = unit(b[1] - a[1], a[0] - b[0]);
    return { n, offset: n[0] * a[0] + n[1] * a[1] + ROUTE_GAP };
  });
  return lines.flatMap(({ n: [a, b], offset: c }, i): SplitPoint[] => {
    const { n: [d, e], offset: f } = lines[(i + 1) % count];
    const det = a * e - b * d;
    return det > 0.00001 ? [[(c * e - b * f) / det, (a * f - c * d) / det]] : [];
  });
}

function concaveBoundaryGuides(ring: SplitRing): SplitRing {
  return ring.flatMap((p, i): SplitPoint[] => {
    const a = ring[(i + ring.length - 1) % ring.length];
    const b = ring[(i + 1) % ring.length];
    const [ax, ay] = unit(p[0] - a[0], p[1] - a[1]);
    const [bx, by] = unit(b[0] - p[0], b[1] - p[1]);
    if (ax * by - ay * bx >= -0.00001) return [];
    const [nx, ny] = unit(-ay - by, ax + bx);
    return [[p[0] + nx * ROUTE_GAP, p[1] + ny * ROUTE_GAP]];
  });
}

export interface ManualSplitRoute extends NonNullable<ReturnType<typeof cutSplitRegion>> {
  length: number;
}

export function planManualSplitRoutes(
  region: SplitRegion, obstacles: SplitRing[], start: SplitPoint, end: SplitPoint, via?: SplitPoint,
): ManualSplitRoute[] {
  const nodes: SplitRing = via ? [start, via, end] : [start, end];
  const direct = cutSplitRegion(region, nodes, obstacles);
  if (direct) return [{ ...direct, length: pathLength(direct.path) }];
  if (splitDistance(start, end) < ROUTE_GAP) return [];
  if (via && (!pointInSplitRing(via, region.outer) ||
    [...obstacles, ...region.holes].some((ring) => pointInSplitRing(via, ring)))) return [];

  const barriers = [...obstacles, ...region.holes].map((ring) => ({ ring, ...splitBounds(ring) }));
  function clear(a: SplitPoint, b: SplitPoint) {
    if (!splitSegmentClear(a, b, { outer: region.outer, holes: [] }, [])) return false;
    const { min, max } = splitBounds([a, b]);
    return barriers.every(({ ring, min: low, max: high }) =>
      max[0] < low[0] || max[1] < low[1] || min[0] > high[0] || min[1] > high[1] ||
      splitSegmentAvoidsRing(a, b, ring),
    );
  }
  const fromReference = (p: SplitPoint) =>
    Math.min(...nodes.slice(1).map((b, i) => splitDistance(p, projectSplitPoint(p, nodes[i], b))));
  const ranked = barriers.map(({ ring, min, max }) => {
    const center: SplitPoint = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
    const radius = splitDistance(min, max) / 2;
    const blocks = nodes.slice(1).some((b, i) => !splitSegmentAvoidsRing(nodes[i], b, ring));
    return { ring, center, distance: fromReference(center) - radius, blocks };
  }).sort((a, b) => Number(b.blocks) - Number(a.blocks) || a.distance - b.distance);
  // shortcut: 仅搜索参考线附近的绕行顶点；更远的通道由用户增加途经点引导。
  const guidesByBarrier = ranked.slice(0, 16).map(({ ring }) => obstacleGuides(ring));
  const guides = [...guidesByBarrier.flat(), ...concaveBoundaryGuides(region.outer)
    .sort((a, b) => fromReference(a) - fromReference(b)).slice(0, 48)]
    .filter((p) => pointInSplitRing(p, region.outer) && !barriers.some(({ ring }) => pointInSplitRing(p, ring)));
  const edges = new Map<SplitPoint, Map<SplitPoint, boolean>>();
  function link(a: SplitPoint, b: SplitPoint) {
    const known = edges.get(a)?.get(b) ?? edges.get(b)?.get(a);
    if (known !== undefined) return known;
    const pass = clear(a, b);
    if (!edges.has(a)) edges.set(a, new Map());
    edges.get(a)!.set(b, pass);
    return pass;
  }
  function route(from: SplitPoint, to: SplitPoint): SplitRing {
    if (link(from, to)) return [from, to];
    const points = [from, to, ...guides.filter((p) => p !== from && p !== to)];
    const cost = points.map(() => Infinity);
    const parent = points.map(() => -1);
    const visited = new Set<number>();
    cost[0] = 0;
    for (;;) {
      let next = -1;
      let best = Infinity;
      for (let i = 0; i < points.length; i++) {
        const estimate = cost[i] + splitDistance(points[i], to);
        if (!visited.has(i) && estimate < best) {
          next = i;
          best = estimate;
        }
      }
      if (next === -1) return [];
      if (next === 1) {
        const path: SplitRing = [];
        for (let i = 1; i !== -1; i = parent[i]) path.push(points[i]);
        return path.reverse();
      }
      visited.add(next);
      for (let i = 1; i < points.length; i++) {
        const candidate = cost[next] + splitDistance(points[next], points[i]);
        if (!visited.has(i) && candidate < cost[i] && link(points[next], points[i])) {
          cost[i] = candidate;
          parent[i] = next;
        }
      }
    }
  }

  const options: SplitRing[] = [nodes];
  const blocked = ranked.findIndex((item) => item.blocks);
  if (blocked >= 0) {
    const chord = nodes.slice(1).findIndex((b, i) =>
      !splitSegmentAvoidsRing(nodes[i], b, ranked[blocked].ring),
    );
    const a = nodes[chord];
    const b = nodes[chord + 1];
    const side = ([x, y]: SplitPoint) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    for (const sign of [-1, 1]) {
      const anchor = guidesByBarrier[blocked].filter((p) => guides.includes(p))
        .sort((p, q) => sign * (side(q) - side(p)))[0];
      if (anchor) options.push([...nodes.slice(0, chord + 1), anchor, ...nodes.slice(chord + 1)]);
    }
  }
  const distinct = new Map<string, ManualSplitRoute>();
  for (const waypoints of options) {
    let path = [waypoints[0]];
    for (let i = 1; i < waypoints.length && path.length; i++) {
      const segment = route(waypoints[i - 1], waypoints[i]);
      path = segment.length ? [...path, ...segment.slice(1)] : [];
    }
    const result = cutSplitRegion(region, path, obstacles);
    if (!result) continue;
    const key = ranked.length
      ? ranked.map(({ ring }) => Number(pointInSplitRing(ring[0], result.children[0].outer))).join("")
      : "free";
    const length = pathLength(result.path);
    if ((distinct.get(key)?.length ?? Infinity) > length) distinct.set(key, { ...result, length });
  }
  return [...distinct.values()].sort((a, b) => a.length - b.length);
}

function pathLength(path: SplitRing) {
  return path.slice(1).reduce((length, point, i) => length + splitDistance(path[i], point), 0);
}
