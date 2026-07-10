import { buildCanvasCollisionState } from "@/lib/canvas-collision-model";
import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import {
  calculateFixedCustomTrayUsableArea,
  isCustomSlotWithinFixedTrayUsableArea,
  resolveCustomTraySizingMode,
} from "@/lib/custom-layout-math";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import { RENDER_CONFIG } from "@/lib/config";
import type { CustomSlotUpdate } from "@/lib/custom-layout-actions";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";

const MAX_LAYOUT_ATTEMPTS = 30;
const MAX_CANDIDATES_PER_SLOT = 500;
const POSITION_PRECISION = 10;

export type RandomSlotArrangementResult =
  | {
      status: "success";
      updates: CustomSlotUpdate[];
    }
  | {
      status: "failed";
    };

interface IndexedSlot {
  index: number;
  slot: FreeSlot;
  footprintArea: number;
}

function roundPosition(value: number): number {
  return Math.round(value * POSITION_PRECISION) / POSITION_PRECISION;
}

function normalizeRandomValue(random: () => number): number {
  return Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
}

function calculateSlotFootprintArea(slot: FreeSlot): number {
  const profile = getFreeSlotProfileGeometry(slot);
  const points = sampleSlotProfilePoints(
    profile.width,
    profile.height,
    slot.shape,
    profile.outerOffset,
    RENDER_CONFIG.cylinderSegments,
    profile.profileExponent,
  );

  return Math.abs(
    points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length];
      return area + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
}

function sortSlotsByFootprint(slots: FreeSlot[]): IndexedSlot[] {
  return slots
    .map((slot, index) => ({
      index,
      slot,
      footprintArea: calculateSlotFootprintArea(slot),
    }))
    .sort(
      (left, right) =>
        right.footprintArea - left.footprintArea || left.index - right.index,
    );
}

function createRandomCandidate(
  slot: FreeSlot,
  params: CustomLayoutParams,
  random: () => number,
): FreeSlot | null {
  const area = calculateFixedCustomTrayUsableArea(params);
  const profile = getFreeSlotProfileGeometry(slot);
  const { halfW, halfH } = getEllipseBoundingBox(
    profile.width,
    profile.height,
    slot.rotation,
    slot.shape,
    profile.profileExponent,
    profile.outerOffset,
  );
  const minX = area.x + halfW;
  const maxX = area.x + area.width - halfW;
  const minY = area.y + halfH;
  const maxY = area.y + area.depth - halfH;

  if (minX > maxX || minY > maxY) {
    return null;
  }

  return {
    ...slot,
    x: roundPosition(minX + (maxX - minX) * normalizeRandomValue(random)),
    y: roundPosition(minY + (maxY - minY) * normalizeRandomValue(random)),
  };
}

function canPlaceCandidate(
  candidate: FreeSlot,
  placedSlots: FreeSlot[],
  params: CustomLayoutParams,
): boolean {
  const area = calculateFixedCustomTrayUsableArea(params);
  if (!isCustomSlotWithinFixedTrayUsableArea(candidate, area)) {
    return false;
  }

  const collision = buildCanvasCollisionState(
    [...placedSlots, candidate],
    params.spacing,
  );
  return collision.collisionMap.get(candidate.id)?.overlapIds.length === 0;
}

function toUpdates(
  slots: FreeSlot[],
  placedSlots: FreeSlot[],
): CustomSlotUpdate[] {
  const placedById = new Map(placedSlots.map((slot) => [slot.id, slot]));
  return slots.map((slot) => {
    const placed = placedById.get(slot.id);
    if (!placed) {
      throw new Error(`随机排版缺少凹槽：${slot.id}`);
    }

    return {
      id: slot.id,
      x: placed.x,
      y: placed.y,
    };
  });
}

export function randomizeCustomSlotArrangement(
  params: CustomLayoutParams,
  random: () => number = Math.random,
): RandomSlotArrangementResult {
  if (
    resolveCustomTraySizingMode(params) !== "fixed" ||
    params.slots.length === 0
  ) {
    return { status: "failed" };
  }

  const orderedSlots = sortSlotsByFootprint(params.slots);

  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt += 1) {
    const placedSlots: FreeSlot[] = [];
    let completed = true;

    for (const { slot } of orderedSlots) {
      let placed: FreeSlot | null = null;

      for (
        let candidateAttempt = 0;
        candidateAttempt < MAX_CANDIDATES_PER_SLOT;
        candidateAttempt += 1
      ) {
        const candidate = createRandomCandidate(slot, params, random);
        if (candidate && canPlaceCandidate(candidate, placedSlots, params)) {
          placed = candidate;
          break;
        }
      }

      if (!placed) {
        completed = false;
        break;
      }

      placedSlots.push(placed);
    }

    if (completed) {
      return {
        status: "success",
        updates: toUpdates(params.slots, placedSlots),
      };
    }
  }

  return { status: "failed" };
}
