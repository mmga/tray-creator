import { RENDER_CONFIG } from "@/lib/config";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import type { ConversionTargetGeometrySnapshot } from "@/types/custom-tray";

export interface ConversionProfilePoint {
  x: number;
  y: number;
}

export function sampleConversionTargetProfile(
  target: Pick<
    ConversionTargetGeometrySnapshot,
    "shape" | "width" | "depth" | "profileExponent"
  >,
  inset = 0,
  steps = RENDER_CONFIG.cylinderSegments,
): ConversionProfilePoint[] {
  return sampleSlotProfilePoints(
    target.width,
    target.depth,
    target.shape,
    -inset,
    steps,
    target.profileExponent,
  );
}

export function conversionProfileToSvgPath(
  points: readonly ConversionProfilePoint[],
): string {
  if (points.length === 0) return "";
  return `${points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")} Z`;
}
