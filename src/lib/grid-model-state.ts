import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import {
  createOldWorldGridSlotSnapshot,
  findOldWorldRectangularPreset,
  resolveGridBaseHolePresetKey,
} from "@/lib/grid-config";
import { findCircleSlotDefinitionById } from "@/lib/slot-definitions";
import { createGridSlotSnapshotFromDefinition } from "@/lib/slot-instance-factory";
import type { TrayParams } from "@/types/tray";
import { normalizeBaseHoleParams } from "@/lib/base-hole-config";
import { applyFlatTrayBaseHoleSupportingThickness } from "@/lib/base-hole-planning";
import { calculateGridBoxRequiredOuterSize } from "@/lib/grid-layout-math";
import { resolveStackableBoxParams } from "@/lib/stackable-box";

function getFiniteOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getNormalizedSlotSnapshot(next: TrayParams) {
  const rectangularPreset =
    next.slotShape === "rectangle"
      ? findOldWorldRectangularPreset(next.slotDefinitionId)
      : undefined;

  if (rectangularPreset) {
    const defaults = createOldWorldGridSlotSnapshot(rectangularPreset);
    const defaultBaseWidth = defaults.slotBaseWidth ?? rectangularPreset.width;
    const defaultBaseHeight = defaults.slotBaseHeight ?? rectangularPreset.height;
    const defaultSlotWidth = defaults.slotWidth ?? defaultBaseWidth + 0.4;
    const defaultSlotHeight = defaults.slotHeight ?? defaultBaseHeight + 0.4;
    const slotBaseWidth = getFiniteOr(next.slotBaseWidth, defaultBaseWidth);
    const slotBaseHeight = getFiniteOr(next.slotBaseHeight, defaultBaseHeight);
    return {
      ...defaults,
      holeDiameter: Math.min(slotBaseWidth, slotBaseHeight),
      slotBaseWidth,
      slotBaseHeight,
      slotWidth: getFiniteOr(next.slotWidth, defaultSlotWidth),
      slotHeight: getFiniteOr(next.slotHeight, defaultSlotHeight),
      slotDiameter: undefined,
    };
  }

  const slotSnapshot = createGridSlotSnapshotFromDefinition(next.holeDiameter);
  return {
    ...slotSnapshot,
    slotShape: "circle" as const,
    slotBaseWidth: undefined,
    slotBaseHeight: undefined,
    slotWidth: undefined,
    slotHeight: undefined,
  };
}

export function normalizeGridParams(next: TrayParams): TrayParams {
  const current = { ...next } as TrayParams & { enableBaseHole?: boolean };
  const baseHoleParams = normalizeBaseHoleParams(
    current as unknown as Record<string, unknown>,
    "none",
  );
  delete current.enableBaseHole;
  const spacing = getFiniteOr(next.spacing, DEFAULT_TRAY_PARAMS.spacing);
  const spacingIndependent = Boolean(next.spacingIndependent);
  const spacingX = spacingIndependent
    ? getFiniteOr(next.spacingX, spacing)
    : spacing;
  const spacingY = spacingIndependent
    ? getFiniteOr(next.spacingY, spacing)
    : spacing;
  const zeroSpacingTolerance = getFiniteOr(
    next.zeroSpacingTolerance,
    DEFAULT_TRAY_PARAMS.zeroSpacingTolerance ?? 1,
  );
  const boundarySpacingIndependent = Boolean(next.boundarySpacingIndependent);
  const boundarySpacing = boundarySpacingIndependent
    ? getFiniteOr(next.boundarySpacing, spacing)
    : spacing;
  const basePlateOnly = Boolean(next.basePlateOnly);
  const slotSnapshot = getNormalizedSlotSnapshot(next);
  const halfCircleSlots =
    !basePlateOnly &&
    next.slotShape !== "rectangle" &&
    (next.rows === 1 || next.columns === 1) &&
    Boolean(next.halfCircleSlots) &&
    !resolveStackableBoxParams(next.stackableBox).enabled;
  const normalizedSlotParams = { ...next, ...slotSnapshot } as TrayParams;
  const baseHoleSize = resolveGridBaseHolePresetKey(normalizedSlotParams);
  const sideBevelWidth = getFiniteOr(
    next.sideBevelWidth,
    DEFAULT_TRAY_PARAMS.sideBevelWidth,
  );

  return applyFlatTrayBaseHoleSupportingThickness({
    ...current,
    spacing,
    spacingIndependent,
    spacingX,
    spacingY,
    zeroSpacingTolerance,
    boundarySpacingIndependent,
    boundarySpacing,
    ...slotSnapshot,
    slotDiameter:
      slotSnapshot.slotShape === "rectangle"
        ? undefined
        : getFiniteOr(next.slotDiameter, slotSnapshot.slotDiameter ?? next.holeDiameter),
    halfCircleSlots,
    basePlateOnly,
    sideBevelWidth,
    ...baseHoleParams,
    baseHoleStructure: basePlateOnly
      ? "magnetic-base-hole"
      : baseHoleParams.baseHoleStructure,
    baseHoleSize,
  });
}

