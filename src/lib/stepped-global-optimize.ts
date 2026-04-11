import { getSlotTolerance, MAX_BUILD_SIZE } from "@/lib/config";
import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";
import { buildSteppedBridgeWarning } from "@/lib/stepped-bridge-warning";
import {
  calculateSteppedEffectiveDimensions,
} from "@/lib/stepped-layout-math";
import { trimSteppedBaseplate } from "@/lib/stepped-layout-slot-actions";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";

const COMPACTION_ITERATIONS = 8;
const SEARCH_STEP = 0.2;

type ProposalKind = "compact" | "grouped" | "minimal-move";

interface ProposalSeed {
  kind: ProposalKind;
  label: string;
  description: string;
  slots: SteppedSlot[];
}

interface SlotGeometry {
  halfW: number;
  halfH: number;
  effectiveHalfW: number;
  effectiveHalfH: number;
  margin: number;
}

export interface SteppedOptimizationMetrics {
  width: number;
  depth: number;
  area: number;
  displacement: number;
  hasBridgeWarning: boolean;
  isOversized: boolean;
}

export interface SteppedOptimizationProposal {
  id: ProposalKind;
  kind: ProposalKind;
  label: string;
  description: string;
  params: SteppedLayoutParams;
  metrics: SteppedOptimizationMetrics;
}

function getSlotGeometry(slot: SteppedSlot, spacing: number): SlotGeometry {
  const margin = spacing / 2 + getSlotTolerance(slot.width) / 2;
  const { halfW, halfH } = getEllipseBoundingBox(
    slot.width,
    slot.height,
    slot.rotation,
  );

  return {
    halfW,
    halfH,
    effectiveHalfW: halfW + margin,
    effectiveHalfH: halfH + margin,
    margin,
  };
}

function roundToStep(value: number): number {
  return Number((Math.round(value / SEARCH_STEP) * SEARCH_STEP).toFixed(3));
}

function normalizeSlotsToOrigin(
  slots: SteppedSlot[],
  spacing: number,
): SteppedSlot[] {
  if (slots.length === 0) {
    return slots;
  }

  let minLeft = Infinity;
  let minBottom = Infinity;
  const geometryById = new Map(
    slots.map((slot) => [slot.id, getSlotGeometry(slot, spacing)] as const),
  );

  slots.forEach((slot) => {
    const geometry = geometryById.get(slot.id);
    if (!geometry) {
      return;
    }

    minLeft = Math.min(minLeft, slot.x - geometry.halfW);
    minBottom = Math.min(minBottom, slot.y - geometry.halfH);
  });

  return slots.map((slot) => ({
    ...slot,
    x: roundToStep(slot.x - minLeft),
    y: roundToStep(slot.y - minBottom),
  }));
}

function sortSlotsByEffectiveSize(
  slots: SteppedSlot[],
  spacing: number,
): SteppedSlot[] {
  const originalIndex = new Map(slots.map((slot, index) => [slot.id, index]));

  return [...slots].sort((left, right) => {
    const leftGeometry = getSlotGeometry(left, spacing);
    const rightGeometry = getSlotGeometry(right, spacing);
    const leftSize = Math.max(leftGeometry.effectiveHalfW, leftGeometry.effectiveHalfH);
    const rightSize = Math.max(
      rightGeometry.effectiveHalfW,
      rightGeometry.effectiveHalfH,
    );

    if (rightSize !== leftSize) {
      return rightSize - leftSize;
    }

    return (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0);
  });
}

function getTargetShelfWidth(slots: SteppedSlot[], spacing: number): number {
  if (slots.length === 0) {
    return 0;
  }

  let totalArea = 0;
  let maxWidth = 0;

  slots.forEach((slot) => {
    const geometry = getSlotGeometry(slot, spacing);
    const width = geometry.effectiveHalfW * 2;
    const height = geometry.effectiveHalfH * 2;
    totalArea += width * height;
    maxWidth = Math.max(maxWidth, width);
  });

  return roundToStep(Math.max(maxWidth, Math.sqrt(totalArea)));
}

