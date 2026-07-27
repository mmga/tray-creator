import {
  booleans,
  extrusions,
  geometries,
  primitives,
  transforms,
  maths,
} from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import {
  resolveBaseConverterGeometry,
  validateBaseConverterParams,
} from "@/lib/base-converter-config";
import { sampleConversionTargetProfile } from "@/lib/base-converter-profile";
import type { BaseConverterParams } from "@/types/custom-tray";

const { subtract } = booleans;
const { extrudeFromSlices, extrudeLinear, slice } = extrusions;
const { roundedRectangle } = primitives;
const { geom2 } = geometries;
const { mat4 } = maths;
const { translate } = transforms;
const CUT_EPSILON = 0.02;

function targetProfile(
  target: ReturnType<typeof resolveBaseConverterGeometry>["target"],
  inset: number,
): Geom2 {
  return geom2.fromPoints(
    sampleConversionTargetProfile(target, inset).map(
      (point): [number, number] => [point.x, point.y],
    ),
  );
}

function createConverterBody(
  target: ReturnType<typeof resolveBaseConverterGeometry>["target"],
  height: number,
  sideBevelWidth: number,
): Geom3 {
  const bottomProfile = targetProfile(target, 0);
  if (sideBevelWidth === 0) {
    return extrudeLinear({ height }, bottomProfile);
  }

  const bottomSlice = slice.fromSides(geom2.toSides(bottomProfile));
  const topProfile = targetProfile(target, sideBevelWidth);
  return extrudeFromSlices(
    {
      numberOfSlices: 2,
      callback: (progress) => {
        const profile = progress === 0 ? bottomProfile : topProfile;
        return slice.transform(
          mat4.fromTranslation(mat4.create(), [0, 0, height * progress]),
          slice.fromSides(geom2.toSides(profile)),
        );
      },
    },
    bottomSlice,
  );
}

export function createBaseConverterModel(params: BaseConverterParams): Geom3 {
  const validationError = validateBaseConverterParams(params);
  if (validationError) {
    throw new Error(validationError);
  }
  const { params: normalized, target, recess, totalHeight } =
    resolveBaseConverterGeometry(params);
  const body = createConverterBody(
    target,
    totalHeight,
    normalized.sideBevelWidth,
  );
  const recessProfile = roundedRectangle({
    size: [recess.width, recess.depth],
    roundRadius: recess.cornerRadius,
    segments: RENDER_CONFIG.cornerSegments,
  });
  const recessCut = translate(
    [0, 0, normalized.floorThickness],
    extrudeLinear(
      { height: normalized.recessDepth + CUT_EPSILON },
      recessProfile,
    ),
  );
  return subtract(body, recessCut);
}