export function replaceGridParams(next: TrayParams): TrayParams {
  return normalizeGridParams(next);
}

export function resetGridParams(): TrayParams {
  return normalizeGridParams({ ...DEFAULT_TRAY_PARAMS });
}

export function selectGridSlotDefinition(
  params: TrayParams,
  slotDefinitionId: string,
): TrayParams {
  const rectangularPreset = findOldWorldRectangularPreset(slotDefinitionId);
  if (rectangularPreset) {
    return normalizeGridParams({
      ...params,
      ...createOldWorldGridSlotSnapshot(rectangularPreset),
      halfCircleSlots: false,
    });
  }

  const circleDefinition = findCircleSlotDefinitionById(slotDefinitionId);
  if (!circleDefinition) {
    return params;
  }

  return normalizeGridParams({
    ...params,
    holeDiameter: circleDefinition.baseDiameter,
    ...createGridSlotSnapshotFromDefinition(circleDefinition.baseDiameter),
    slotShape: "circle",
    halfCircleSlots: params.halfCircleSlots,
  });
}

export function updateGridParam<K extends keyof TrayParams>(
  params: TrayParams,
  key: K,
  value: TrayParams[K],
): TrayParams {
  if (key === "baseHoleStructure") {
    const nextStructure = value as TrayParams["baseHoleStructure"];
    return normalizeGridParams({
      ...params,
      baseHoleStructure: nextStructure,
      basePlateOnly:
        nextStructure === "magnetic-base-hole"
          ? params.basePlateOnly
          : false,
    });
  }

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
      slotShape: "circle",
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
      baseHoleStructure: nextBasePlateOnly
        ? "magnetic-base-hole"
        : params.baseHoleStructure,
    });
  }

  if (key === "stackableBox") {
    const currentBox = resolveStackableBoxParams(params.stackableBox);
    const nextBox = resolveStackableBoxParams(
      value as TrayParams["stackableBox"],
    );
    if (!currentBox.enabled && nextBox.enabled) {
      const required = calculateGridBoxRequiredOuterSize({
        ...params,
        stackableBox: nextBox,
      });
      nextBox.outerWidth = required.outerWidth;
      nextBox.outerDepth = required.outerDepth;
    }
    return normalizeGridParams({ ...params, stackableBox: nextBox });
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

/** 盒体开启时，"扩展盒体至刚好容纳"：把外尺寸设为当前布局的最小所需值。 */
export function expandGridBoxToFit(params: TrayParams): TrayParams {
  const required = calculateGridBoxRequiredOuterSize(params);
  return normalizeGridParams({
    ...params,
    stackableBox: {
      ...resolveStackableBoxParams(params.stackableBox),
      outerWidth: required.outerWidth,
      outerDepth: required.outerDepth,
    },
  });
}
