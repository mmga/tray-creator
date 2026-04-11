import { getSlotTolerance, MAX_BUILD_SIZE } from "@/lib/config";
import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import { buildSteppedBridgeWarning } from "@/lib/stepped-bridge-warning";
import { calculateSteppedEffectiveDimensions } from "@/lib/stepped-layout-math";
import { trimSteppedBaseplate } from "@/lib/stepped-layout-slot-actions";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";

const SEARCH_STEP = 0.05;
const SYMMETRY_TOLERANCE = 0.05;
const TARGET_WIDTH_TO_DEPTH_RATIO = 5 / 2;
const ASPECT_RATIO_TOLERANCE = 0.02;
const GROUP_CANDIDATE_LIMIT = 5;
const OVERALL_CANDIDATE_LIMIT = 24;

type ProposalKind = "compact";
type GroupAlignment = "center" | "top" | "bottom";

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
}

interface RowSlotEntry {
  slot: SteppedSlot;
  geometry: SlotGeometry;
  effectiveWidth: number;
  effectiveHeight: number;
}

interface RowLayout {
  entries: RowSlotEntry[];
  width: number;
  height: number;
  symmetryPenalty: number;
}

interface PackedLayout {
  slots: SteppedSlot[];
  symmetryPenalty: number;
  rowCount: number;
}

interface CompactCandidateEvaluation {
  width: number;
  depth: number;
  area: number;
  maxSide: number;
  symmetryPenalty: number;
  aspectPenalty: number;
  widthToDepthRatio: number;
  rowCount: number;
}

interface CompactCandidate {
  metrics: CompactCandidateEvaluation;
  slots: SteppedSlot[];
}

interface GroupCompactCandidate extends CompactCandidate {
  key: string;
}

interface GroupPlacementChoice {
  candidate: GroupCompactCandidate;
  alignment: GroupAlignment;
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
  };
}

function roundToStep(value: number): number {
  return Number((Math.round(value / SEARCH_STEP) * SEARCH_STEP).toFixed(3));
}

