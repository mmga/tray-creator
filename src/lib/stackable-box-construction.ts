import { calculateBottomSeatSlopeHeight, calculateTopSeatSupportHeight, STACKABLE_BOX_SPECS } from "./stackable-box";
import type { TrayBodyProfile } from "./tray-body-profiles";

export interface StackableBoxLidInput {
  outerWidth: number;
  outerDepth: number;
  lidThickness: number;
  xyFitClearance: number;
}

export interface StackableBoxBodyInput {
  outerWidth: number;
  outerDepth: number;
  outerHeight: number;
  trayTopZ: number;
  xyFitClearance: number;
}

function boxProfile(input: Pick<StackableBoxBodyInput, "outerWidth" | "outerDepth">, z: number, inset = 0): TrayBodyProfile {
  const width = input.outerWidth - 2 * inset;
  const depth = input.outerDepth - 2 * inset;
  const radius = Math.max(0.01, Math.min(STACKABLE_BOX_SPECS.outerCornerRadius - inset, width / 2 - 0.01, depth / 2 - 0.01));
  return { width, depth, radius, z };
}

export function planStackableBoxBody(input: StackableBoxBodyInput) {
  const { outerWidth, outerDepth, outerHeight, trayTopZ, xyFitClearance } = input;
  if (![outerWidth, outerDepth, outerHeight].every(Number.isFinite)) {
    throw new Error("堆叠盒体外部尺寸必须是有限数值");
  }
  if (!Number.isFinite(trayTopZ) || trayTopZ <= 0) {
    throw new Error("盒底厚度必须是大于 0 的有限数值");
  }
  const { bodyWallThickness: wall, topRimWidth: rim, guideChamferHeight: guide } = STACKABLE_BOX_SPECS;
  const bottomSlope = calculateBottomSeatSlopeHeight(input);
  const support = calculateTopSeatSupportHeight(input);
  const topSeat = outerHeight - guide;
  const transition = topSeat - support;
  const wallStart = Math.max(trayTopZ, bottomSlope);
  if (transition < wallStart) {
    throw new Error(`盒体外高 ${outerHeight} mm 不足以容纳上下互补斜面和承重座（至少需要 ${(wallStart + support + guide).toFixed(1)} mm）`);
  }
  const bottomInset = guide + xyFitClearance;
  const envelope = [boxProfile(input, 0, bottomInset), boxProfile(input, bottomSlope), boxProfile(input, outerHeight)];
  const lowerCavity = trayTopZ < bottomSlope
    ? [boxProfile(input, trayTopZ, bottomInset * (1 - trayTopZ / bottomSlope) + wall), boxProfile(input, bottomSlope, wall)]
    : [boxProfile(input, trayTopZ, wall)];
  if (transition > wallStart) lowerCavity.push(boxProfile(input, transition, wall));
  lowerCavity.push(boxProfile(input, topSeat, rim + xyFitClearance));
  return { envelope, lowerCavity, upperCavity: [boxProfile(input, topSeat, guide), boxProfile(input, outerHeight)] };
}

export function planStackableBoxLid(input: StackableBoxLidInput) {
  const slope = calculateBottomSeatSlopeHeight(input);
  const { lidThickness, xyFitClearance } = input;
  return [boxProfile(input, 0), boxProfile(input, lidThickness),
    boxProfile(input, lidThickness + slope, STACKABLE_BOX_SPECS.guideChamferHeight + xyFitClearance)];
}