function packSlotsIntoShelves(
  slots: SteppedSlot[],
  spacing: number,
  targetWidth: number,
  startY: number = 0,
): { slots: SteppedSlot[]; nextY: number } {
  const packed: SteppedSlot[] = [];
  let cursorX = 0;
  let rowTop = startY;
  let rowHeight = 0;

  slots.forEach((slot) => {
    const geometry = getSlotGeometry(slot, spacing);
    const width = geometry.effectiveHalfW * 2;
    const height = geometry.effectiveHalfH * 2;

    if (cursorX > 0 && cursorX + width > targetWidth) {
      cursorX = 0;
      rowTop += rowHeight;
      rowHeight = 0;
    }

    packed.push({
      ...slot,
      x: roundToStep(cursorX + geometry.halfW),
      y: roundToStep(rowTop + geometry.halfH),
    });

    cursorX += width;
    rowHeight = Math.max(rowHeight, height);
  });

  return {
    slots: packed,
    nextY: roundToStep(rowTop + rowHeight),
  };
}

function evaluateSeedArea(
  params: SteppedLayoutParams,
  slots: SteppedSlot[],
): { area: number; maxSide: number } {
  const dims = calculateSteppedEffectiveDimensions({
    ...params,
    slots,
  });

  return {
    area: dims.width * dims.depth,
    maxSide: Math.max(dims.width, dims.depth),
  };
}

function createCompactSeed(params: SteppedLayoutParams): ProposalSeed {
  const ordered = sortSlotsByEffectiveSize(params.slots, params.spacing);
  const baseWidth = getTargetShelfWidth(ordered, params.spacing);
  const candidateWidths = [0.75, 0.9, 1, 1.15, 1.3].map((factor) =>
    roundToStep(Math.max(baseWidth * factor, Math.max(...ordered.map((slot) => {
      const geometry = getSlotGeometry(slot, params.spacing);
      return geometry.effectiveHalfW * 2;
    })))),
  );
  let bestSlots: SteppedSlot[] | null = null;
  let bestMetrics: { area: number; maxSide: number } | null = null;

  candidateWidths.forEach((targetWidth) => {
    const packed = packSlotsIntoShelves(
      ordered,
      params.spacing,
      targetWidth,
    ).slots;
    const metrics = evaluateSeedArea(params, packed);
    if (
      !bestMetrics ||
      metrics.area < bestMetrics.area ||
      (metrics.area === bestMetrics.area && metrics.maxSide < bestMetrics.maxSide)
    ) {
      bestSlots = packed;
      bestMetrics = metrics;
    }
  });

  return {
    kind: "compact",
    label: "最紧凑",
    description: "大槽优先紧凑排布，优先压缩整体占地。",
    slots: bestSlots ?? ordered,
  };
}

function createGroupedSeed(params: SteppedLayoutParams): ProposalSeed {
  const slotsByGroupId = new Map<string, SteppedSlot[]>();
  params.slots.forEach((slot) => {
    const groupSlots = slotsByGroupId.get(slot.groupId);
    if (groupSlots) {
      groupSlots.push(slot);
    } else {
      slotsByGroupId.set(slot.groupId, [slot]);
    }
  });

  const targetWidth = getTargetShelfWidth(params.slots, params.spacing);
  const grouped: SteppedSlot[] = [];
  let cursorY = 0;

  params.groups.forEach((group) => {
    const groupSlots = slotsByGroupId.get(group.id) ?? [];
    if (groupSlots.length === 0) {
      return;
    }

    const { slots, nextY } = packSlotsIntoShelves(
      sortSlotsByEffectiveSize(groupSlots, params.spacing),
      params.spacing,
      targetWidth,
      cursorY,
    );
    grouped.push(...slots);
    cursorY = nextY;
  });

  return {
    kind: "grouped",
    label: "按组紧凑",
    description: "保留各组更成团，再整体压缩布局。",
    slots: grouped,
  };
}

