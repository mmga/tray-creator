import {
  createBaseHoleConstructionPlan,
  type BaseHoleConstructionPlan,
} from "@/lib/base-hole-construction-plan";
import {
  customBaseHoleAdapter,
  gridBaseHoleAdapter,
  steppedBaseHoleAdapter,
  type CustomBaseHoleAdapterOptions,
  type SteppedBaseHoleAdapterOptions,
} from "@/lib/base-hole-mode-adapters";
import type { CustomLayoutParams, SteppedLayoutParams } from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import {
  resolveMagnetPostHoleDepth,
  resolveMagnetPostHoleDiameter,
  resolveSteppedBaseHoleStructure,
} from "@/lib/stepped-base-hole";

export function createGridBaseHoleConstructionPlan(
  params: TrayParams,
): BaseHoleConstructionPlan {
  const resolvedParams = params.basePlateOnly && params.baseHoleStructure === "none"
    ? { ...params, baseHoleStructure: "magnetic-base-hole" as const }
    : params;
  return createBaseHoleConstructionPlan(
    resolvedParams,
    gridBaseHoleAdapter.project(resolvedParams),
  );
}

export function createCustomBaseHoleConstructionPlan(
  params: CustomLayoutParams,
  options: CustomBaseHoleAdapterOptions = {},
): BaseHoleConstructionPlan {
  return createBaseHoleConstructionPlan(
    params,
    customBaseHoleAdapter.project(params, options),
  );
}

export function createSteppedBaseHoleConstructionPlan(
  params: SteppedLayoutParams,
  options: SteppedBaseHoleAdapterOptions = {},
): BaseHoleConstructionPlan {
  const resolvedParams = {
    ...params,
    baseHoleStructure: resolveSteppedBaseHoleStructure(params),
    magnetPostHoleDiameter: resolveMagnetPostHoleDiameter(params),
    magnetPostHoleDepth: resolveMagnetPostHoleDepth(params),
  };
  return createBaseHoleConstructionPlan(
    resolvedParams,
    steppedBaseHoleAdapter.project(resolvedParams, options),
  );
}
