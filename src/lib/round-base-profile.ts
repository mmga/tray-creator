import {
  extrusions,
  geometries,
  maths,
  primitives,
} from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import type { RoundBaseProfileSnapshot } from "@/types/custom-tray";

const { extrudeFromSlices, slice } = extrusions;
const { geom2 } = geometries;
const { mat4 } = maths;
const { ellipse } = primitives;

export function getRoundBaseTopDiameter(
  profile: RoundBaseProfileSnapshot,
): number {
  return profile.nominalDiameter - profile.topInset * 2;
}

function circleProfile(diameter: number): Geom2 {
  const radius = diameter / 2;
  return ellipse({
    radius: [radius, radius],
    segments: RENDER_CONFIG.cylinderSegments,
  });
}

export function createRoundBaseBody(
  profile: RoundBaseProfileSnapshot,
): Geom3 {
  const bottomProfile = circleProfile(profile.nominalDiameter);
  const topProfile = circleProfile(getRoundBaseTopDiameter(profile));
  const bottomSlice = slice.fromSides(geom2.toSides(bottomProfile));

  return extrudeFromSlices(
    {
      numberOfSlices: 2,
      callback: (progress) => {
        const currentProfile = progress === 0 ? bottomProfile : topProfile;
        return slice.transform(
          mat4.fromTranslation(
            mat4.create(),
            [0, 0, profile.height * progress],
          ),
          slice.fromSides(geom2.toSides(currentProfile)),
        );
      },
    },
    bottomSlice,
  );
}