function createMinimalMoveSeed(params: SteppedLayoutParams): ProposalSeed {
  return {
    kind: "minimal-move",
    label: "最少改动",
    description: "在当前布局基础上尽量少移动槽位。",
    slots: normalizeSlotsToOrigin(params.slots, params.spacing),
  };
}

function createSeeds(params: SteppedLayoutParams): ProposalSeed[] {
  return [
    createCompactSeed(params),
    createGroupedSeed(params),
    createMinimalMoveSeed(params),
  ];
}

function collidesAtPosition(
  slot: SteppedSlot,
  slots: SteppedSlot[],
  spacing: number,
  axis: "x" | "y",
  nextValue: number,
): boolean {
  const currentGeometry = getSlotGeometry(slot, spacing);
  const candidate = {
    ...slot,
    [axis]: nextValue,
  };

  if (
    candidate.x - currentGeometry.halfW < -1e-6 ||
    candidate.y - currentGeometry.halfH < -1e-6
  ) {
    return true;
  }

  const candidatePolygon = getEllipsePolygon(
    candidate.x,
    candidate.y,
    candidate.width,
    candidate.height,
    candidate.rotation,
    currentGeometry.margin,
    12,
  );

  for (const other of slots) {
    if (other.id === slot.id) {
      continue;
    }

    const otherGeometry = getSlotGeometry(other, spacing);
    const candidateMinX = candidate.x - currentGeometry.effectiveHalfW;
    const candidateMaxX = candidate.x + currentGeometry.effectiveHalfW;
    const candidateMinY = candidate.y - currentGeometry.effectiveHalfH;
    const candidateMaxY = candidate.y + currentGeometry.effectiveHalfH;
    const otherMinX = other.x - otherGeometry.effectiveHalfW;
    const otherMaxX = other.x + otherGeometry.effectiveHalfW;
    const otherMinY = other.y - otherGeometry.effectiveHalfH;
    const otherMaxY = other.y + otherGeometry.effectiveHalfH;

    if (
      candidateMaxX <= otherMinX ||
      otherMaxX <= candidateMinX ||
      candidateMaxY <= otherMinY ||
      otherMaxY <= candidateMinY
    ) {
      continue;
    }

    const otherPolygon = getEllipsePolygon(
      other.x,
      other.y,
      other.width,
      other.height,
      other.rotation,
      otherGeometry.margin,
      12,
    );
    if (polygonsIntersect(candidatePolygon, otherPolygon)) {
      return true;
    }
  }

  return false;
}

function compactAlongAxis(
  slots: SteppedSlot[],
  spacing: number,
  axis: "x" | "y",
): SteppedSlot[] {
  const geometryById = new Map(
    slots.map((slot) => [slot.id, getSlotGeometry(slot, spacing)] as const),
  );
  const sorted = [...slots].sort((left, right) => {
    const leftGeometry = geometryById.get(left.id);
    const rightGeometry = geometryById.get(right.id);
    const leftEdge =
      axis === "x"
        ? left.x - (leftGeometry?.halfW ?? 0)
        : left.y - (leftGeometry?.halfH ?? 0);
    const rightEdge =
      axis === "x"
        ? right.x - (rightGeometry?.halfW ?? 0)
        : right.y - (rightGeometry?.halfH ?? 0);

    if (leftEdge !== rightEdge) {
      return leftEdge - rightEdge;
    }

    return left.id.localeCompare(right.id);
  });

  const next = slots.map((slot) => ({ ...slot }));
  const nextById = new Map(next.map((slot) => [slot.id, slot]));

  sorted.forEach((slot) => {
    const candidate = nextById.get(slot.id);
    const geometry = geometryById.get(slot.id);
    if (!candidate || !geometry) {
      return;
    }

    const minValue = axis === "x" ? geometry.halfW : geometry.halfH;
    const maxValue = axis === "x" ? candidate.x : candidate.y;
    let low = Math.ceil(minValue / SEARCH_STEP);
    let high = Math.round(maxValue / SEARCH_STEP);
    let best = high;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const value = roundToStep(mid * SEARCH_STEP);
      const hasCollision = collidesAtPosition(
        candidate,
        next,
        spacing,
        axis,
        value,
      );

      if (hasCollision) {
        low = mid + 1;
      } else {
        best = mid;
        high = mid - 1;
      }
    }

    candidate[axis] = roundToStep(best * SEARCH_STEP);
  });

  return next;
}

