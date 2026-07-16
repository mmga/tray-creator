import type { FreeSlot } from "@/types/custom-tray";
import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";

const STEP = 0.2;

export type SymmetryAxisSource = "selection" | "tray";
export type SymmetryMode = "mirror-x" | "mirror-y";
export type SymmetrySlot = FreeSlot & { groupId?: string; rowId?: string };
export type SymmetryBoundsSlot = Pick<
  FreeSlot,
  | "x"
  | "y"
  | "width"
  | "height"
  | "rotation"
  | "shape"
  | "slotWidth"
  | "slotHeight"
  | "outerOffset"
  | "profileExponent"
>;

export interface SymmetryInsertSlot extends Omit<FreeSlot, "id"> {
  groupId?: string;
  rowId?: string;
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

export function getSlotBounds(
  slot: SymmetryBoundsSlot,
  ellipseProfileExponent?: number,
) {
  const profile = getFreeSlotProfileGeometry(slot);
  return getEllipseBoundingBox(
    profile.width,
    profile.height,
    slot.rotation,
    slot.shape,
    profile.profileExponent ?? ellipseProfileExponent,
    profile.outerOffset,
  );
}

export function getSelectionBounds(
  selected: SymmetryBoundsSlot[],
  ellipseProfileExponent?: number,
) {
  if (selected.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  selected.forEach((slot) => {
    const { halfW, halfH } = getSlotBounds(slot, ellipseProfileExponent);
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
  ellipseProfileExponent?: number,
) {
  if (axisSource === "tray") {
    return mode === "mirror-x" ? trayWidth / 2 : trayDepth / 2;
  }

  const bounds = getSelectionBounds(selected, ellipseProfileExponent);
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
      slotDefinitionId: mirrored.slotDefinitionId,
      slotWidth: mirrored.slotWidth,
      slotHeight: mirrored.slotHeight,
      rotation: mirrored.rotation,
      ...(mirrored.shape === "ellipse"
        ? {
            outerOffset: mirrored.outerOffset,
            profileExponent: mirrored.profileExponent,
          }
        : {}),
      ...(mirrored.groupId ? { groupId: mirrored.groupId } : {}),
      ...(mirrored.rowId ? { rowId: mirrored.rowId } : {}),
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
  ellipseProfileExponent?: number,
) {
  return slots.reduce((count, slot) => {
    const { halfW, halfH } = getSlotBounds(slot, ellipseProfileExponent);
    const isOutOfBounds =
      slot.x - halfW < 0 ||
      slot.x + halfW > trayWidth ||
      slot.y - halfH < 0 ||
      slot.y + halfH > trayDepth;

    return isOutOfBounds ? count + 1 : count;
  }, 0);
}

export interface SymmetryCheckSlot extends SymmetryBoundsSlot {
  id: string;
}

export interface SymmetryCheckResult {
  /** 整体是否关于指定轴对称 */
  symmetric: boolean;
  /** 成功配对的对称组数（落在轴上的自对称槽位不计入配对数） */
  matchedPairCount: number;
  /** 找不到镜像对应项的槽位 id */
  unmatchedIds: string[];
  /** 用于本次检查的对称轴数值 */
  axisValue: number;
}

/**
 * 检查给定槽位集合是否关于指定镜像轴对称。
 *
 * 配对规则：每个槽位期望存在一个镜像对应项，二者形状、尺寸一致，
 * 且位置/旋转在容差范围内满足镜像关系。落在轴上（镜像后位置不变）的槽位
 * 视为自对称，单独成对参与检查。
 */
export function checkLayoutSymmetry(
  slots: SymmetryCheckSlot[],
  trayWidth: number,
  trayDepth: number,
  axisSource: SymmetryAxisSource,
  mode: SymmetryMode,
): SymmetryCheckResult {
  const axisValue = resolveMirrorAxis(
    slots,
    trayWidth,
    trayDepth,
    axisSource,
    mode,
  );

  const EPSILON = 0.05;
  const within = (a: number, b: number) => Math.abs(a - b) < EPSILON;

  const mirrored = slots.map((slot) => {
    const mirror = mirrorSlot(slot, axisValue, mode);
    return { id: slot.id, expected: mirror };
  });

  const matched = new Set<string>();
  let pairCount = 0;

  for (let i = 0; i < slots.length; i += 1) {
    const current = slots[i];
    if (matched.has(current.id)) {
      continue;
    }

    const expected = mirrored[i].expected;
    const isOnAxis =
      within(expected.x, current.x) && within(expected.y, current.y);

    if (isOnAxis) {
      // 落在轴上的槽位：自身即对称，无需另找对应项
      matched.add(current.id);
      continue;
    }

    // 在尚未配对的槽位里寻找镜像对应项
    let partnerIndex = -1;
    for (let j = 0; j < slots.length; j += 1) {
      if (j === i || matched.has(slots[j].id)) {
        continue;
      }
      const candidate = slots[j];
      // 圆形槽位旋转视觉无差异，不参与对称判断；椭圆必须同步镜像角度
      const rotationMatches =
        current.shape === "circle" ||
        within(
          normalizeRotation(candidate.rotation),
          normalizeRotation(expected.rotation),
        );
      if (
        candidate.shape === current.shape &&
        within(candidate.width, current.width) &&
        within(candidate.height, current.height) &&
        within(candidate.x, expected.x) &&
        within(candidate.y, expected.y) &&
        rotationMatches
      ) {
        partnerIndex = j;
        break;
      }
    }

    if (partnerIndex === -1) {
      continue;
    }

    matched.add(current.id);
    matched.add(slots[partnerIndex].id);
    pairCount += 1;
  }

  const unmatchedIds = slots
    .filter((slot) => !matched.has(slot.id))
    .map((slot) => slot.id);

  return {
    symmetric: unmatchedIds.length === 0,
    matchedPairCount: pairCount,
    unmatchedIds,
    axisValue,
  };
}
