"use client";

import { useEffect, useMemo, useState } from "react";
import {
  constructSteppedContouredFootprintsOutcome,
  type ConstructedSteppedContouredFootprints,
  type SteppedContouredFootprintsOutcome,
} from "@/lib/stepped-contoured-footprint";
import type { ContouredFootprintConstructionError } from "@/lib/contoured-footprint";
import type { SteppedLayoutParams } from "@/types/custom-tray";

export interface SteppedContouredFootprintsResult {
  readonly footprints: ConstructedSteppedContouredFootprints | null;
  readonly error: ContouredFootprintConstructionError | null;
}

interface CachedContouredFootprintsResult {
  key: string;
  result: SteppedContouredFootprintsResult;
}

function toResult(
  outcome: SteppedContouredFootprintsOutcome,
): SteppedContouredFootprintsResult {
  return outcome.ok
    ? { footprints: outcome.value, error: null }
    : { footprints: null, error: outcome.error };
}

/** 仅选择影响 Stepped Contoured Footprint Construction 的输入。 */
export function createSteppedContouredFootprintInputKey(
  params: SteppedLayoutParams,
): string {
  const {
    footprintStyle,
    trayWidth,
    trayDepth,
    traySizingMode,
    cornerRadius,
    ...contouredInputs
  } = params;
  void footprintStyle;
  void trayWidth;
  void trayDepth;
  void traySizingMode;
  void cornerRadius;
  return JSON.stringify(contouredInputs);
}

function constructResult(
  params: SteppedLayoutParams,
): SteppedContouredFootprintsResult {
  return toResult(constructSteppedContouredFootprintsOutcome(params));
}

/**
 * Stepped Mode Editing Session 内主线程轮廓构造的唯一所有者。
 * 已提交结果可在 Rectangular 下休眠，工作结果只用于实时 2D。
 */
export function useSteppedContouredFootprint({
  persistedParams,
  workingParams,
}: {
  persistedParams: SteppedLayoutParams;
  workingParams: SteppedLayoutParams | null;
}): {
  committed: SteppedContouredFootprintsResult | null;
  working: SteppedContouredFootprintsResult | null;
} {
  const [dormantCommitted, setDormantCommitted] =
    useState<CachedContouredFootprintsResult | null>(null);
  const committedKey = createSteppedContouredFootprintInputKey(persistedParams);
  const committedIsContoured = persistedParams.footprintStyle !== "rectangular";
  const committed = useMemo(() => {
    if (!committedIsContoured) return null;
    if (dormantCommitted?.key === committedKey) return dormantCommitted.result;
    return constructResult(persistedParams);
  }, [committedIsContoured, committedKey, dormantCommitted, persistedParams]);

  useEffect(() => {
    if (committed && dormantCommitted?.key !== committedKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDormantCommitted({ key: committedKey, result: committed });
    }
  }, [committed, committedKey, dormantCommitted]);

  const workingKey = workingParams
    ? createSteppedContouredFootprintInputKey(workingParams)
    : null;
  const workingIsContoured = workingParams?.footprintStyle !== "rectangular";
  const working = useMemo(() => {
    if (!workingParams || !workingIsContoured || !workingKey) return null;
    return constructResult(workingParams);
  }, [workingIsContoured, workingKey, workingParams]);

  return { committed, working };
}
