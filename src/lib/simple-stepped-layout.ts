import { getLegacyCircleSlotDiameter } from "@/lib/slot-definitions";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import type {
  SimpleSteppedLayoutParams,
  SimpleSteppedSlot,
} from "@/types/custom-tray";

export interface SimpleSteppedDerivedSlot {
  id: string;
  rowId: string;
  shape: "circle";
  diameter: number;
  effectiveDiameter: number;
  localX: number;
  localY: number;
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
  minimumTrayWidth: number;
  minimumTrayDepth: number;
  trayHeight: number;
  highestTopHeight: number;
  slotCount: number;
  activeRows: SimpleSteppedDerivedRow[];
}

interface SimpleSteppedRowSeed {
  id: string;
  name: string;
  slotIds: string[];
  rawSlots: Array<{
    slot: SimpleSteppedSlot;
    effectiveDiameter: number;
    half: number;
    left: number;
    right: number;
  }>;
  holeMinX: number;
  holeMaxX: number;
  holeCenterX: number;
  length: number;
  depth: number;
  maxDiameter: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getStoredTrayWidth(params: SimpleSteppedLayoutParams) {
  return isFiniteNumber(params.trayWidth) && params.trayWidth > 0
    ? params.trayWidth
    : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayWidth;
}

function getStoredTrayDepth(params: SimpleSteppedLayoutParams) {
  return isFiniteNumber(params.trayDepth) && params.trayDepth > 0
    ? params.trayDepth
    : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayDepth;
}

function getEffectiveOuterMargin(params: SimpleSteppedLayoutParams) {
  return params.outerMarginIndependent ? params.outerMargin : params.spacing;
}

function buildActiveRowSeeds(
  params: SimpleSteppedLayoutParams,
): SimpleSteppedRowSeed[] {
  const outerMargin = getEffectiveOuterMargin(params);
  const slotsByRowId = new Map<string, SimpleSteppedSlot[]>();
  params.slots.forEach((slot) => {
    const existing = slotsByRowId.get(slot.rowId);
    if (existing) {
      existing.push(slot);
    } else {
      slotsByRowId.set(slot.rowId, [slot]);
    }
  });

  return params.rows
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
        length: rowHoleSpan + outerMargin * 2,
        depth: maxDiameter + outerMargin * 2,
        maxDiameter,
      };
    })
    .filter((row): row is SimpleSteppedRowSeed => Boolean(row));
}

export function getSimpleSteppedEffectiveDiameter(
  slot: Pick<SimpleSteppedSlot, "diameter" | "effectiveDiameter">,
) {
  return typeof slot.effectiveDiameter === "number" &&
    Number.isFinite(slot.effectiveDiameter)
    ? slot.effectiveDiameter
    : getLegacyCircleSlotDiameter(slot.diameter);
}

export function calculateSimpleSteppedMinimumTraySize(
  params: SimpleSteppedLayoutParams,
) {
  const activeRowSeeds = buildActiveRowSeeds(params);
  if (activeRowSeeds.length === 0) {
    return { width: 0, depth: 0 };
  }

  return {
    width: Math.max(...activeRowSeeds.map((row) => row.length)),
    depth:
      activeRowSeeds.reduce((sum, row) => sum + row.depth, 0) +
      Math.max(activeRowSeeds.length - 1, 0) * params.rowGap,
  };
}

export function deriveSimpleSteppedLayout(
  params: SimpleSteppedLayoutParams,
): SimpleSteppedDerivedLayout {
  const activeRowSeeds = buildActiveRowSeeds(params);
  const storedTrayWidth = getStoredTrayWidth(params);
  const storedTrayDepth = getStoredTrayDepth(params);

  if (activeRowSeeds.length === 0) {
    return {
      trayWidth: storedTrayWidth,
      trayDepth: storedTrayDepth,
      minimumTrayWidth: 0,
      minimumTrayDepth: 0,
      trayHeight: 0,
      highestTopHeight: 0,
      slotCount: 0,
      activeRows: [],
    };
  }

  const minimumTrayWidth = Math.max(...activeRowSeeds.map((row) => row.length));
  const minimumTrayDepth =
    activeRowSeeds.reduce((sum, row) => sum + row.depth, 0) +
    Math.max(activeRowSeeds.length - 1, 0) * params.rowGap;
  const trayWidth = Math.max(storedTrayWidth, minimumTrayWidth);
  const trayDepth = Math.max(storedTrayDepth, minimumTrayDepth);

  let cursorY = 0;
  const activeRows: SimpleSteppedDerivedRow[] = activeRowSeeds.map((row, index) => {
    const startY = cursorY;
    const centerY = startY + row.depth / 2;
    const topHeight = params.firstRowHeight + index * params.stepHeight;
    const extraHeight = index * params.stepHeight;

    const derivedSlots: SimpleSteppedDerivedSlot[] = row.rawSlots.map((item) => ({
      id: item.slot.id,
      rowId: item.slot.rowId,
      shape: "circle",
      diameter: item.slot.diameter,
      effectiveDiameter: item.effectiveDiameter,
      localX: item.slot.x,
      localY: item.slot.y,
      globalX: trayWidth / 2 + (item.slot.x - row.holeCenterX),
      globalY: centerY + item.slot.y,
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
      length: minimumTrayWidth,
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

  return {
    trayWidth,
    trayDepth,
    minimumTrayWidth,
    minimumTrayDepth,
    trayHeight:
      params.firstRowHeight +
      Math.max(activeRows.length - 1, 0) * params.stepHeight,
    highestTopHeight: activeRows[activeRows.length - 1]?.topHeight ?? 0,
    slotCount: params.slots.length,
    activeRows,
  };
}

export function calculateSimpleSteppedDimensions(
  params: SimpleSteppedLayoutParams,
) {
  const derived = deriveSimpleSteppedLayout(params);
  return {
    width: derived.trayWidth,
    depth: derived.trayDepth,
    height: derived.trayHeight,
  };
}
