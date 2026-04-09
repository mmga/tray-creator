interface Point {
  x: number;
  y: number;
}

// ── 预分配多边形缓冲池（避免拖拽时频繁 GC）──────────

const DEFAULT_STEPS = 16;
const POOL_SIZE = 4;

/** 预分配的点缓冲池，每个缓冲包含 DEFAULT_STEPS 个 Point */
const polygonPool: Point[][] = Array.from({ length: POOL_SIZE }, () =>
  Array.from({ length: DEFAULT_STEPS }, () => ({ x: 0, y: 0 })),
);
let poolIndex = 0;

/** 从池中获取一个可复用的 Point 缓冲 */
function getPolygonBuffer(steps: number): Point[] {
  if (steps !== DEFAULT_STEPS) {
    // 非标准步长时回退到新分配
    return Array.from({ length: steps }, () => ({ x: 0, y: 0 }));
  }
  const buf = polygonPool[poolIndex % POOL_SIZE];
  poolIndex++;
  return buf;
}

/**
 * Generates polygon points for an ellipse (approximated)
 * with optional margin expansion.
 *
 * 使用预分配缓冲以减少拖拽期间的内存分配。
 * 注意：返回的数组在下次调用时会被覆盖。
 */
export function getEllipsePolygon(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  margin: number = 0,
  steps: number = DEFAULT_STEPS,
): Point[] {
  const points = getPolygonBuffer(steps);
  const rad = (rotation * Math.PI) / 180;
  const cosRot = Math.cos(rad);
  const sinRot = Math.sin(rad);

  // Effective radii (half dimensions + margin)
  const rx = w / 2 + margin;
  const ry = h / 2 + margin;

  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;

    // Point on unrotated ellipse at origin
    const dx = rx * Math.cos(theta);
    const dy = ry * Math.sin(theta);

    // Rotate and translate
    points[i].x = x + (dx * cosRot - dy * sinRot);
    points[i].y = y + (dx * sinRot + dy * cosRot);
  }

  return points;
}

/**
 * Separating Axis Theorem (SAT) for convex polygons.
 * Returns true if polygons intersect.
 */
export function polygonsIntersect(polyA: Point[], polyB: Point[]): boolean {
  const polygons = [polyA, polyB];

  for (let i = 0; i < polygons.length; i++) {
    const polygon = polygons[i];

    for (let j = 0; j < polygon.length; j++) {
      // Get edge vector
      const p1 = polygon[j];
      const p2 = polygon[(j + 1) % polygon.length];
      const edge = { x: p2.x - p1.x, y: p2.y - p1.y };

      // Get normal (perpendicular) vector
      const normal = { x: -edge.y, y: edge.x };

      // Project both polygons onto the normal
      let minA = Infinity, maxA = -Infinity;
      for (const p of polyA) {
        const proj = (p.x * normal.x + p.y * normal.y);
        minA = Math.min(minA, proj);
        maxA = Math.max(maxA, proj);
      }

      let minB = Infinity, maxB = -Infinity;
      for (const p of polyB) {
        const proj = (p.x * normal.x + p.y * normal.y);
        minB = Math.min(minB, proj);
        maxB = Math.max(maxB, proj);
      }

      // Check for gap with a tiny epsilon (1e-6) to handle touching edges
      if (maxA <= minB + 1e-6 || maxB <= minA + 1e-6) {
        return false; // Found a separating axis
      }
    }
  }

  return true; // No separating axis found -> Intersection
}
