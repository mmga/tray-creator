
import { FreeSlot } from "@/types/custom-tray";

interface Point {
  x: number;
  y: number;
}

/**
 * Generates polygon points for an ellipse (approximated)
 * with optional margin expansion.
 */
export function getEllipsePolygon(
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  rotation: number, 
  margin: number = 0,
  steps: number = 16
): Point[] {
  const points: Point[] = [];
  const rad = (rotation * Math.PI) / 180;
  const cosRot = Math.cos(rad);
  const sinRot = Math.sin(rad);

  // Effective radii (half dimensions + margin)
  // Note: margin is applied to radius
  const rx = w / 2 + margin;
  const ry = h / 2 + margin;

  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    
    // Point on unrotated ellipse at origin
    const dx = rx * Math.cos(theta);
    const dy = ry * Math.sin(theta);

    // Rotate and translate
    const px = x + (dx * cosRot - dy * sinRot);
    const py = y + (dx * sinRot + dy * cosRot);

    points.push({ x: px, y: py });
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

      // Check for gap
      if (maxA < minB || maxB < minA) {
        return false; // Found a separating axis
      }
    }
  }

  return true; // No separating axis found -> Intersection
}
