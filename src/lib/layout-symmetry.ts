import type { FreeSlot } from "@/types/custom-tray";
import { getSlotOuterOffset } from "@/lib/config";

const STEP = 0.2;

export type SymmetryAxisSource = "selection" | "tray";
export type SymmetryMode = "mirror-x" | "mirror-y";
export type SymmetrySlot = FreeSlot & { groupId?: string };
export type SymmetryBoundsSlot = Pick<
  FreeSlot,
  "x" | "y" | "width" | "height" | "rotation" | "shape"
>;

export interface SymmetryInsertSlot extends Omit<FreeSlot, "id"> {
  groupId?: string;
}

export interface SlotPositionUpdate {
  id: string;
  x: number;
  y: number;
  rotation?: number;
}

export function roundToStep(value: number) {
  return Math.round(value / STEP) * STEP;
}

function normalizeRotation(value: number) {
  const normalized = ((((value + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
}

export function getSlotBounds(slot: SymmetryBoundsSlot) {
  const rad = ((slot.rotation || 0) * Math.PI) / 180;
  const a = slot.width / 2;
  const b = slot.height / 2;
  const offset = getSlotOuterOffset(slot.width, slot.height, slot.shape);

  return {
    halfW:
      Math.sqrt((a * Math.cos(rad)) ** 2 + (b * Math.sin(rad)) ** 2) + offset,
    halfH:
      Math.sqrt((a * Math.sin(rad)) ** 2 + (b * Math.cos(rad)) ** 2) + offset,
  };
}

export function getSelectionBounds(selected: SymmetryBoundsSlot[]) {
  if (selected.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  selected.forEach((slot) => {
    const { halfW, halfH } = getSlotBounds(slot);
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  });

  return { minX, maxX, minY, maxY };
}

export function resolveMirrorAxis(
  selected: FreeSlot[],
  trayWidth: number,
  trayDepth: number,
  axisSource: SymmetryAxisSource,
  mode: SymmetryMode,
) {
  if (axisSource === "tray") {
    return mode === "mirror-x" ? trayWidth / 2 : trayDepth / 2;
  }

  const bounds = getSelectionBounds(selected);
  if (!bounds) {
    return mode === "mirror-x" ? trayWidth / 2 : trayDepth / 2;
  }

  return mode === "mirror-x"
    ? (bounds.minX + bounds.maxX) / 2
    : (bounds.minY + bounds.maxY) / 2;
}

export function mirrorSlot(
  slot: SymmetrySlot,
  axisValue: number,
  mode: SymmetryMode,
) {
  if (mode === "mirror-x") {
    return {
      ...slot,
      x: roundToStep(2 * axisValue - slot.x),
      rotation: normalizeRotation(180 - slot.rotation),
    };
  }

  return {
    ...slot,
    y: roundToStep(2 * axisValue - slot.y),
    rotation: normalizeRotation(-slot.rotation),
  };
}

export function buildMirrorInsertSlots(
  selected: SymmetrySlot[],
  trayWidth: number,
  trayDepth: number,
  axisSource: SymmetryAxisSource,
  mode: SymmetryMode,
): SymmetryInsertSlot[] {
  const axisValue = resolveMirrorAxis(
    selected,
    trayWidth,
    trayDepth,
    axisSource,
    mode,
  );

  return selected.map((slot) => {
    const mirrored = mirrorSlot(slot, axisValue, mode);
    return {
      x: mirrored.x,
      y: mirrored.y,
      shape: mirrored.shape,
      width: mirrored.width,
      height: mirrored.height,
      rotation: mirrored.rotation,
      ...(mirrored.groupId ? { groupId: mirrored.groupId } : {}),
    };
  });
}

export function buildMirrorMoveUpdates(
  selected: SymmetrySlot[],
  trayWidth: number,
  trayDepth: number,
  axisSource: SymmetryAxisSource,
  mode: SymmetryMode,
): SlotPositionUpdate[] {
  const axisValue = resolveMirrorAxis(
    selected,
    trayWidth,
    trayDepth,
    axisSource,
    mode,
  );

  return selected.map((slot) => {
    const mirrored = mirrorSlot(slot, axisValue, mode);
    return {
      id: slot.id,
      x: mirrored.x,
      y: mirrored.y,
      rotation: mirrored.rotation,
    };
  });
}

export function countOutOfBoundsSlots(
  slots: SymmetryBoundsSlot[],
  trayWidth: number,
  trayDepth: number,
) {
  return slots.reduce((count, slot) => {
    const { halfW, halfH } = getSlotBounds(slot);
    const isOutOfBounds =
      slot.x - halfW < 0 ||
      slot.x + halfW > trayWidth ||
      slot.y - halfH < 0 ||
      slot.y + halfH > trayDepth;

    return isOutOfBounds ? count + 1 : count;
  }, 0);
}
