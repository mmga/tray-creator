import { BASE_HOLE_CONFIG } from "@/lib/config";
import {
  calculateCustomTrayFootprint,
  resolveCustomBoundarySpacing,
  resolveCustomTraySizingMode,
} from "@/lib/custom-layout-math";
import type { ConstructedContouredFootprint } from "@/lib/contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import { getGridSlotGeometry } from "@/lib/grid-config";
import {
  getGridBoundarySpacingAxes,
  getGridSlotPitchAxes,
} from "@/lib/grid-layout-math";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import { buildSteppedOutlinePreview } from "@/lib/stepped-outline-preview";
import { getSteppedGroupMinBottomHeight } from "@/lib/stepped-base-hole";
import type { ConstructedSteppedContouredFootprints } from "@/lib/stepped-contoured-footprint";
import type { BaseHoleProjectedSlot } from "@/lib/base-hole-construction-plan";
import type { CustomLayoutParams, SteppedLayoutParams } from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import { calculateSteppedEffectiveDimensions } from "@/lib/stepped-layout-math";

export interface CustomBaseHoleAdapterOptions {
  readonly contouredState?: ContouredFootprintState<ConstructedContouredFootprint>;
}

export interface SteppedBaseHoleAdapterOptions {
  readonly contouredState?: ContouredFootprintState<ConstructedSteppedContouredFootprints>;
}

function isPointInRoundedRect(
  x: number,
  y: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  radius: number,
) {
  if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) {
    return false;
  }
  const safeRadius = Math.max(
    0,
    Math.min(radius, (bounds.maxX - bounds.minX) / 2, (bounds.maxY - bounds.minY) / 2),
  );
  const cx = Math.min(Math.max(x, bounds.minX + safeRadius), bounds.maxX - safeRadius);
  const cy = Math.min(Math.max(y, bounds.minY + safeRadius), bounds.maxY - safeRadius);
  return Math.hypot(x - cx, y - cy) <= safeRadius + 1e-6;
}

