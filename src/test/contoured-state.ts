import {
  constructCustomContouredFootprintOutcome,
  projectCustomContouredFootprintInput,
} from "@/lib/custom-contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import type { ConstructedContouredFootprint } from "@/lib/contoured-footprint";
import {
  constructSteppedContouredFootprintsOutcome,
  projectSteppedContouredFootprintInput,
  type ConstructedSteppedContouredFootprints,
} from "@/lib/stepped-contoured-footprint";
import type {
  CustomLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import { buildSteppedCadFeatureGraph as buildGraph } from "@/lib/stepped-cad-feature-graph";
import {
  createSteppedCadSplitParts as createSplitParts,
  createSteppedCadTrayModel as createTrayModel,
} from "@/lib/stepped-cad-tray-model";
import { buildSteppedOutlinePreview as buildOutlinePreview } from "@/lib/stepped-outline-preview";
import { calculateSteppedEffectiveDimensions as calculateDimensions } from "@/lib/stepped-layout-math";

export function customContouredStateForTest(
  params: CustomLayoutParams,
): ContouredFootprintState<ConstructedContouredFootprint> {
  if (params.footprintStyle !== "contoured") return { status: "inactive" };
  const outcome = constructCustomContouredFootprintOutcome(
    projectCustomContouredFootprintInput(params),
  );
  if (!outcome.ok) return { status: "failed", error: outcome.error };
  return { status: "ready", value: outcome.value };
}

export function steppedContouredStateForTest(
  params: SteppedLayoutParams,
): ContouredFootprintState<ConstructedSteppedContouredFootprints> {
  if (params.footprintStyle === "rectangular") return { status: "inactive" };
  const outcome = constructSteppedContouredFootprintsOutcome(
    projectSteppedContouredFootprintInput(params),
  );
  if (!outcome.ok) return { status: "failed", error: outcome.error };
  return { status: "ready", value: outcome.value };
}

export function buildSteppedCadFeatureGraph(params: SteppedLayoutParams) {
  return buildGraph(params, steppedContouredStateForTest(params));
}

export function createSteppedCadTrayModel(params: SteppedLayoutParams) {
  return createTrayModel(params, steppedContouredStateForTest(params));
}

export function createSteppedCadSplitParts(
  params: SteppedLayoutParams,
  grooveDepth = params.splitGrooveDepth,
) {
  return createSplitParts(
    params,
    grooveDepth,
    steppedContouredStateForTest(params),
  );
}

export function buildSteppedOutlinePreview(params: SteppedLayoutParams) {
  return buildOutlinePreview(params, steppedContouredStateForTest(params));
}

export function calculateSteppedEffectiveDimensions(
  params: SteppedLayoutParams,
) {
  return calculateDimensions(params, steppedContouredStateForTest(params));
}
