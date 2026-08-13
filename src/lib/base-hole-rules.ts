import { BASE_HOLE_CONFIG } from "@/lib/config";
import {
  createBaseHoleConstructionPlan,
  getBaseHoleFitBlockingReason,
  getRequiredBaseHoleSupportingThickness,
  MAGNETIC_BASE_HOLE_MIN_SIDE_WALL,
  type BaseHoleFitViolation,
} from "@/lib/base-hole-construction-plan";
import {
  customBaseHoleAdapter,
  gridBaseHoleAdapter,
  steppedBaseHoleAdapter,
  type CustomBaseHoleAdapterOptions,
  type SteppedBaseHoleAdapterOptions,
} from "@/lib/base-hole-mode-adapters";
import { resolveMagneticBaseHolePreset } from "@/lib/base-hole-config";
import type {
  AppMode,
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { BaseHolePresetKey, TrayParams } from "@/types/tray";

export {
  getBaseHoleFitBlockingReason,
  getRequiredBaseHoleSupportingThickness,
  MAGNETIC_BASE_HOLE_MIN_SIDE_WALL,
  resolveMagneticBaseHolePreset,
};
export type { BaseHoleFitViolation };

export interface BaseHoleFitOptions {
  readonly customContouredState?: CustomBaseHoleAdapterOptions["contouredState"];
  readonly steppedContouredState?: SteppedBaseHoleAdapterOptions["contouredState"];
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

export function getResolvedMagneticBaseHolePresets(
  mode: Exclude<AppMode, "base-converter">,
  params: TrayParams | CustomLayoutParams | SteppedLayoutParams,
): BaseHolePresetKey[] {
  if (mode === "grid") {
    return createBaseHoleConstructionPlan(
      params as TrayParams,
      gridBaseHoleAdapter.project(params as TrayParams),
    ).resolvedMagneticPresets.slice();
  }
  const slots = (params as CustomLayoutParams | SteppedLayoutParams).slots;
  const presets = new Set(slots.map((slot) => resolveMagneticBaseHolePreset(
    slot.shape,
    slot.width,
    slot.height,
  )));
  return presets.size > 0 ? [...presets].sort() : [BASE_HOLE_CONFIG.defaultPreset];
}

export function validateBaseHoleFit(
  mode: Exclude<AppMode, "base-converter">,
  params: TrayParams | CustomLayoutParams | SteppedLayoutParams,
  options?: BaseHoleFitOptions,
): BaseHoleFitViolation[] {
  if (params.baseHoleStructure === "none") return [];
  if (mode === "grid") {
    return createBaseHoleConstructionPlan(
      params as TrayParams,
      gridBaseHoleAdapter.project(params as TrayParams),
    ).violations.slice();
  }
  if (mode === "custom") {
    const customParams = params as CustomLayoutParams;
    return createBaseHoleConstructionPlan(
      customParams,
      customBaseHoleAdapter.project(customParams, {
        contouredState: options?.customContouredState,
      }),
    ).violations.slice();
  }
  const steppedParams = params as SteppedLayoutParams;
  return createBaseHoleConstructionPlan(
    steppedParams,
    steppedBaseHoleAdapter.project(steppedParams, {
      contouredState: options?.steppedContouredState,
    }),
  ).violations.slice();
}
