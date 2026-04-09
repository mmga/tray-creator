import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import type { TrayParams } from "@/types/tray";

function getFiniteOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeGridParams(next: TrayParams): TrayParams {
  const spacing = getFiniteOr(next.spacing, DEFAULT_TRAY_PARAMS.spacing);
  const spacingIndependent = Boolean(next.spacingIndependent);
  const spacingX = spacingIndependent
    ? getFiniteOr(next.spacingX, spacing)
    : spacing;
  const spacingY = spacingIndependent
    ? getFiniteOr(next.spacingY, spacing)
    : spacing;
  const boundarySpacingIndependent = Boolean(next.boundarySpacingIndependent);
  const boundarySpacing = boundarySpacingIndependent
    ? getFiniteOr(next.boundarySpacing, spacing)
    : spacing;

  return {
    ...next,
    spacing,
    spacingIndependent,
    spacingX,
    spacingY,
    boundarySpacingIndependent,
    boundarySpacing,
  };
}

export function replaceGridParams(next: TrayParams): TrayParams {
  return normalizeGridParams(next);
}

export function resetGridParams(): TrayParams {
  return normalizeGridParams({ ...DEFAULT_TRAY_PARAMS });
}

export function updateGridParam<K extends keyof TrayParams>(
  params: TrayParams,
  key: K,
  value: TrayParams[K],
): TrayParams {
  if (key === "spacingIndependent") {
    const nextIndependent = value as TrayParams["spacingIndependent"];
    if (nextIndependent) {
      return normalizeGridParams({
        ...params,
        spacingIndependent: true,
        spacingX: getFiniteOr(params.spacingX, params.spacing),
        spacingY: getFiniteOr(params.spacingY, params.spacing),
      });
    }

    const unifiedSpacing = getFiniteOr(params.spacingX, params.spacing);
    return normalizeGridParams({
      ...params,
      spacingIndependent: false,
      spacing: unifiedSpacing,
      spacingX: unifiedSpacing,
      spacingY: unifiedSpacing,
    });
  }

  if (key === "spacing") {
    const nextSpacing = value as TrayParams["spacing"];
    if (!params.spacingIndependent) {
      return normalizeGridParams({
        ...params,
        spacing: nextSpacing,
        spacingX: nextSpacing,
        spacingY: nextSpacing,
      });
    }
  }

  if (key === "boundarySpacingIndependent") {
    const nextIndependent = value as TrayParams["boundarySpacingIndependent"];
    if (!nextIndependent) {
      return normalizeGridParams({
        ...params,
        boundarySpacingIndependent: false,
        boundarySpacing: params.spacing,
      });
    }

    return normalizeGridParams({
      ...params,
      boundarySpacingIndependent: true,
      boundarySpacing: getFiniteOr(params.boundarySpacing, params.spacing),
    });
  }

  return normalizeGridParams({
    ...params,
    [key]: value,
  });
}