function roundPosition(value: number): number {
  return Number(value.toFixed(3));
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
    x: roundPosition(slot.x - minLeft),
    y: roundPosition(slot.y - minBottom),
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

function buildAlternatingOrder(slots: SteppedSlot[]): SteppedSlot[] {
  const alternating: SteppedSlot[] = [];
  let leftIndex = 0;
  let rightIndex = slots.length - 1;

  while (leftIndex <= rightIndex) {
    alternating.push(slots[leftIndex]!);
    leftIndex += 1;

    if (leftIndex <= rightIndex) {
      alternating.push(slots[rightIndex]!);
      rightIndex -= 1;
    }
  }

  return alternating;
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

  return roundToStep(
    Math.max(maxWidth, Math.sqrt(totalArea * TARGET_WIDTH_TO_DEPTH_RATIO)),
  );
}

function toRowSlotEntry(slot: SteppedSlot, spacing: number): RowSlotEntry {
  const geometry = getSlotGeometry(slot, spacing);

  return {
    slot,
    geometry,
    effectiveWidth: geometry.effectiveHalfW * 2,
    effectiveHeight: geometry.effectiveHalfH * 2,
  };
}

function arrangeRowSymmetrically(entries: RowSlotEntry[]): RowLayout {
  if (entries.length === 0) {
    return {
      entries: [],
      width: 0,
      height: 0,
      symmetryPenalty: 0,
    };
  }

  const ordered = [...entries];
  const hasCenterEntry = ordered.length % 2 === 1;
  const centerEntry = hasCenterEntry ? ordered.shift() ?? null : null;
  const leftEntries: RowSlotEntry[] = [];
  const rightEntries: RowSlotEntry[] = [];
  let leftWidth = 0;
  let rightWidth = 0;
  let pairMismatchPenalty = 0;

  for (let index = 0; index < ordered.length; index += 2) {
    const first = ordered[index];
    const second = ordered[index + 1];

    if (!first) {
      continue;
    }

    if (!second) {
      if (leftWidth <= rightWidth) {
        leftEntries.push(first);
        leftWidth += first.effectiveWidth;
      } else {
        rightEntries.push(first);
        rightWidth += first.effectiveWidth;
      }
      continue;
    }

    if (leftWidth <= rightWidth) {
      leftEntries.push(first);
      rightEntries.push(second);
      leftWidth += first.effectiveWidth;
      rightWidth += second.effectiveWidth;
    } else {
      leftEntries.push(second);
      rightEntries.push(first);
      leftWidth += second.effectiveWidth;
      rightWidth += first.effectiveWidth;
    }

    pairMismatchPenalty += Math.abs(first.effectiveWidth - second.effectiveWidth);
  }

  const rowEntries = centerEntry
    ? [...leftEntries].reverse().concat(centerEntry, rightEntries)
    : [...leftEntries].reverse().concat(rightEntries);

  return {
    entries: rowEntries,
    width: entries.reduce((sum, entry) => sum + entry.effectiveWidth, 0),
    height: Math.max(...entries.map((entry) => entry.effectiveHeight)),
    symmetryPenalty: roundPosition(
      Math.abs(leftWidth - rightWidth) + pairMismatchPenalty,
    ),
  };
}

function packSlotsIntoShelves(
  slots: SteppedSlot[],
  spacing: number,
  targetWidth: number,
  startY: number = 0,
): PackedLayout {
  const rows: RowSlotEntry[][] = [];
  let currentRow: RowSlotEntry[] = [];
  let currentWidth = 0;

  slots.forEach((slot) => {
    const entry = toRowSlotEntry(slot, spacing);

    if (
      currentRow.length > 0 &&
      currentWidth + entry.effectiveWidth > targetWidth + 1e-6
    ) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }

    currentRow.push(entry);
    currentWidth += entry.effectiveWidth;
  });

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  const packed: SteppedSlot[] = [];
  let cursorY = startY;
  let symmetryPenalty = 0;

  rows.map(arrangeRowSymmetrically).forEach((row) => {
    let cursorX = (targetWidth - row.width) / 2;
    const rowCenterY = cursorY + row.height / 2;

    row.entries.forEach((entry) => {
      packed.push({
        ...entry.slot,
        x: roundPosition(cursorX + entry.effectiveWidth / 2),
        y: roundPosition(rowCenterY),
      });
      cursorX += entry.effectiveWidth;
    });

    cursorY += row.height;
    symmetryPenalty += row.symmetryPenalty;
  });

  return {
    slots: packed,
    symmetryPenalty: roundPosition(symmetryPenalty),
    rowCount: rows.length,
  };
}

function evaluateCompactCandidate(
  params: SteppedLayoutParams,
  slots: SteppedSlot[],
  symmetryPenalty: number,
  rowCount: number,
): CompactCandidateEvaluation {
  const dims = calculateSteppedEffectiveDimensions({
    ...params,
    slots,
  });
  const widthToDepthRatio =
    dims.depth <= 0 ? Number.POSITIVE_INFINITY : dims.width / dims.depth;
  const aspectPenalty = Number(
    (
      Math.abs(widthToDepthRatio - TARGET_WIDTH_TO_DEPTH_RATIO) /
      TARGET_WIDTH_TO_DEPTH_RATIO
    ).toFixed(3),
  );

  return {
    width: dims.width,
    depth: dims.depth,
    area: dims.width * dims.depth,
    maxSide: Math.max(dims.width, dims.depth),
    symmetryPenalty,
    aspectPenalty,
    widthToDepthRatio,
    rowCount,
  };
}

function compareCompactCandidateEvaluations(
  current: CompactCandidateEvaluation,
  best: CompactCandidateEvaluation,
): number {
  const currentIsHorizontal = current.width > current.depth;
  const bestIsHorizontal = best.width > best.depth;
  if (currentIsHorizontal !== bestIsHorizontal) {
    return currentIsHorizontal ? -1 : 1;
  }

  if (
    current.aspectPenalty <
    best.aspectPenalty - 0.15
  ) {
    return -1;
  }

  if (
    current.aspectPenalty >
    best.aspectPenalty + 0.15
  ) {
    return 1;
  }

  if (
    current.symmetryPenalty <
    best.symmetryPenalty - SYMMETRY_TOLERANCE
  ) {
    return -1;
  }

  if (
    current.symmetryPenalty >
    best.symmetryPenalty + SYMMETRY_TOLERANCE
  ) {
    return 1;
  }

  if (
    current.aspectPenalty <
    best.aspectPenalty - ASPECT_RATIO_TOLERANCE
  ) {
    return -1;
  }

  if (
    current.aspectPenalty >
    best.aspectPenalty + ASPECT_RATIO_TOLERANCE
  ) {
    return 1;
  }

  if (current.area !== best.area) {
    return current.area - best.area;
  }

  if (current.maxSide !== best.maxSide) {
    return current.maxSide - best.maxSide;
  }

  if (current.rowCount !== best.rowCount) {
    return current.rowCount - best.rowCount;
  }

  return 0;
}

