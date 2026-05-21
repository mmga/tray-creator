import type { CanvasSlotUpdate } from "@/lib/canvas-types";
import {
  deriveSimpleSteppedLayout,
  type SimpleSteppedSlotUpdate,
} from "@/lib/simple-stepped-layout";
import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";

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
