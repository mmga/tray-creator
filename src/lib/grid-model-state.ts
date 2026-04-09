import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import type { TrayParams } from "@/types/tray";

export function normalizeGridParams(next: TrayParams): TrayParams {
  if (!next.boundarySpacingIndependent) {
    return {
      ...next,
      boundarySpacing: next.spacing,
    };
  }

  return next;
}

export function replaceGridParams(next: TrayParams): TrayParams {
  return normalizeGridParams(next);
}

export function resetGridParams(): TrayParams {
  return normalizeGridParams(DEFAULT_TRAY_PARAMS);
}

export function updateGridParam<K extends keyof TrayParams>(
  params: TrayParams,
  key: K,
  value: TrayParams[K],
): TrayParams {
  return normalizeGridParams({
    ...params,
    [key]: value,
  });
}