function serializeSlots(slots: SteppedSlot[]): string {
  return slots
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((slot) => `${slot.id}:${slot.x.toFixed(3)}:${slot.y.toFixed(3)}`)
    .join("|");
}

function resolveAlignmentOffset(
  overallSpan: number,
  blockSpan: number,
  alignment: GroupAlignment,
): number {
  if (alignment === "top") {
    return 0;
  }

  if (alignment === "bottom") {
    return overallSpan - blockSpan;
  }

  return (overallSpan - blockSpan) / 2;
}

function buildGroupCompactCandidates(
  params: SteppedLayoutParams,
  groupSlots: SteppedSlot[],
): GroupCompactCandidate[] {
  if (groupSlots.length === 0) {
    return [];
  }

  const original = [...groupSlots];
  const ordered = sortSlotsByEffectiveSize(groupSlots, params.spacing);
  const baseWidth = getTargetShelfWidth(groupSlots, params.spacing);
  const maxSlotWidth = Math.max(
    ...groupSlots.map(
      (slot) => getSlotGeometry(slot, params.spacing).effectiveHalfW * 2,
    ),
  );
  const candidateWidths = Array.from(
    new Set(
      [0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5].map((factor) =>
        roundToStep(Math.max(baseWidth * factor, maxSlotWidth)),
      ),
    ),
  );
  const orderVariants = [
    original,
    ordered,
    [...ordered].reverse(),
    buildAlternatingOrder(ordered),
  ];
  const candidates = new Map<string, GroupCompactCandidate>();

  candidateWidths.forEach((targetWidth) => {
    orderVariants.forEach((variantSlots) => {
      const packed = packSlotsIntoShelves(
        variantSlots,
        params.spacing,
        targetWidth,
      );
      const normalized = normalizeSlotsToOrigin(packed.slots, params.spacing);
      const metrics = evaluateCompactCandidate(
        params,
        normalized,
        packed.symmetryPenalty,
        packed.rowCount,
      );
      const key = serializeSlots(normalized);
      const existing = candidates.get(key);

      if (
        !existing ||
        compareCompactCandidateEvaluations(metrics, existing.metrics) < 0
      ) {
        candidates.set(key, {
          key,
          metrics,
          slots: normalized,
        });
      }
    });
  });

  return [...candidates.values()]
    .sort((left, right) => {
      const metricOrder = compareCompactCandidateEvaluations(
        left.metrics,
        right.metrics,
      );

      if (metricOrder !== 0) {
        return metricOrder;
      }

      return left.key.localeCompare(right.key);
    })
    .slice(0, GROUP_CANDIDATE_LIMIT);
}

function composeGroupPlacements(
  params: SteppedLayoutParams,
  placements: GroupPlacementChoice[],
): CompactCandidate {
  const overallDepth = Math.max(
    0,
    ...placements.map((placement) => placement.candidate.metrics.depth),
  );
  const combined: SteppedSlot[] = [];
  let cursorX = 0;
  let symmetryPenalty = 0;
  let rowCount = 0;

  placements.forEach((placement) => {
    const blockDepth = placement.candidate.metrics.depth;
    const offsetY = resolveAlignmentOffset(
      overallDepth,
      blockDepth,
      placement.alignment,
    );
    const centeredOffsetY = resolveAlignmentOffset(
      overallDepth,
      blockDepth,
      "center",
    );

    placement.candidate.slots.forEach((slot) => {
      combined.push({
        ...slot,
        x: roundPosition(slot.x + cursorX),
        y: roundPosition(slot.y + offsetY),
      });
    });

    cursorX += placement.candidate.metrics.width;
    symmetryPenalty +=
      placement.candidate.metrics.symmetryPenalty +
      Math.abs(offsetY - centeredOffsetY);
    rowCount += placement.candidate.metrics.rowCount;
  });

  const normalized = normalizeSlotsToOrigin(combined, params.spacing);

  return {
    metrics: evaluateCompactCandidate(
      params,
      normalized,
      roundPosition(symmetryPenalty),
      rowCount,
    ),
    slots: normalized,
  };
}

