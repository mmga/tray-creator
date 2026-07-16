import type { CanvasSlotUpdate } from "@/lib/canvas-types";
import {
  deriveSimpleSteppedLayout,
  type SimpleSteppedSlotUpdate,
} from "@/lib/simple-stepped-layout";
import type {
  SimpleSteppedLayoutParams,
  SimpleSteppedRow,
  SimpleSteppedSlot,
} from "@/types/custom-tray";
import { MAX_BUILD_SIZE } from "@/lib/config";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import { normalizeSimpleSteppedSlotInstanceSnapshot } from "@/lib/slot-instance-factory";
import { normalizeBaseHoleParams } from "@/lib/base-hole-config";

export {
  buildSimpleSteppedRowBands,
  calculateSimpleSteppedDimensions,
  calculateSimpleSteppedMinimumTraySize,
  clampSimpleSteppedSlotUpdates,
  deriveSimpleSteppedLayout,
  getSimpleSteppedEffectiveDiameter,
  getSimpleSteppedMaxLocalYOffset,
  type SimpleSteppedDerivedLayout,
  type SimpleSteppedDerivedRow,
  type SimpleSteppedDerivedSlot,
  type SimpleSteppedSlotUpdate,
} from "@/lib/simple-stepped-layout";
import { calculateSimpleSteppedMinimumTraySize } from "@/lib/simple-stepped-layout";

export function normalizeSimpleSteppedTraySize(
  requestedSize: number,
  minimumSize: number,
  fallbackSize: number,
) {
  const safeRequestedSize =
    Number.isFinite(requestedSize) && requestedSize > 0
      ? requestedSize
      : fallbackSize;

  if (minimumSize > MAX_BUILD_SIZE) {
    return Math.max(safeRequestedSize, minimumSize);
  }

  return Math.min(
    Math.max(safeRequestedSize, minimumSize),
    MAX_BUILD_SIZE,
  );
}

function rebuildRowSlotIds(
  rows: SimpleSteppedRow[],
  slots: SimpleSteppedSlot[],
): SimpleSteppedRow[] {
  return rows.map((row) => ({
    ...row,
    slotIds: slots.filter((slot) => slot.rowId === row.id).map((slot) => slot.id),
  }));
}

/**
 * 规范化 simple-stepped 参数：重建 row.slotIds、归一化 slot.y、
 * 同步 outerMargin、clamp tray 尺寸到 [最小尺寸, MAX_BUILD_SIZE]。
 */
export function normalizeSimpleSteppedParams(
  next: SimpleSteppedLayoutParams,
): SimpleSteppedLayoutParams {
  const current = { ...next } as SimpleSteppedLayoutParams & {
    enableBaseHole?: boolean;
  };
  const baseHoleParams = normalizeBaseHoleParams(
    current as unknown as Record<string, unknown>,
    "none",
  );
  delete current.enableBaseHole;
  const rows = current.rows.length > 0
    ? current.rows
    : current.slots.length > 0
      ? [
          {
            id: crypto.randomUUID(),
            name: "行 1",
            slotIds: [],
          },
        ]
      : [];
  const rowIds = new Set(rows.map((row) => row.id));
  const fallbackRowId = rows[0]?.id ?? "";
  const normalizedSlots = current.slots.map((slot) =>
    normalizeSimpleSteppedSlotInstanceSnapshot({
      ...slot,
      rowId: rowIds.has(slot.rowId) ? slot.rowId : fallbackRowId,
      shape: "circle",
      y: Number.isFinite(slot.y) ? slot.y : 0,
    }),
  );
  const rebuiltRows = rebuildRowSlotIds(rows, normalizedSlots);
  const withRowIds: SimpleSteppedLayoutParams = {
    ...current,
    ...baseHoleParams,
    rows: rebuiltRows,
    slots: normalizedSlots,
    outerMarginIndependent: Boolean(current.outerMarginIndependent),
    outerMargin: current.outerMarginIndependent
      ? current.outerMargin
      : current.spacing,
  };
  const minimumDims = calculateSimpleSteppedMinimumTraySize(withRowIds);
  const fallbackWidth =
    Number.isFinite(withRowIds.trayWidth) && withRowIds.trayWidth > 0
      ? withRowIds.trayWidth
      : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayWidth;
  const fallbackDepth =
    Number.isFinite(withRowIds.trayDepth) && withRowIds.trayDepth > 0
      ? withRowIds.trayDepth
      : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayDepth;

  return {
    ...withRowIds,
    trayWidth: normalizeSimpleSteppedTraySize(
      withRowIds.trayWidth,
      minimumDims.width,
      fallbackWidth,
    ),
    trayDepth: normalizeSimpleSteppedTraySize(
      withRowIds.trayDepth,
      minimumDims.depth,
      fallbackDepth,
    ),
  };
}

export function mapSimpleSteppedCanvasUpdatesToLocal(
  params: SimpleSteppedLayoutParams,
  updates: CanvasSlotUpdate[],
): SimpleSteppedSlotUpdate[] {
  const derived = deriveSimpleSteppedLayout(params);
  const rowById = new Map(
    derived.activeRows.map((row) => [row.id, row] as const),
  );
  const slotById = new Map(params.slots.map((slot) => [slot.id, slot] as const));

  return updates
    .map((update) => {
      const slot = slotById.get(update.id);
      if (!slot) {
        return null;
      }
      const row = rowById.get(slot.rowId);
      if (!row) {
        return null;
      }

      return {
        id: update.id,
        x: update.x - derived.trayWidth / 2 + row.holeCenterX,
        y: update.y - row.centerY,
      };
    })
    .filter((update): update is SimpleSteppedSlotUpdate => Boolean(update));
}

export function resolveSimpleSteppedSlotMoveScope(
  params: SimpleSteppedLayoutParams,
  draggingId: string,
  selectedIds: string[],
) {
  const draggingSlot = params.slots.find((slot) => slot.id === draggingId);
  if (!draggingSlot) {
    return [];
  }

  const sameRowSelected = selectedIds.filter((id) => {
    const slot = params.slots.find((candidate) => candidate.id === id);
    return slot?.rowId === draggingSlot.rowId;
  });

  if (sameRowSelected.length > 0) {
    return sameRowSelected;
  }

  return [draggingId];
}
