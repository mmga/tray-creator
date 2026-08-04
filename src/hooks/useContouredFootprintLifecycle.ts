"use client";

import { useMemo } from "react";
import type {
  ActiveContouredFootprintState,
  ContouredFootprintState,
} from "@/lib/contoured-footprint-state";

export type {
  ActiveContouredFootprintState,
  ContouredFootprintState,
} from "@/lib/contoured-footprint-state";

interface CachedContouredFootprintState<T> {
  readonly key: string;
  readonly state: ActiveContouredFootprintState<T>;
}

function createSessionCache<T>(sessionEpoch: number) {
  let entry: CachedContouredFootprintState<T> | null = null;
  return {
    sessionEpoch,
    get(key: string) {
      return entry?.key === key ? entry.state : null;
    },
    set(key: string, state: ActiveContouredFootprintState<T>) {
      entry = { key, state };
    },
  };
}

interface UseContouredFootprintLifecycleOptions<P, I, T> {
  readonly committedParams: P;
  readonly workingParams: P | null;
  readonly sessionEpoch: number;
  readonly workingEnabled: boolean;
  readonly isActive: (params: P) => boolean;
  readonly projectInput: (params: P) => I;
  readonly construct: (input: I) => ActiveContouredFootprintState<T>;
}

/**
 * 一个 Mode Editing Session 内的 Contoured Footprint Construction 生命周期。
 *
 * Mode Adapter 提供真实构造输入投影；该投影同时作为构造输入和休眠结果身份，
 * 避免另行维护参数字段清单。
 */
export function useContouredFootprintLifecycle<P, I, T>({
  committedParams,
  workingParams,
  sessionEpoch,
  workingEnabled,
  isActive,
  projectInput,
  construct,
}: UseContouredFootprintLifecycleOptions<P, I, T>): {
  readonly committed: ContouredFootprintState<T>;
  readonly working: ContouredFootprintState<T>;
} {
  const sessionCache = useMemo(
    () => createSessionCache<T>(sessionEpoch),
    [sessionEpoch],
  );

  const committedInput = useMemo(
    () => projectInput(committedParams),
    [committedParams, projectInput],
  );
  const committedKey = useMemo(
    () => JSON.stringify(committedInput),
    [committedInput],
  );
  const committed = useMemo<ContouredFootprintState<T>>(() => {
    if (!isActive(committedParams)) {
      return { status: "inactive" };
    }
    const cached = sessionCache.get(committedKey);
    if (cached) return cached;
    const state = construct(committedInput);
    sessionCache.set(committedKey, state);
    return state;
  }, [
    committedInput,
    committedKey,
    committedParams,
    construct,
    isActive,
    sessionCache,
  ]);

  const working = useMemo<ContouredFootprintState<T>>(() => {
    if (
      !workingEnabled ||
      workingParams === null ||
      !isActive(workingParams)
    ) {
      return { status: "inactive" };
    }
    const input = projectInput(workingParams);
    return construct(input);
  }, [
    construct,
    isActive,
    projectInput,
    workingEnabled,
    workingParams,
  ]);

  return { committed, working };
}
