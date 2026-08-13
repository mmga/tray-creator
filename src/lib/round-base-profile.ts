import {
  booleans,
  extrusions,
  geometries,
  maths,
  primitives,
} from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import type { RoundBaseProfileSnapshot } from "@/types/custom-tray";

const { extrudeFromSlices, slice } = extrusions;
const { subtract } = booleans;
const { geom2 } = geometries;
const { mat4 } = maths;
const { ellipse } = primitives;

/** 官方未公开底部剖面；实物测量前统一采用 1.2mm 顶板与径向侧壁。 */
export const ROUND_BASE_SHELL_THICKNESS = 1.2;
const CAVITY_CUT_EPSILON = 0.02;

export function getRoundBaseTopDiameter(
  profile: RoundBaseProfileSnapshot,
): number {
  return profile.nominalDiameter - profile.topInset * 2;
}

export function getRoundBaseOuterDiameterAtHeight(
  profile: RoundBaseProfileSnapshot,
  height: number,
): number {
  const clampedHeight = Math.min(Math.max(height, 0), profile.height);
  return profile.nominalDiameter
    - profile.topInset * 2 * (clampedHeight / profile.height);
}

export function getRoundBaseCavityDimensions(
  profile: RoundBaseProfileSnapshot,
) {
  const depth = profile.height - ROUND_BASE_SHELL_THICKNESS;
  const outerDiameterAtCeiling = profile.nominalDiameter
    - profile.topInset * 2 * (depth / profile.height);
  return {
    depth,
    bottomDiameter:
      profile.nominalDiameter - ROUND_BASE_SHELL_THICKNESS * 2,
    ceilingDiameter:
      outerDiameterAtCeiling - ROUND_BASE_SHELL_THICKNESS * 2,
  };
}

function circleProfile(diameter: number): Geom2 {
  const radius = diameter / 2;
  return ellipse({
    radius: [radius, radius],
    segments: RENDER_CONFIG.cylinderSegments,
  });
}

function createTaperedRoundBody(
  bottomDiameter: number,
  topDiameter: number,
  height: number,
  zOffset = 0,
): Geom3 {
  const bottomProfile = circleProfile(bottomDiameter);
  const topProfile = circleProfile(topDiameter);
  const bottomSlice = slice.fromSides(geom2.toSides(bottomProfile));

  return extrudeFromSlices(
    {
      numberOfSlices: 2,
      callback: (progress) => {
        const currentProfile = progress === 0 ? bottomProfile : topProfile;
        return slice.transform(
          mat4.fromTranslation(
            mat4.create(),
            [0, 0, zOffset + height * progress],
          ),
          slice.fromSides(geom2.toSides(currentProfile)),
        );
      },
    },
    bottomSlice,
  );
}

export function createRoundBaseBody(
  profile: RoundBaseProfileSnapshot,
): Geom3 {
  const outerBody = createRoundBaseOuterBody(profile);
  const cavityDimensions = getRoundBaseCavityDimensions(profile);
  if (cavityDimensions.depth <= 0) return outerBody;
  const cavity = createTaperedRoundBody(
    cavityDimensions.bottomDiameter,
    cavityDimensions.ceilingDiameter,
    cavityDimensions.depth + CAVITY_CUT_EPSILON,
    -CAVITY_CUT_EPSILON,
  );
  return subtract(outerBody, cavity);
}

export function createRoundBaseOuterBody(
  profile: RoundBaseProfileSnapshot,
): Geom3 {
  return createTaperedRoundBody(
    profile.nominalDiameter,
    getRoundBaseTopDiameter(profile),
    profile.height,
  );
}
