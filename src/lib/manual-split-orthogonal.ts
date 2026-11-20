import {
  nearestSplitBoundary, ringEdges, SPLIT_EPSILON, splitDistance,
  type SplitPoint, type SplitRing,
} from "./manual-split-geometry";

export type SplitDirection = "auto" | "horizontal" | "vertical";
export type SplitSymmetry = { kind: "left-right" | "top-bottom" | "rotate"; center: SplitPoint };

export function mirrorSplitPoint([x, y]: SplitPoint, { kind, center: [cx, cy] }: SplitSymmetry): SplitPoint {
  return [kind === "top-bottom" ? x : 2 * cx - x, kind === "left-right" ? y : 2 * cy - y];
}

export function isOrthogonalPath(path: SplitRing) {
  return path.slice(1).every(([x, y], i) => {
    const [a, b] = path[i];
    return (Math.abs(x - a) <= SPLIT_EPSILON) !== (Math.abs(y - b) <= SPLIT_EPSILON);
  });
}

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

export function splitSegmentAxis(path: SplitRing, index: number): 0 | 1 {
  return path[index][0] === path[index + 1][0] ? 0 : 1;
}

/** 平移线段只改其法向坐标；首尾沿相同方向重新求边界交点。 */
export function moveOrthogonalSegment(path: SplitRing, outer: SplitRing, index: number, value: number,
  axis = splitSegmentAxis(path, index)) {
  const next = path.map((p): SplitPoint => [...p]);
  next[index][axis] = next[index + 1][axis] = value;
  const direction = axis === 0 ? "vertical" : "horizontal";
  for (const [endpoint, adjacent] of [[0, 1], [next.length - 1, next.length - 2]]) {
    if (endpoint !== index && endpoint !== index + 1) continue;
    const hit = projectOrthogonalPoint(next[adjacent], next[endpoint], outer, direction, Infinity);
    if (hit.boundary) next[endpoint] = hit.point;
  }
  return next;
}

export function moveOrthogonalCorner(path: SplitRing, outer: SplitRing, index: number, point: SplitPoint) {
  const axis = splitSegmentAxis(path, index - 1);
  const next = moveOrthogonalSegment(path, outer, index - 1, point[axis]);
  // 相邻线段的方向取自原折线，允许编辑过程中暂时出现零长度线段。
  return moveOrthogonalSegment(next, outer, index, point[1 - axis], axis === 0 ? 1 : 0);
}

export function insertOrthogonalStep(path: SplitRing, outer: SplitRing, index: number, offset: number) {
  const axis = splitSegmentAxis(path, index);
  const a = path[index];
  const b = path[index + 1];
  const midpoint = a.map((value, i) => (value + b[i]) / 2) as SplitPoint;
  const withCorners = [...path.slice(0, index + 1), midpoint, midpoint, ...path.slice(index + 1)];
  return moveOrthogonalSegment(withCorners, outer, index + 2, a[axis] + offset, axis);
}

export function removeOrthogonalStep(path: SplitRing, outer: SplitRing, index: number) {
  const axis = splitSegmentAxis(path, index + 1);
  const aligned = moveOrthogonalSegment(path, outer, index + 1, path[index][axis], axis);
  return [...aligned.slice(0, index), ...aligned.slice(index + 2)];
}
