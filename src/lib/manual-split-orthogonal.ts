import {
  nearestSplitBoundary, ringEdges, SPLIT_EPSILON, splitDistance,
  type SplitPoint, type SplitRing,
} from "./manual-split-geometry";

export type SplitDirection = "auto" | "horizontal" | "vertical";

export function orthogonalFixedAxis(from: SplitPoint, pointer: SplitPoint, direction: SplitDirection): 0 | 1 {
  return direction === "horizontal" || (direction === "auto" &&
    Math.abs(pointer[0] - from[0]) >= Math.abs(pointer[1] - from[1])) ? 1 : 0;
}

/** 锁定一轴，沿着该方向与外边界相交，避免边界投影把线段拉斜。 */
export function projectOrthogonalPoint(
  from: SplitPoint, pointer: SplitPoint, outer: SplitRing, direction: SplitDirection, radius: number,
) {
  const axis = orthogonalFixedAxis(from, pointer, direction);
  const point: SplitPoint = [...pointer];
  point[axis] = from[axis];
  let distance = radius;
  let endpoint: SplitPoint | undefined;
  for (const [a, b] of ringEdges(outer)) {
    const delta = b[axis] - a[axis];
    if (delta === 0) continue;
    const t = (from[axis] - a[axis]) / delta;
    if (t < 0 || t > 1) continue;
    const at: SplitPoint = [...point];
    at[1 - axis] = a[1 - axis] + t * (b[1 - axis] - a[1 - axis]);
    const gap = splitDistance(at, pointer);
    if (gap <= distance && splitDistance(at, from) > SPLIT_EPSILON) {
      endpoint = at;
      distance = gap;
    }
  }
  return { point: endpoint ?? point, boundary: Boolean(endpoint) ||
    nearestSplitBoundary(point, outer).distance <= SPLIT_EPSILON };
}

export function appendOrthogonalPoint(path: SplitRing, point: SplitPoint): SplitRing {
  const before = path.at(-2);
  const last = path.at(-1);
  if (before && last && ([0, 1] as const).some((axis) =>
    before[axis] === last[axis] && last[axis] === point[axis] &&
    (last[1 - axis] - before[1 - axis]) * (point[1 - axis] - last[1 - axis]) > 0)) {
    return [...path.slice(0, -1), point];
  }
  return [...path, point];
}
