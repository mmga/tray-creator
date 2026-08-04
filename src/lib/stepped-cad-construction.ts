import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import type { SteppedSplitPartResult } from "@/lib/model-ports";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import { buildSteppedCadSplitPartitionPlan } from "@/lib/stepped-cad-split-partition-plan";
import { buildSteppedCadSplitProfilePlan } from "@/lib/stepped-cad-split-profiles";
import {
  realizeSteppedCadSplitParts,
  realizeSteppedCadWhole,
} from "@/lib/stepped-cad-realization";
import type { ConstructedSteppedContouredFootprints } from "@/lib/stepped-contoured-footprint";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const INACTIVE_CONTOURED_FOOTPRINT_STATE = { status: "inactive" } as const;

export function createSteppedCadTrayModel(
  params: Readonly<SteppedLayoutParams>,
  contouredState: ContouredFootprintState<ConstructedSteppedContouredFootprints> =
    INACTIVE_CONTOURED_FOOTPRINT_STATE,
): Geom3 {
  const graph = buildSteppedCadFeatureGraph(params, contouredState);
  return realizeSteppedCadWhole(graph, params);
}

export function createSteppedCadSplitParts(
  params: Readonly<SteppedLayoutParams>,
  contouredState: ContouredFootprintState<ConstructedSteppedContouredFootprints> =
    INACTIVE_CONTOURED_FOOTPRINT_STATE,
): SteppedSplitPartResult[] {
  const graph = buildSteppedCadFeatureGraph(params, contouredState);
  if (graph.groups.length === 0) {
    return [];
  }

  const partitionPlan = buildSteppedCadSplitPartitionPlan({
    graph,
    layoutGroups: params.groups,
  });
  const splitProfilePlan = buildSteppedCadSplitProfilePlan({
    partitionPlan,
    params: {
      splitGrooveDepth: params.splitGrooveDepth,
      splitGrooveType: params.splitGrooveType,
      enableSplitRecess: params.enableSplitRecess,
      enableSplitLocators: params.enableSplitLocators,
      splitAssemblyMode: params.splitAssemblyMode,
    },
  });

  return realizeSteppedCadSplitParts({
    partitionPlan,
    splitProfilePlan,
    params,
  });
}
