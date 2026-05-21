import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { resolveBaseHolePresetKey } from "@/lib/config";
import { createGridSlotSnapshotFromDefinition } from "@/lib/slot-instance-factory";
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
  const basePlateOnly = Boolean(next.basePlateOnly);
  const slotSnapshot = createGridSlotSnapshotFromDefinition(next.holeDiameter);
  const halfCircleSlots =
    !basePlateOnly &&
    (next.rows === 1 || next.columns === 1) &&
    Boolean(next.halfCircleSlots);
  const enableBaseHole = basePlateOnly ? true : Boolean(next.enableBaseHole);
  const baseHoleSize = resolveBaseHolePresetKey(next.holeDiameter);

  return {
    ...next,
    spacing,
    spacingIndependent,
    spacingX,
    spacingY,
    boundarySpacingIndependent,
    boundarySpacing,
    ...slotSnapshot,
    slotDiameter: getFiniteOr(next.slotDiameter, slotSnapshot.slotDiameter),
    halfCircleSlots,
    basePlateOnly,
    enableBaseHole,
    baseHoleSize,
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

  if (key === "holeDiameter") {
    const holeDiameter = value as TrayParams["holeDiameter"];
    return normalizeGridParams({
      ...params,
      holeDiameter,
      ...createGridSlotSnapshotFromDefinition(holeDiameter),
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

  if (key === "basePlateOnly") {
    const nextBasePlateOnly = value as TrayParams["basePlateOnly"];
    return normalizeGridParams({
      ...params,
      basePlateOnly: nextBasePlateOnly,
      halfCircleSlots: nextBasePlateOnly ? false : params.halfCircleSlots,
      enableBaseHole: nextBasePlateOnly ? true : params.enableBaseHole,
    });
  }

  if (key === "halfCircleSlots") {
    const nextHalfCircleSlots = value as TrayParams["halfCircleSlots"];
    return normalizeGridParams({
      ...params,
      halfCircleSlots: nextHalfCircleSlots,
      basePlateOnly: nextHalfCircleSlots ? false : params.basePlateOnly,
    });
  }

  return normalizeGridParams({
    ...params,
    [key]: value,
  });
}
