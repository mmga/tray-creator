import {
  MAX_BUILD_SIZE,
  SIMPLE_STEPPED_LAYOUT_DEFAULTS,
  getSlotTolerance,
} from "@/lib/config";
import type {
  SimpleSteppedLayoutParams,
  SimpleSteppedRowBand,
  SimpleSteppedSlot,
} from "@/types/custom-tray";

export interface SimpleSteppedSlotUpdate {
  id: string;
  x: number;
}

export interface SimpleSteppedDerivedSlot {
  id: string;
  rowId: string;
  shape: "circle";
  diameter: number;
  effectiveDiameter: number;
  localX: number;
  globalX: number;
  globalY: number;
  width: number;
  height: number;
  rotation: number;
}

export interface SimpleSteppedDerivedRow {
  id: string;
  name: string;
  index: number;
  slotIds: string[];
  slotCount: number;
  length: number;
  depth: number;
  maxDiameter: number;
  holeMinX: number;
  holeMaxX: number;
  holeCenterX: number;
  startY: number;
  centerY: number;
  topHeight: number;
  extraHeight: number;
  slots: SimpleSteppedDerivedSlot[];
}

export interface SimpleSteppedDerivedLayout {
  trayWidth: number;
  trayDepth: number;
  trayHeight: number;
  highestTopHeight: number;
  slotCount: number;
  activeRows: SimpleSteppedDerivedRow[];
  rowBands: SimpleSteppedRowBand[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getFallbackCanvasWidth(params: SimpleSteppedLayoutParams) {
  return isFiniteNumber(params.trayWidth) && params.trayWidth > 0
    ? params.trayWidth
    : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayWidth;
}

function getFallbackCanvasDepth(params: SimpleSteppedLayoutParams) {
  return isFiniteNumber(params.trayDepth) && params.trayDepth > 0
    ? params.trayDepth
    : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayDepth;
}

export function getSimpleSteppedEffectiveDiameter(slot: Pick<SimpleSteppedSlot, "diameter">) {
  return slot.diameter + getSlotTolerance(slot.diameter);
}

export function deriveSimpleSteppedLayout(
  params: SimpleSteppedLayoutParams,
  activeRowId?: string | null,
): SimpleSteppedDerivedLayout {
  const slotsByRowId = new Map<string, SimpleSteppedSlot[]>();
  params.slots.forEach((slot) => {
    const existing = slotsByRowId.get(slot.rowId);
    if (existing) {
      existing.push(slot);
    } else {
      slotsByRowId.set(slot.rowId, [slot]);
    }
  });

  const activeRowSeeds = params.rows
    .map((row) => {
      const rowSlots = slotsByRowId.get(row.id) ?? [];
      if (rowSlots.length === 0) {
        return null;
      }

      const slotsWithMetrics = rowSlots.map((slot) => {
        const effectiveDiameter = getSimpleSteppedEffectiveDiameter(slot);
        const half = effectiveDiameter / 2;
        return {
          slot,
          effectiveDiameter,
          half,
          left: slot.x - half,
          right: slot.x + half,
        };
      });

      const holeMinX = Math.min(...slotsWithMetrics.map((item) => item.left));
      const holeMaxX = Math.max(...slotsWithMetrics.map((item) => item.right));
      const holeCenterX = (holeMinX + holeMaxX) / 2;
      const rowHoleSpan = holeMaxX - holeMinX;
      const maxDiameter = Math.max(
        ...slotsWithMetrics.map((item) => item.effectiveDiameter),
      );

      return {
        id: row.id,
        name: row.name,
        slotIds: row.slotIds,
        rawSlots: slotsWithMetrics,
        holeMinX,
        holeMaxX,
        holeCenterX,
        length: rowHoleSpan + params.outerMargin * 2,
        depth: maxDiameter + params.outerMargin * 2,
        maxDiameter,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (activeRowSeeds.length === 0) {
    return {
      trayWidth: getFallbackCanvasWidth(params),
      trayDepth: getFallbackCanvasDepth(params),
      trayHeight: 0,
      highestTopHeight: 0,
      slotCount: 0,
      activeRows: [],
      rowBands: [],
    };
  }

  const trayWidth = Math.max(...activeRowSeeds.map((row) => row.length));
  const trayDepth =
    activeRowSeeds.reduce((sum, row) => sum + row.depth, 0) +
    Math.max(activeRowSeeds.length - 1, 0) * params.rowGap;

  let cursorY = 0;
  const activeRows: SimpleSteppedDerivedRow[] = activeRowSeeds.map((row, index) => {
    const startY = cursorY;
    const centerY = startY + row.depth / 2;
    const topHeight = (index + 1) * params.stepHeight;
    const extraHeight = index * params.stepHeight;

    const derivedSlots: SimpleSteppedDerivedSlot[] = row.rawSlots.map((item) => ({
      id: item.slot.id,
      rowId: item.slot.rowId,
      shape: "circle",
      diameter: item.slot.diameter,
      effectiveDiameter: item.effectiveDiameter,
      localX: item.slot.x,
      globalX: trayWidth / 2 + (item.slot.x - row.holeCenterX),
      globalY: centerY,
      width: item.effectiveDiameter,
      height: item.effectiveDiameter,
      rotation: 0,
    }));

    cursorY += row.depth + params.rowGap;

    return {
      id: row.id,
      name: row.name,
      index,
      slotIds: row.slotIds,
      slotCount: row.rawSlots.length,
      length: row.length,
      depth: row.depth,
      maxDiameter: row.maxDiameter,
      holeMinX: row.holeMinX,
      holeMaxX: row.holeMaxX,
      holeCenterX: row.holeCenterX,
      startY,
      centerY,
      topHeight,
      extraHeight,
      slots: derivedSlots,
    };
  });

  const rowBands: SimpleSteppedRowBand[] = activeRows.map((row) => ({
    id: row.id,
    name: row.name,
    x: trayWidth / 2 - row.length / 2,
    y: row.startY,
    width: row.length,
    depth: row.depth,
    topHeight: row.topHeight,
    isActive: activeRowId ? row.id === activeRowId : false,
  }));

  return {
    trayWidth,
    trayDepth,
    trayHeight: activeRows.length * params.stepHeight,
    highestTopHeight: activeRows[activeRows.length - 1]?.topHeight ?? 0,
    slotCount: params.slots.length,
    activeRows,
    rowBands,
  };
}

export function calculateSimpleSteppedDimensions(params: SimpleSteppedLayoutParams) {
  const derived = deriveSimpleSteppedLayout(params);
  return {
    width: derived.trayWidth,
    depth: derived.trayDepth,
    height: derived.trayHeight,
  };
}

export function buildSimpleSteppedRowBands(
  params: SimpleSteppedLayoutParams,
  activeRowId?: string | null,
) {
  return deriveSimpleSteppedLayout(params, activeRowId).rowBands;
}

export function clampSimpleSteppedSlotUpdates(
  params: SimpleSteppedLayoutParams,
  updates: SimpleSteppedSlotUpdate[],
  maxBuildSize: number = MAX_BUILD_SIZE,
) {
  const slotMap = new Map(params.slots.map((slot) => [slot.id, slot]));
  const deduped = new Map<string, SimpleSteppedSlotUpdate>();

  updates.forEach((update) => {
    const slot = slotMap.get(update.id);
    if (!slot || !isFiniteNumber(update.x)) {
      return;
    }

    const effectiveDiameter = getSimpleSteppedEffectiveDiameter(slot);
    const maxAbsX = Math.max(
      0,
      maxBuildSize / 2 - params.outerMargin - effectiveDiameter / 2,
    );

    deduped.set(update.id, {
      id: update.id,
      x: Math.max(-maxAbsX, Math.min(maxAbsX, update.x)),
    });
  });

  return updates
    .map((update) => deduped.get(update.id))
    .filter((update): update is SimpleSteppedSlotUpdate => Boolean(update));
}
