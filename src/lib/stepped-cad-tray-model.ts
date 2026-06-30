import {
  booleans,
  extrusions,
  measurements,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { subtractBaseHoles } from "@/lib/model-utils";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const { subtract, union } = booleans;
const { extrudeLinear } = extrusions;
const { measureVolume } = measurements;
const { ellipse } = primitives;
const { rotateZ, translate } = transforms;

const DEG_TO_RAD = Math.PI / 180;
const FEATURE_EPSILON = 0.02;

function createEmptyGeom() {
  return extrudeLinear(
    { height: 0.1 },
    ellipse({ radius: [1, 1], segments: 4 }),
  );
}

export function createSteppedCadTrayModel(
  params: SteppedLayoutParams,
): Geom3 {
  const graph = buildSteppedCadFeatureGraph(params);
  if (graph.layers.length === 0) {
    return createEmptyGeom();
  }

  const solids = graph.layers.map((layer) =>
    translate(
      [0, 0, layer.fromHeight],
      extrudeLinear(
        { height: layer.toHeight - layer.fromHeight },
        layer.footprint,
      ),
    )
  );
  const baseSolid = solids.length === 1 ? solids[0] : union(...solids);

  const slotHoles = graph.slotHoles.map((slotHole) =>
    translate(
      [slotHole.cx, slotHole.cy, slotHole.topHeight - slotHole.depth],
      rotateZ(
        slotHole.rotation * DEG_TO_RAD,
        extrudeLinear(
          { height: slotHole.depth + FEATURE_EPSILON },
          slotHole.profile,
        ),
      ),
    )
  );

  let tray = slotHoles.length > 0
    ? subtract(baseSolid, ...slotHoles)
    : baseSolid;

  if (params.enableBaseHole) {
    tray = subtractBaseHoles(tray, graph.baseHoles, 0, params.baseHoleSize);
  }

  return tray;
}

export function calculateSteppedCadTrayDimensions(
  params: SteppedLayoutParams,
) {
  const graph = buildSteppedCadFeatureGraph(params);
  return {
    width: graph.trayWidth,
    depth: graph.trayDepth,
    height: graph.maxHeight,
  };
}

export function calculateSteppedCadTrayVolume(
  params: SteppedLayoutParams,
) {
  return measureVolume(createSteppedCadTrayModel(params));
}
