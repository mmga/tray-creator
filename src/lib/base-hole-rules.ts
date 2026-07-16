import {
  BASE_HOLE_CONFIG,
  getBaseHoleMinBaseThickness,
  getBaseHolePreset,
} from "@/lib/config";
import {
  MAGNET_POST_HOLE_BOTTOM_WALL,
  resolveMagneticBaseHolePreset,
} from "@/lib/base-hole-config";
export { resolveMagneticBaseHolePreset } from "@/lib/base-hole-config";
import {
  calculateCustomTrayFootprint,
  resolveCustomBoundarySpacing,
  resolveCustomTraySizingMode,
} from "@/lib/custom-layout-math";
import { getGridSlotGeometry } from "@/lib/grid-config";
import {
  getGridBoundarySpacingAxes,
  getGridSpacingAxes,
} from "@/lib/tray-model";
import { deriveSimpleSteppedLayout } from "@/lib/simple-stepped-layout";
import { buildSteppedOutlinePreview } from "@/lib/stepped-outline-preview";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import type {
  AppMode,
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type {
  BaseHoleParams,
  BaseHolePresetKey,
  TrayParams,
} from "@/types/tray";

export const MAGNETIC_BASE_HOLE_MIN_SIDE_WALL = 0.6;

export interface BaseHoleFitViolation {
  readonly kind: "magnetic-base-hole-fit" | "magnet-post-hole-fit";
  readonly slotIds: readonly string[];
  readonly message: string;
}

interface BaseHoleSlot {
  id: string;
  shape: "circle" | "ellipse" | "rectangle";
  nominalWidth: number;
  nominalHeight: number;
  finalWidth: number;
  finalHeight: number;
  x: number;
  y: number;
  floorHeight: number;
  containsExpandedHole: (radius: number) => boolean;
}

export function getRequiredBaseHoleSupportingThickness(
  params: Pick<
    BaseHoleParams,
    "baseHoleStructure" | "magnetPostHoleDepth"
  >,
): number {
  if (params.baseHoleStructure === "magnetic-base-hole") {
    return Math.max(
      getBaseHoleMinBaseThickness("25"),
      getBaseHoleMinBaseThickness("40"),
    );
  }
  if (params.baseHoleStructure === "magnet-post-hole") {
    return params.magnetPostHoleDepth + MAGNET_POST_HOLE_BOTTOM_WALL;
  }
  return 0;
}

export function applyFlatTrayBaseHoleSupportingThickness<
  P extends (TrayParams | CustomLayoutParams),
>(params: P): P {
  const required = getRequiredBaseHoleSupportingThickness(params);
  return params.baseThickness >= required
    ? params
    : { ...params, baseThickness: required };
}

export function applySimpleSteppedBaseHoleSupportingThickness(
  params: SimpleSteppedLayoutParams,
): SimpleSteppedLayoutParams {
  const requiredFirstRowHeight =
    params.holeDepth + getRequiredBaseHoleSupportingThickness(params);
  return params.firstRowHeight >= requiredFirstRowHeight
    ? params
    : { ...params, firstRowHeight: requiredFirstRowHeight };
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
    Math.min(
      input.sideBevelWidth,
      width / 2 - 0.1,
      depth / 2 - 0.1,
    ),
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

function buildGridSlots(params: TrayParams): BaseHoleSlot[] {
  const slot = getGridSlotGeometry(params);
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  const { boundarySpacingX, boundarySpacingY } = getGridBoundarySpacingAxes(params);
  const topWidth = 2 * boundarySpacingX +
    (params.columns - 1) * spacingX + params.columns * slot.slotWidth;
  const topDepth = 2 * boundarySpacingY +
    (params.rows - 1) * spacingY + params.rows * slot.slotHeight;
  const bevel = Math.max(0, params.sideBevelWidth);
  const totalWidth = topWidth + bevel * 2;
  const totalDepth = topDepth + bevel * 2;
  const crossSection = getBeveledRoundedRectCrossSection({
    bottomBounds: { minX: 0, maxX: totalWidth, minY: 0, maxY: totalDepth },
    cornerRadius: params.cornerRadius,
    sideBevelWidth: bevel,
    totalHeight: params.basePlateOnly
      ? params.baseThickness
      : params.baseThickness + params.holeDepth,
    crossSectionHeight: params.baseThickness - BASE_HOLE_CONFIG.topWall,
  });
  const slots: BaseHoleSlot[] = [];
  for (let row = 0; row < params.rows; row += 1) {
    for (let column = 0; column < params.columns; column += 1) {
      const x = bevel + boundarySpacingX + slot.slotWidth / 2 +
        column * (slot.slotWidth + spacingX);
      const y = bevel + boundarySpacingY + slot.slotHeight / 2 +
        row * (slot.slotHeight + spacingY);
      slots.push({
        id: `grid-${row}-${column}`,
        shape: slot.shape,
        nominalWidth: slot.baseWidth,
        nominalHeight: slot.baseHeight,
        finalWidth: slot.slotWidth,
        finalHeight: slot.slotHeight,
        x,
        y,
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
}

function buildCustomSlots(params: CustomLayoutParams): BaseHoleSlot[] {
  const footprint = calculateCustomTrayFootprint(params);
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
      x: slot.x,
      y: slot.y,
      floorHeight: params.baseThickness,
      containsExpandedHole: (radius) => circleFits(
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
    } satisfies BaseHoleSlot;
  });
}

function buildSimpleSteppedSlots(params: SimpleSteppedLayoutParams): BaseHoleSlot[] {
  const derived = deriveSimpleSteppedLayout(params);
  return derived.activeRows.flatMap((row) => row.slots.map((slot) => {
    const cavityTop = row.topHeight - params.holeDepth - BASE_HOLE_CONFIG.topWall;
    const usesRaisedBand = cavityTop > params.firstRowHeight + 1e-6;
    const bounds = usesRaisedBand
      ? {
          minX: (derived.trayWidth - row.length) / 2,
          maxX: (derived.trayWidth + row.length) / 2,
          minY: row.centerY - row.depth / 2,
          maxY: row.centerY + row.depth / 2,
        }
      : { minX: 0, maxX: derived.trayWidth, minY: 0, maxY: derived.trayDepth };
    return {
      id: slot.id,
      shape: "circle",
      nominalWidth: slot.diameter,
      nominalHeight: slot.diameter,
      finalWidth: slot.effectiveDiameter,
      finalHeight: slot.effectiveDiameter,
      x: slot.globalX,
      y: slot.globalY,
      floorHeight: row.topHeight - params.holeDepth,
      containsExpandedHole: (radius) => circleFits(
        slot.globalX,
        slot.globalY,
        radius,
        (pointX, pointY) => isPointInRoundedRect(
          pointX,
          pointY,
          bounds,
          usesRaisedBand ? 0 : params.cornerRadius,
        ),
      ),
    } satisfies BaseHoleSlot;
  }));
}

function buildSteppedSlots(params: SteppedLayoutParams): BaseHoleSlot[] {
  const outlines = buildSteppedOutlinePreview(params) ?? [];
  const groupById = new Map(params.groups.map((group) => [group.id, group]));
  return params.slots.map((slot) => {
    const profile = getFreeSlotProfileGeometry(slot);
    const groupOutlines = outlines.filter((outline) => outline.groupId === slot.groupId);
    const floorHeight = (groupById.get(slot.groupId)?.bottomHeight ?? params.holeDepth) - params.holeDepth;
    return {
      id: slot.id,
      shape: slot.shape,
      nominalWidth: slot.width,
      nominalHeight: slot.height,
      finalWidth: profile.width,
      finalHeight: profile.height,
      x: slot.x,
      y: slot.y,
      floorHeight,
      containsExpandedHole: (radius) => circleFits(
        slot.x,
        slot.y,
        radius,
        (pointX, pointY) => groupOutlines.some(
          (outline) => isPointInPolygon(pointX, pointY, outline.points),
        ),
      ),
    } satisfies BaseHoleSlot;
  });
}

function cavityInterval(slot: BaseHoleSlot, preset: BaseHolePresetKey) {
  const { depth } = getBaseHolePreset(preset);
  const top = slot.floorHeight - BASE_HOLE_CONFIG.topWall;
  return { bottom: top - depth, top };
}

function intervalsOverlap(
  left: { bottom: number; top: number },
  right: { bottom: number; top: number },
) {
  return left.bottom < right.top - 1e-6 && right.bottom < left.top - 1e-6;
}

function validateSlots(params: BaseHoleParams, slots: BaseHoleSlot[]) {
  if (params.baseHoleStructure === "none") return [];
  if (params.baseHoleStructure === "magnet-post-hole") {
    return slots
      .filter((slot) => params.magnetPostHoleDiameter > Math.min(slot.finalWidth, slot.finalHeight) + 1e-6)
      .map((slot): BaseHoleFitViolation => ({
        kind: "magnet-post-hole-fit",
        slotIds: [slot.id],
        message: `磁铁桩孔直径 ${params.magnetPostHoleDiameter}mm 超过槽位最短成品尺寸 ${Math.min(slot.finalWidth, slot.finalHeight).toFixed(1)}mm`,
      }));
  }

  const presets = new Map(slots.map((slot) => [
    slot.id,
    resolveMagneticBaseHolePreset(slot.shape, slot.nominalWidth, slot.nominalHeight),
  ]));
  const violations: BaseHoleFitViolation[] = [];
  for (const slot of slots) {
    const preset = presets.get(slot.id)!;
    const radius = getBaseHolePreset(preset).diameter / 2 + MAGNETIC_BASE_HOLE_MIN_SIDE_WALL;
    if (!slot.containsExpandedHole(radius)) {
      violations.push({
        kind: "magnetic-base-hole-fit",
        slotIds: [slot.id],
        message: `磁吸孔周围无法保留 ${MAGNETIC_BASE_HOLE_MIN_SIDE_WALL}mm 侧壁`,
      });
    }
  }
  for (let leftIndex = 0; leftIndex < slots.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < slots.length; rightIndex += 1) {
      const left = slots[leftIndex];
      const right = slots[rightIndex];
      const leftPreset = presets.get(left.id)!;
      const rightPreset = presets.get(right.id)!;
      if (!intervalsOverlap(cavityInterval(left, leftPreset), cavityInterval(right, rightPreset))) {
        continue;
      }
      const requiredDistance =
        getBaseHolePreset(leftPreset).diameter / 2 +
        getBaseHolePreset(rightPreset).diameter / 2 +
        MAGNETIC_BASE_HOLE_MIN_SIDE_WALL;
      if (Math.hypot(left.x - right.x, left.y - right.y) < requiredDistance - 1e-6) {
        violations.push({
          kind: "magnetic-base-hole-fit",
          slotIds: [left.id, right.id],
          message: `相邻磁吸孔之间无法保留 ${MAGNETIC_BASE_HOLE_MIN_SIDE_WALL}mm 隔墙`,
        });
      }
    }
  }
  return violations;
}

export function validateBaseHoleFit(
  mode: Exclude<AppMode, "base-converter">,
  params: TrayParams | CustomLayoutParams | SimpleSteppedLayoutParams | SteppedLayoutParams,
): BaseHoleFitViolation[] {
  switch (mode) {
    case "grid":
      return validateSlots(params as TrayParams, buildGridSlots(params as TrayParams));
    case "custom":
      return validateSlots(params as CustomLayoutParams, buildCustomSlots(params as CustomLayoutParams));
    case "simple-stepped":
      return validateSlots(params as SimpleSteppedLayoutParams, buildSimpleSteppedSlots(params as SimpleSteppedLayoutParams));
    case "stepped":
    case "stepped-cad":
      return validateSlots(params as SteppedLayoutParams, buildSteppedSlots(params as SteppedLayoutParams));
  }
}
