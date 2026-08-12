import { getRoundBaseTopDiameter } from "@/lib/round-base-profile";
import type {
  PushFitHexHoleParams,
  RoundBaseProfileSnapshot,
} from "@/types/custom-tray";

export interface Point2D {
  x: number;
  y: number;
}

export const PUSH_FIT_MIN_TOP_WALL = 0.6;

export function createPushFitHexHoleVertices(
  hole: PushFitHexHoleParams,
): Point2D[] {
  const radius = hole.acrossFlats / Math.sqrt(3);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 3;
    return {
      x: hole.offsetX + Math.cos(angle) * radius,
      y: hole.offsetY + Math.sin(angle) * radius,
    };
  });
}

export function validatePushFitHexHolePlacement(
  profile: RoundBaseProfileSnapshot,
  hole: PushFitHexHoleParams,
  minimumWall = PUSH_FIT_MIN_TOP_WALL,
): string | null {
  const maximumVertexRadius = getRoundBaseTopDiameter(profile) / 2
    - minimumWall;
  const fits = maximumVertexRadius > 0
    && createPushFitHexHoleVertices(hole).every(
      (point) => Math.hypot(point.x, point.y) <= maximumVertexRadius + 1e-9,
    );
  return fits
    ? null
    : `简版六边形孔必须保留至少 ${minimumWall}mm 顶面壁厚`;
}

export function clampPushFitHexHoleOffset(
  profile: RoundBaseProfileSnapshot,
  hole: PushFitHexHoleParams,
  desired: Point2D,
): Point2D {
  const isLegal = (point: Point2D) => validatePushFitHexHolePlacement(profile, {
    ...hole,
    offsetX: point.x,
    offsetY: point.y,
  }) === null;
  if (isLegal(desired)) return desired;

  const current = { x: hole.offsetX, y: hole.offsetY };
  const origin = { x: 0, y: 0 };
  const start = isLegal(current) ? current : isLegal(origin) ? origin : current;
  if (!isLegal(start)) return current;

  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const ratio = (low + high) / 2;
    const candidate = {
      x: start.x + (desired.x - start.x) * ratio,
      y: start.y + (desired.y - start.y) * ratio,
    };
    if (isLegal(candidate)) low = ratio;
    else high = ratio;
  }
  return {
    x: start.x + (desired.x - start.x) * low,
    y: start.y + (desired.y - start.y) * low,
  };
}
