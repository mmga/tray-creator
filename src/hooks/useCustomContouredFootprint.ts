"use client";

import { useEffect, useMemo, useState } from "react";
import {
  constructCustomContouredFootprintOutcome,
  type CustomContouredFootprintOutcome,
} from "@/lib/custom-contoured-footprint";
import type {
  ContouredFootprintConstructionError,
  ConstructedContouredFootprint,
} from "@/lib/contoured-footprint";
import { resolveCustomFootprintStyle } from "@/lib/custom-layout-math";
import type { CustomLayoutParams } from "@/types/custom-tray";

export interface CustomContouredFootprintResult {
  readonly footprint: ConstructedContouredFootprint | null;
  readonly error: ContouredFootprintConstructionError | null;
}

interface CachedContouredFootprintResult {
  key: string;
  result: CustomContouredFootprintResult;
}

function toResult(
  outcome: CustomContouredFootprintOutcome,
): CustomContouredFootprintResult {
  return outcome.ok
    ? { footprint: outcome.value, error: null }
    : { footprint: null, error: outcome.error };
}

/**
 * 仅包含 Contoured Footprint Construction 的相关输入。
 * 因而 Rectangular Footprint 专属参数变化不会使 Mode-local 休眠结果失效。
 */
export function createCustomContouredFootprintInputKey(
  params: CustomLayoutParams,
): string {
  return JSON.stringify({
    slots: params.slots,
    spacing: params.spacing,
    boundarySpacingIndependent: params.boundarySpacingIndependent,
    boundarySpacing: params.boundarySpacing,
    smoothingRadius: params.smoothingRadius,
    disconnectDistance: params.disconnectDistance,
  });
}

function constructResult(params: CustomLayoutParams): CustomContouredFootprintResult {
  return toResult(constructCustomContouredFootprintOutcome(params));
}

/**
 * 一个 Custom Mode Editing Session 内的主线程构造所有权。
 * ref 仅保留当前 Session 的最近已提交结果，既可复用 Rectangular 下的休眠结果，
 * 也会让同一失败快照停止反复重试。
 */
export function useCustomContouredFootprint({
  persistedParams,
  workingParams,
}: {
  persistedParams: CustomLayoutParams;
  workingParams: CustomLayoutParams | null;
}): {
  committed: CustomContouredFootprintResult | null;
  working: CustomContouredFootprintResult | null;
} {
  const [dormantCommitted, setDormantCommitted] =
    useState<CachedContouredFootprintResult | null>(null);
  const committedKey = createCustomContouredFootprintInputKey(persistedParams);
  const committedIsContoured =
    resolveCustomFootprintStyle(persistedParams) === "contoured";
  const committed = useMemo(() => {
    if (!committedIsContoured) return null;
    if (dormantCommitted?.key === committedKey) {
      return dormantCommitted.result;
    }
    return constructResult(persistedParams);
  }, [committedIsContoured, committedKey, dormantCommitted, persistedParams]);

  useEffect(() => {
    if (committed && dormantCommitted?.key !== committedKey) {
      // 仅把新快照的结果保留为当前 Session 的休眠结果；不会形成进程级缓存。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDormantCommitted({ key: committedKey, result: committed });
    }
  }, [committed, committedKey, dormantCommitted]);

  const workingKey = workingParams
    ? createCustomContouredFootprintInputKey(workingParams)
    : null;
  const workingIsContoured = workingParams !== null &&
    resolveCustomFootprintStyle(workingParams) === "contoured";
  const working = useMemo(() => {
    if (!workingParams || !workingIsContoured || !workingKey) return null;
    return constructResult(workingParams);
  }, [workingIsContoured, workingKey, workingParams]);

  return { committed, working };
}
