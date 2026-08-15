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
import type {
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import {
  resolveMagnetPostHoleDepth,
  resolveMagnetPostHoleDiameter,
  resolveSteppedBaseHoleStructure,
} from "@/lib/stepped-base-hole";
import { getRequiredBaseHoleSupportingThickness } from "@/lib/base-hole-construction-plan";

export function createGridBaseHoleConstructionPlan(
  params: TrayParams,
): BaseHoleConstructionPlan {
  const resolvedParams = params.basePlateOnly && params.baseHoleStructure === "none"
    ? { ...params, baseHoleStructure: "magnetic-base-hole" as const }
    : params;
  if (resolvedParams.baseHoleStructure === "none") {
    return createBaseHoleConstructionPlan(resolvedParams, []);
  }
  return createBaseHoleConstructionPlan(
    resolvedParams,
    gridBaseHoleAdapter.project(resolvedParams),
  );
}

export function createCustomBaseHoleConstructionPlan(
  params: CustomLayoutParams,
  options: CustomBaseHoleAdapterOptions = {},
): BaseHoleConstructionPlan {
  if (params.baseHoleStructure === "none") {
    return createBaseHoleConstructionPlan(params, []);
  }
  return createBaseHoleConstructionPlan(
    params,
    customBaseHoleAdapter.project(params, options),
  );
}

export function createSteppedBaseHoleConstructionPlan(
  params: SteppedLayoutParams,
  options: SteppedBaseHoleAdapterOptions = {},
): BaseHoleConstructionPlan {
  const resolvedBaseHoleParams = {
    baseHoleStructure: resolveSteppedBaseHoleStructure(params),
    magnetPostHoleDiameter: resolveMagnetPostHoleDiameter(params),
    magnetPostHoleDepth: resolveMagnetPostHoleDepth(params),
    baseHoleSize: params.baseHoleSize,
    smallBaseHoleSize: params.smallBaseHoleSize,
  };
  if (resolvedBaseHoleParams.baseHoleStructure === "none") {
    return createBaseHoleConstructionPlan(resolvedBaseHoleParams, []);
  }
  const resolvedParams = { ...params, ...resolvedBaseHoleParams };
  return createBaseHoleConstructionPlan(
    resolvedParams,
    steppedBaseHoleAdapter.project(resolvedParams, options),
  );
}

export function applyFlatTrayBaseHoleSupportingThickness<
  P extends TrayParams | CustomLayoutParams,
>(params: P): P {
  const required = getRequiredBaseHoleSupportingThickness(params);
  return params.baseThickness >= required
    ? params
    : { ...params, baseThickness: required };
}

export function applySimpleSteppedBaseHoleSupportingThickness(
  params: SimpleSteppedLayoutParams,
): SimpleSteppedLayoutParams {
  const requiredFirstRowHeight =
    params.holeDepth + getRequiredBaseHoleSupportingThickness(params);
  return params.firstRowHeight >= requiredFirstRowHeight
    ? params
    : { ...params, firstRowHeight: requiredFirstRowHeight };
}
