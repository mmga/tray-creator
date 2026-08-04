"use client";

import { useCallback } from "react";
import {
  useContouredFootprintLifecycle,
  type ActiveContouredFootprintState,
  type ContouredFootprintState,
} from "@/hooks/useContouredFootprintLifecycle";
import {
  constructSteppedContouredFootprintsOutcome,
  projectSteppedContouredFootprintInput,
  type ConstructedSteppedContouredFootprints,
  type SteppedContouredFootprintInput,
} from "@/lib/stepped-contoured-footprint";
import type { SteppedLayoutParams } from "@/types/custom-tray";

function constructSteppedState(
  input: SteppedContouredFootprintInput,
): ActiveContouredFootprintState<ConstructedSteppedContouredFootprints> {
  const outcome = constructSteppedContouredFootprintsOutcome(input);
  return outcome.ok
    ? { status: "ready", value: outcome.value }
    : { status: "failed", error: outcome.error };
}

/**
 * Stepped Editing Session 内的主线程权威构造所有权。
 */
export function useSteppedContouredFootprint({
  persistedParams,
  workingParams,
  sessionEpoch,
  workingEnabled,
}: {
  persistedParams: SteppedLayoutParams;
  workingParams: SteppedLayoutParams | null;
  sessionEpoch: number;
  workingEnabled: boolean;
}): {
  committed: ContouredFootprintState<ConstructedSteppedContouredFootprints>;
  working: ContouredFootprintState<ConstructedSteppedContouredFootprints>;
} {
  const isActive = useCallback(
    (params: SteppedLayoutParams) => params.footprintStyle !== "rectangular",
    [],
  );

  return useContouredFootprintLifecycle({
    committedParams: persistedParams,
    workingParams,
    sessionEpoch,
    workingEnabled,
    isActive,
    projectInput: projectSteppedContouredFootprintInput,
    construct: constructSteppedState,
  });
}