function buildCompactCandidates(params: SteppedLayoutParams): CompactCandidate[] {
  const slotsByGroupId = new Map<string, SteppedSlot[]>();
  params.slots.forEach((slot) => {
    const groupSlots = slotsByGroupId.get(slot.groupId);
    if (groupSlots) {
      groupSlots.push(slot);
    } else {
      slotsByGroupId.set(slot.groupId, [slot]);
    }
  });

  const groupCandidateSets = params.groups
    .map((group) => ({
      groupId: group.id,
      candidates: buildGroupCompactCandidates(
        params,
        slotsByGroupId.get(group.id) ?? [],
      ),
    }))
    .filter((entry) => entry.candidates.length > 0);

  if (groupCandidateSets.length === 0) {
    return [];
  }

  let drafts: Array<{
    key: string;
    placements: GroupPlacementChoice[];
    candidate: CompactCandidate;
  }> = [
    {
      key: "",
      placements: [],
      candidate: {
        metrics: evaluateCompactCandidate(params, [], 0, 0),
        slots: [],
      },
    },
  ];

  groupCandidateSets.forEach((groupSet) => {
    const nextDrafts = new Map<
      string,
      {
        key: string;
        placements: GroupPlacementChoice[];
        candidate: CompactCandidate;
      }
    >();

    drafts.forEach((draft) => {
      groupSet.candidates.forEach((candidate) => {
        const alignments: GroupAlignment[] =
          draft.placements.length === 0
            ? ["center"]
            : ["center", "top", "bottom"];

        alignments.forEach((alignment) => {
          const placements = [
            ...draft.placements,
            { candidate, alignment },
          ];
          const combinedCandidate = composeGroupPlacements(params, placements);
          const key = serializeSlots(combinedCandidate.slots);
          const existing = nextDrafts.get(key);

          if (
            !existing ||
            compareCompactCandidateEvaluations(
              combinedCandidate.metrics,
              existing.candidate.metrics,
            ) < 0
          ) {
            nextDrafts.set(key, {
              key,
              placements,
              candidate: combinedCandidate,
            });
          }
        });
      });
    });

    drafts = [...nextDrafts.values()]
      .sort((left, right) =>
        compareCompactCandidateEvaluations(
          left.candidate.metrics,
          right.candidate.metrics,
        ),
      )
      .slice(0, OVERALL_CANDIDATE_LIMIT);
  });

  return drafts.map((draft) => draft.candidate).sort((left, right) => {
    const metricOrder = compareCompactCandidateEvaluations(
      left.metrics,
      right.metrics,
    );

    if (metricOrder !== 0) {
      return metricOrder;
    }

    return serializeSlots(left.slots).localeCompare(serializeSlots(right.slots));
  });
}

function createCompactSeed(
  params: SteppedLayoutParams,
  variantIndex: number = 0,
): ProposalSeed {
  const candidates = buildCompactCandidates(params);
  const selectedCandidate =
    candidates[
      ((variantIndex % candidates.length) + candidates.length) %
        candidates.length
    ];
  const fallbackSlots = normalizeSlotsToOrigin(
    sortSlotsByEffectiveSize(params.slots, params.spacing),
    params.spacing,
  );

  return {
    kind: "compact",
    label: "紧凑对称",
    description: "仅在组内重排，不跨组混排；优先保证左右对称，并尽量收敛到横向约 5:2 的长方形。",
    slots: selectedCandidate?.slots ?? fallbackSlots,
  };
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
  const compactedSlots = normalizeSlotsToOrigin(seed.slots, params.spacing);
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

export function generateSteppedOptimizationProposals(
  params: SteppedLayoutParams,
  options: { variantIndex?: number } = {},
): SteppedOptimizationProposal[] {
  if (params.slots.length === 0) {
    return [];
  }

  return [finalizeProposal(params, createCompactSeed(params, options.variantIndex ?? 0))];
}
