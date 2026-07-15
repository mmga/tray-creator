import {
  booleans,
  extrusions,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import { resolveBaseConverterGeometry } from "@/lib/base-converter-config";
import type { BaseConverterParams } from "@/types/custom-tray";

const { subtract } = booleans;
const { extrudeLinear } = extrusions;
const { cuboid, ellipse } = primitives;
const { translate } = transforms;
const CUT_EPSILON = 0.02;

export function createBaseConverterModel(params: BaseConverterParams): Geom3 {
  const { params: normalized, target, recess, totalHeight } =
    resolveBaseConverterGeometry(params);
  const outerProfile = ellipse({
    radius: [target.width / 2, target.depth / 2],
    segments: RENDER_CONFIG.cylinderSegments,
  });
  const body = extrudeLinear({ height: totalHeight }, outerProfile);
  const recessCut = translate(
    [0, 0, normalized.floorThickness + (normalized.recessDepth + CUT_EPSILON) / 2],
    cuboid({
      size: [recess.width, recess.depth, normalized.recessDepth + CUT_EPSILON],
    }),
  );
  return subtract(body, recessCut);
}