function compactSlots(slots: SteppedSlot[], spacing: number): SteppedSlot[] {
  let current = normalizeSlotsToOrigin(slots, spacing);

  for (let index = 0; index < COMPACTION_ITERATIONS; index += 1) {
    current = compactAlongAxis(current, spacing, "x");
    current = compactAlongAxis(current, spacing, "y");
    current = normalizeSlotsToOrigin(current, spacing);
  }

  return current;
}

function calculateDisplacement(
  originalSlots: SteppedSlot[],
  nextSlots: SteppedSlot[],
): number {
  const originalById = new Map(
    originalSlots.map((slot) => [slot.id, slot] as const),
  );
  let total = 0;

  nextSlots.forEach((slot) => {
    const original = originalById.get(slot.id);
    if (!original) {
      return;
    }

    total += Math.hypot(slot.x - original.x, slot.y - original.y);
  });

  return Number(total.toFixed(3));
}

function finalizeProposal(
  params: SteppedLayoutParams,
  seed: ProposalSeed,
): SteppedOptimizationProposal {
  const compactedSlots = compactSlots(seed.slots, params.spacing);
  const nextParams = trimSteppedBaseplate(
    {
      ...params,
      slots: compactedSlots,
    },
    calculateSteppedEffectiveDimensions({
      ...params,
      slots: compactedSlots,
    }),
  );
  const dims = calculateSteppedEffectiveDimensions(nextParams);
  const hasBridgeWarning = buildSteppedBridgeWarning(nextParams) !== null;
  const metrics: SteppedOptimizationMetrics = {
    width: dims.width,
    depth: dims.depth,
    area: dims.width * dims.depth,
    displacement: calculateDisplacement(params.slots, nextParams.slots),
    hasBridgeWarning,
    isOversized: dims.width > MAX_BUILD_SIZE || dims.depth > MAX_BUILD_SIZE,
  };

  return {
    id: seed.kind,
    kind: seed.kind,
    label: seed.label,
    description: seed.description,
    params: nextParams,
    metrics,
  };
}

function compareProposalMetrics(
  left: SteppedOptimizationProposal,
  right: SteppedOptimizationProposal,
): number {
  if (left.metrics.area !== right.metrics.area) {
    return left.metrics.area - right.metrics.area;
  }

  const leftMaxSide = Math.max(left.metrics.width, left.metrics.depth);
  const rightMaxSide = Math.max(right.metrics.width, right.metrics.depth);
  if (leftMaxSide !== rightMaxSide) {
    return leftMaxSide - rightMaxSide;
  }

  if (left.metrics.hasBridgeWarning !== right.metrics.hasBridgeWarning) {
    return Number(left.metrics.hasBridgeWarning) - Number(right.metrics.hasBridgeWarning);
  }

  if (left.metrics.displacement !== right.metrics.displacement) {
    return left.metrics.displacement - right.metrics.displacement;
  }

  return left.label.localeCompare(right.label);
}

export function generateSteppedOptimizationProposals(
  params: SteppedLayoutParams,
): SteppedOptimizationProposal[] {
  if (params.slots.length === 0) {
    return [];
  }

  return createSeeds(params)
    .map((seed) => finalizeProposal(params, seed))
    .sort(compareProposalMetrics);
}
