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
  calculateCustomContouredFootprint,
  calculateCustomTrayFootprint,
  resolveCustomBoundarySpacing,
  resolveCustomTraySizingMode,
} from "@/lib/custom-layout-math";
import { geometries } from "@jscad/modeling";
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
import type { Geom2 } from "@jscad/modeling/src/geometries/types";

const { geom2 } = geometries;

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

  // contoured 分支：按各 contoured body 的外缘多边形评估磁吸孔（CONTEXT:629）
  if (footprint.footprintStyle === "contoured") {
    const contoured = calculateCustomContouredFootprint(params);
    const bodiesPoints = contoured.bodies
      .map((body) => getLargestOutlinePoints(body))
      .filter((item): item is { x: number; y: number }[] => item !== null);

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
          (pointX, pointY) => bodiesPoints.some(
            (points) => isPointInPolygon(pointX, pointY, points),
          ),
        ),
      } satisfies BaseHoleSlot;
    });
  }

  // rectangular 分支：保持原有矩形截面校验
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

/**
 * 从 Geom2 提取面积最大的外轮廓点列，供多边形包含判定使用。
 * 与 stepped-outline-preview.ts 的 getLargestOutlinePoints 等价。
 */
function getLargestOutlinePoints(footprint: Geom2): { x: number; y: number }[] | null {
  const outlines = geom2.toOutlines(footprint);
  let largest: [number, number][] | null = null;
  let largestArea = 0;

  for (const outline of outlines) {
    let area = 0;
    for (let index = 0; index < outline.length; index += 1) {
      const next = outline[(index + 1) % outline.length];
      area += outline[index][0] * next[1] - next[0] * outline[index][1];
    }
    const absoluteArea = Math.abs(area / 2);
    if (absoluteArea > largestArea) {
      largest = outline;
      largestArea = absoluteArea;
    }
  }

  return largest?.map(([x, y]) => ({ x, y })) ?? null;
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
  // rectangular 时所有 outline 都是矩形（含最低层圆角），可用 isPointInRoundedRect 优化
  // contoured 时 outline 是任意多边形，用 isPointInPolygon
  const isRectangular = params.footprintStyle === "rectangular";

  // 计算最低 columnHeight 用于区分最低层（rectangular 时仅最低层应用 cornerRadius）
  const allHeights = params.groups.map((g) => Math.max(g.bottomHeight, 3));
  const lowestHeight = allHeights.length > 0 ? Math.min(...allHeights) : 0;

  return params.slots.map((slot) => {
    const profile = getFreeSlotProfileGeometry(slot);
    const groupOutlines = outlines.filter((outline) => outline.groupId === slot.groupId);
    const groupHeight = groupById.get(slot.groupId)?.bottomHeight ?? params.holeDepth;
    const floorHeight = groupHeight - params.holeDepth;
    const isLowestLayer = groupHeight <= lowestHeight + 1e-6;
    // rectangular 仅最低层用 cornerRadius（CONTEXT:601），更高层直角
    const layerRadius = isRectangular && isLowestLayer ? (params.cornerRadius ?? 0) : 0;

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
        isRectangular
          ? (pointX: number, pointY: number) =>
              groupOutlines.some((outline) => {
                const bounds = polygonBounds(outline.points);
                return bounds
                  ? isPointInRoundedRect(pointX, pointY, bounds, layerRadius)
                  : isPointInPolygon(pointX, pointY, outline.points);
              })
          : (pointX: number, pointY: number) =>
              groupOutlines.some((outline) =>
                isPointInPolygon(pointX, pointY, outline.points),
              ),
      ),
    } satisfies BaseHoleSlot;
  });
}

/** 从矩形多边形点列提取轴对齐 bounds；非矩形时返回 null 回退到多边形判定 */
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

function buildSlotsForMode(
  mode: Exclude<AppMode, "base-converter">,
  params: TrayParams | CustomLayoutParams | SimpleSteppedLayoutParams | SteppedLayoutParams,
): BaseHoleSlot[] {
  switch (mode) {
    case "grid":
      return buildGridSlots(params as TrayParams);
    case "custom":
      return buildCustomSlots(params as CustomLayoutParams);
    case "simple-stepped":
      return buildSimpleSteppedSlots(params as SimpleSteppedLayoutParams);
    case "stepped":
      return buildSteppedSlots(params as SteppedLayoutParams);
  }
}

export function getResolvedMagneticBaseHolePresets(
  mode: Exclude<AppMode, "base-converter">,
  params: TrayParams | CustomLayoutParams | SimpleSteppedLayoutParams | SteppedLayoutParams,
): BaseHolePresetKey[] {
  let presets: Set<BaseHolePresetKey>;
  if (mode === "grid") {
    const slot = getGridSlotGeometry(params as TrayParams);
    presets = new Set([
      resolveMagneticBaseHolePreset(
        slot.shape,
        slot.baseWidth,
        slot.baseHeight,
      ),
    ]);
  } else if (mode === "simple-stepped") {
    presets = new Set(
      (params as SimpleSteppedLayoutParams).slots.map((slot) =>
        resolveMagneticBaseHolePreset(
          "circle",
          slot.diameter,
          slot.diameter,
        )
      ),
    );
  } else {
    presets = new Set(
      (params as CustomLayoutParams | SteppedLayoutParams).slots.map((slot) =>
        resolveMagneticBaseHolePreset(
          slot.shape,
          slot.width,
          slot.height,
        )
      ),
    );
  }
  return presets.size > 0 ? [...presets].sort() : [BASE_HOLE_CONFIG.defaultPreset];
}

export function getBaseHoleFitBlockingReason(
  violations: readonly BaseHoleFitViolation[],
): string | null {
  if (violations.length === 0) return null;
  const remaining = violations.length - 1;
  return `底板孔位不适配：${violations[0].message}${remaining > 0 ? `（另有 ${remaining} 项）` : ""}`;
}

export function validateBaseHoleFit(
  mode: Exclude<AppMode, "base-converter">,
  params: TrayParams | CustomLayoutParams | SimpleSteppedLayoutParams | SteppedLayoutParams,
): BaseHoleFitViolation[] {
  return validateSlots(params, buildSlotsForMode(mode, params));
}
