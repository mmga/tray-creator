import {
  booleans,
  extrusions,
  geometries,
  maths,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import { resolveBaseConverterGeometry } from "@/lib/base-converter-config";
import type { BaseConverterParams } from "@/types/custom-tray";

const { subtract } = booleans;
const { extrudeFromSlices, extrudeLinear, slice } = extrusions;
const { geom2 } = geometries;
const { mat4 } = maths;
const { cuboid, ellipse } = primitives;
const { translate } = transforms;
const CUT_EPSILON = 0.02;

function createBeveledEllipseBody(
  width: number,
  depth: number,
  height: number,
  sideBevelWidth: number,
): Geom3 {
  const bottomProfile = ellipse({
    radius: [width / 2, depth / 2],
    segments: RENDER_CONFIG.cylinderSegments,
  });
  if (sideBevelWidth <= 0) {
    return extrudeLinear({ height }, bottomProfile);
  }

  const topProfile = ellipse({
    radius: [
      width / 2 - sideBevelWidth,
      depth / 2 - sideBevelWidth,
    ],
    segments: RENDER_CONFIG.cylinderSegments,
  });
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
    slice.fromSides(geom2.toSides(bottomProfile)),
  );
}

export function createBaseConverterModel(params: BaseConverterParams): Geom3 {
  const { params: normalized, source, target, recess, totalHeight } =
    resolveBaseConverterGeometry(params);
  const body = createBeveledEllipseBody(
    target.width,
    target.depth,
    totalHeight,
    normalized.sideBevelWidth,
  );
  const cutHeight = normalized.recessDepth + CUT_EPSILON;
  const recessCut = source.shape === "circle"
    ? translate(
        [0, 0, normalized.floorThickness],
        extrudeLinear(
          { height: cutHeight },
          ellipse({
            radius: [recess.width / 2, recess.depth / 2],
            segments: RENDER_CONFIG.cylinderSegments,
          }),
        ),
      )
    : translate(
        [0, 0, normalized.floorThickness + cutHeight / 2],
        cuboid({
          size: [recess.width, recess.depth, cutHeight],
        }),
      );
  return subtract(body, recessCut);
}