function isPointInPolygon(
  x: number,
  y: number,
  points: readonly { x: number; y: number }[],
) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[index];
    const b = points[previous];
    if (
      (a.y > y) !== (b.y > y) &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function circleFits(
  x: number,
  y: number,
  radius: number,
  containsPoint: (x: number, y: number) => boolean,
) {
  for (let index = 0; index < 48; index += 1) {
    const angle = (index / 48) * Math.PI * 2;
    if (!containsPoint(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)) {
      return false;
    }
  }
  return true;
}

function getBeveledRoundedRectCrossSection(input: {
  bottomBounds: { minX: number; maxX: number; minY: number; maxY: number };
  cornerRadius: number;
  sideBevelWidth: number;
  totalHeight: number;
  crossSectionHeight: number;
}) {
  const width = input.bottomBounds.maxX - input.bottomBounds.minX;
  const depth = input.bottomBounds.maxY - input.bottomBounds.minY;
  const safeBevelWidth = Math.max(
    0,
    Math.min(input.sideBevelWidth, width / 2 - 0.1, depth / 2 - 0.1),
  );
  const progress = input.totalHeight > 0
    ? Math.max(0, Math.min(1, input.crossSectionHeight / input.totalHeight))
    : 0;
  const inset = safeBevelWidth * progress;
  const effectiveRadius = Math.max(
    0,
    Math.min(input.cornerRadius, width / 2 - 0.01, depth / 2 - 0.01),
  );
  return {
    bounds: {
      minX: input.bottomBounds.minX + inset,
      maxX: input.bottomBounds.maxX - inset,
      minY: input.bottomBounds.minY + inset,
      maxY: input.bottomBounds.maxY - inset,
    },
    radius: Math.max(effectiveRadius - inset, 0),
  };
}

function polygonBounds(
  points: readonly { x: number; y: number }[],
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (points.length < 3) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

export const gridBaseHoleAdapter = {
  project(params: TrayParams): BaseHoleProjectedSlot[] {
    const slot = getGridSlotGeometry(params);
    const { pitchX, pitchY } = getGridSlotPitchAxes(params);
    const { boundarySpacingX, boundarySpacingY } = getGridBoundarySpacingAxes(params);
    const topWidth = 2 * boundarySpacingX +
      slot.slotWidth + (params.columns - 1) * pitchX;
    const topDepth = 2 * boundarySpacingY +
      slot.slotHeight + (params.rows - 1) * pitchY;
    const bevel = Math.max(0, params.sideBevelWidth);
    const crossSection = getBeveledRoundedRectCrossSection({
      bottomBounds: {
        minX: 0,
        maxX: topWidth + bevel * 2,
        minY: 0,
        maxY: topDepth + bevel * 2,
      },
      cornerRadius: params.cornerRadius,
      sideBevelWidth: bevel,
      totalHeight: params.basePlateOnly
        ? params.baseThickness
        : params.baseThickness + params.holeDepth,
      crossSectionHeight: params.baseThickness - BASE_HOLE_CONFIG.topWall,
    });
    const slots: BaseHoleProjectedSlot[] = [];
    for (let row = 0; row < params.rows; row += 1) {
      for (let column = 0; column < params.columns; column += 1) {
        const x = bevel + boundarySpacingX + slot.slotWidth / 2 +
          column * pitchX;
        const y = bevel + boundarySpacingY + slot.slotHeight / 2 +
          row * pitchY;
        slots.push({
          id: `grid-${row}-${column}`,
          shape: slot.shape,
          nominalWidth: slot.baseWidth,
          nominalHeight: slot.baseHeight,
          finalWidth: slot.slotWidth,
          finalHeight: slot.slotHeight,
          x: x - (topWidth + bevel * 2) / 2,
          y: y - (topDepth + bevel * 2) / 2,
          floorHeight: params.baseThickness,
          containsExpandedHole: (radius) => circleFits(
            x,
            y,
            radius,
            (pointX, pointY) => isPointInRoundedRect(
              pointX,
              pointY,
              crossSection.bounds,
              crossSection.radius,
            ),
          ),
        });
      }
    }
    return slots;
  },
};

export const customBaseHoleAdapter = {
  project(
    params: CustomLayoutParams,
    options: CustomBaseHoleAdapterOptions = {},
  ): BaseHoleProjectedSlot[] {
    const contouredState = options.contouredState ?? { status: "inactive" };
    const contoured = contouredState.status === "ready" ? contouredState.value : undefined;
    const footprint = calculateCustomTrayFootprint(params, contouredState);
    if (footprint.footprintStyle === "contoured") {
      if (!contoured) return [];
      return params.slots.map((slot) => {
        const profile = getFreeSlotProfileGeometry(slot);
        return {
          id: slot.id,
          shape: slot.shape,
          nominalWidth: slot.width,
          nominalHeight: slot.height,
          finalWidth: profile.width,
          finalHeight: profile.height,
          x: slot.x - ((contoured.bounds?.minX ?? 0) + (contoured.bounds?.maxX ?? 0)) / 2,
          y: slot.y - ((contoured.bounds?.minY ?? 0) + (contoured.bounds?.maxY ?? 0)) / 2,
          floorHeight: params.baseThickness,
          containsExpandedHole: (radius: number) =>
            contoured.containsExpandedCircle(slot.x, slot.y, radius),
        };
      });
    }

    const bevel = Math.max(0, params.sideBevelWidth);
    const boundary = resolveCustomBoundarySpacing(params);
    const fixed = resolveCustomTraySizingMode(params) === "fixed";
    const bottomBounds = fixed
      ? { minX: 0, maxX: params.trayWidth, minY: 0, maxY: params.trayDepth }
      : {
          minX: footprint.minX - boundary - bevel,
          maxX: footprint.maxX + boundary + bevel,
          minY: footprint.minY - boundary - bevel,
          maxY: footprint.maxY + boundary + bevel,
        };
    const crossSection = getBeveledRoundedRectCrossSection({
      bottomBounds,
      cornerRadius: params.cornerRadius,
      sideBevelWidth: bevel,
      totalHeight: params.baseThickness + params.holeDepth,
      crossSectionHeight: params.baseThickness - BASE_HOLE_CONFIG.topWall,
    });
    return params.slots.map((slot) => {
      const profile = getFreeSlotProfileGeometry(slot);
      return {
        id: slot.id,
        shape: slot.shape,
        nominalWidth: slot.width,
        nominalHeight: slot.height,
        finalWidth: profile.width,
        finalHeight: profile.height,
        x: slot.x - (fixed ? params.trayWidth / 2 : (footprint.minX + footprint.maxX) / 2),
        y: slot.y - (fixed ? params.trayDepth / 2 : (footprint.minY + footprint.maxY) / 2),
        floorHeight: params.baseThickness,
        containsExpandedHole: (radius: number) => circleFits(
          slot.x,
          slot.y,
          radius,
          (pointX, pointY) => isPointInRoundedRect(
            pointX,
            pointY,
            crossSection.bounds,
            crossSection.radius,
          ),
        ),
      };
    });
  },
};

export const steppedBaseHoleAdapter = {
  project(
    params: SteppedLayoutParams,
    options: SteppedBaseHoleAdapterOptions = {},
  ): BaseHoleProjectedSlot[] {
    const contouredState = options.contouredState ?? { status: "inactive" };
    const groupById = new Map(params.groups.map((group) => [group.id, group]));
    const isRectangular = params.footprintStyle === "rectangular";
    const outlines = isRectangular
      ? (buildSteppedOutlinePreview(params, contouredState) ?? [])
      : [];
    const contouredGroupById = new Map(
      !isRectangular && contouredState.status === "ready"
        ? contouredState.value.groups.map((group) => [group.groupId, group.footprint])
        : [],
    );
    const allHeights = params.groups.map((group) => Math.max(group.bottomHeight, 3));
    const lowestHeight = allHeights.length > 0 ? Math.min(...allHeights) : 0;
    const effective = calculateSteppedEffectiveDimensions(params, contouredState);
    const sourceCenterX = isRectangular && params.traySizingMode === "fixed"
      ? params.trayWidth / 2
      : (effective.minX + effective.maxX) / 2;
    const sourceCenterY = isRectangular && params.traySizingMode === "fixed"
      ? params.trayDepth / 2
      : (effective.minY + effective.maxY) / 2;

    return params.slots.map((slot) => {
      const profile = getFreeSlotProfileGeometry(slot);
      const groupOutlines = outlines.filter((outline) => outline.groupId === slot.groupId);
      const group = groupById.get(slot.groupId);
      const groupHeight = Math.max(
        group?.bottomHeight ?? 3,
        group ? getSteppedGroupMinBottomHeight(params, group.id) : 3,
        3,
      );
      const floorHeight = Math.max(
        groupHeight - Math.min(params.holeDepth, groupHeight),
        0,
      );
      const layerRadius = isRectangular && groupHeight <= lowestHeight + 1e-6
        ? (params.cornerRadius ?? 0)
        : 0;
      return {
        id: slot.id,
        shape: slot.shape,
        nominalWidth: slot.width,
        nominalHeight: slot.height,
        finalWidth: profile.width,
        finalHeight: profile.height,
        x: slot.x - sourceCenterX,
        y: slot.y - sourceCenterY,
        floorHeight,
        containsExpandedHole: isRectangular
          ? (radius: number) => circleFits(
              slot.x - sourceCenterX,
              slot.y - sourceCenterY,
              radius,
              (pointX, pointY) => groupOutlines.some((outline) => {
                const bounds = polygonBounds(outline.points);
                return bounds
                  ? isPointInRoundedRect(pointX, pointY, bounds, layerRadius)
                  : isPointInPolygon(pointX, pointY, outline.points);
              }),
            )
          : (radius: number) => contouredGroupById.get(slot.groupId)
              ?.containsExpandedCircle(slot.x, slot.y, radius) ?? false,
      };
    });
  },
};
