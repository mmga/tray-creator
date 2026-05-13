"use client";

import type { SteppedLayoutParams } from "@/types/custom-tray";
import {
  useModeDrafts,
  type UseModeDraftsOptions,
  type UseModeDraftsReturn,
} from "@/hooks/useModeDrafts";

export interface UseSteppedDraftsOptions
  extends Omit<UseModeDraftsOptions<"stepped">, "mode"> {
  params: SteppedLayoutParams;
}

export type UseSteppedDraftsReturn = UseModeDraftsReturn<"stepped">;

export function useSteppedDrafts({
  params,
  setParams,
  onAfterLoad,
}: UseSteppedDraftsOptions): UseSteppedDraftsReturn {
  return useModeDrafts({
    mode: "stepped",
    params,
    setParams,
    onAfterLoad,
  });
}
