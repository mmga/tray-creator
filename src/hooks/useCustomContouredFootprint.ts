"use client";

import { useCallback } from "react";
import {
  useContouredFootprintLifecycle,
  type ActiveContouredFootprintState,
  type ContouredFootprintState,
} from "@/hooks/useContouredFootprintLifecycle";
import {
  constructCustomContouredFootprintOutcome,
  projectCustomContouredFootprintInput,
  type CustomContouredFootprintInput,
} from "@/lib/custom-contoured-footprint";
import type { ConstructedContouredFootprint } from "@/lib/contoured-footprint";
import { resolveCustomFootprintStyle } from "@/lib/custom-layout-math";
import type { CustomLayoutParams } from "@/types/custom-tray";

function constructCustomState(
  input: CustomContouredFootprintInput,
): ActiveContouredFootprintState<ConstructedContouredFootprint> {
  const outcome = constructCustomContouredFootprintOutcome(input);
  return outcome.ok
    ? { status: "ready", value: outcome.value }
    : { status: "failed", error: outcome.error };
}

/**
 * Custom Mode Editing Session 内的主线程权威构造所有权。
 */
export function useCustomContouredFootprint({
  persistedParams,
  workingParams,
  sessionEpoch,
  workingEnabled,
}: {
  persistedParams: CustomLayoutParams;
  workingParams: CustomLayoutParams | null;
  sessionEpoch: number;
  workingEnabled: boolean;
}): {
  committed: ContouredFootprintState<ConstructedContouredFootprint>;
  working: ContouredFootprintState<ConstructedContouredFootprint>;
} {
  const isActive = useCallback(
    (params: CustomLayoutParams) =>
      resolveCustomFootprintStyle(params) === "contoured",
    [],
  );

  return useContouredFootprintLifecycle({
    committedParams: persistedParams,
    workingParams,
    sessionEpoch,
    workingEnabled,
    isActive,
    projectInput: projectCustomContouredFootprintInput,
    construct: constructCustomState,
  });
}
