import { ELLIPSE_PROFILE_EXPONENT } from "@/lib/config";
import type { FreeSlot } from "@/types/custom-tray";

export interface SlotProfilePoint {
  x: number;
  y: number;
}

export function sampleSlotProfilePoints(
  width: number,
  height: number,
  shape: FreeSlot["shape"] | undefined,
  offset: number,
  steps: number,
  ellipseProfileExponent: number = ELLIPSE_PROFILE_EXPONENT,
): SlotProfilePoint[] {
  const rx = width / 2;
  const ry = height / 2;
  const exponent = shape === "ellipse" ? ellipseProfileExponent : 2;
  const points: SlotProfilePoint[] = [];

  for (let i = 0; i < steps; i += 1) {
    const theta = (i / steps) * 2 * Math.PI;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const absCos = Math.abs(cosTheta);
    const absSin = Math.abs(sinTheta);
    let x = rx * Math.sign(cosTheta) * Math.pow(absCos, 2 / exponent);
    let y = ry * Math.sign(sinTheta) * Math.pow(absSin, 2 / exponent);

    if (offset !== 0) {
      const nx =
        rx === 0
          ? 0
          : (Math.sign(x) * Math.pow(Math.abs(x) / rx, exponent - 1)) / rx;
      const ny =
        ry === 0
          ? 0
          : (Math.sign(y) * Math.pow(Math.abs(y) / ry, exponent - 1)) / ry;
      const normalLength = Math.hypot(nx, ny);

      if (normalLength > 0) {
        x += (offset * nx) / normalLength;
        y += (offset * ny) / normalLength;
      }
    }

    points.push({ x, y });
  }

  return points;
}
