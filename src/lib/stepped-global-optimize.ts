/**
 * 阶梯式布局优化的候选搜索编排 + 外部 API。
 *
 * 分层后，本文件聚焦"组内候选生成 → 组间笛卡尔积搜索 → 种子选择"的编排：
 * - 槽位几何/排序工具 → stepped-optimize-slot-geometry.ts
 * - 行装箱引擎       → stepped-optimize-shelf-packer.ts
 * - 候选评估/比较    → stepped-optimize-evaluator.ts
 * - 策略配置（魔数） → stepped-optimize-config.ts
 */
import { MAX_BUILD_SIZE } from "@/lib/config";
import { buildSteppedBridgeWarning } from "@/lib/stepped-bridge-warning";
import { calculateSteppedEffectiveDimensions } from "@/lib/stepped-layout-math";
import { trimSteppedBaseplate } from "@/lib/stepped-layout-slot-actions";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";
import {
  CANDIDATE_WIDTH_FACTORS,
  GROUP_CANDIDATE_LIMIT,
  OVERALL_CANDIDATE_LIMIT,
} from "@/lib/stepped-optimize-config";
import {
  compareCompactCandidateEvaluations,
  evaluateCompactCandidate,
  serializeSlots,
  type CompactCandidateEvaluation,
} from "@/lib/stepped-optimize-evaluator";
import {
  buildAlternatingOrder,
  getSlotGeometry,
  getTargetShelfWidth,
  normalizeSlotsToOrigin,
  roundPosition,
  roundToStep,
  sortSlotsByEffectiveSize,
} from "@/lib/stepped-optimize-slot-geometry";
import {
  packSlotsIntoShelves,
} from "@/lib/stepped-optimize-shelf-packer";

type ProposalKind = "compact";
type GroupAlignment = "center" | "top" | "bottom";

interface ProposalSeed {
  kind: ProposalKind;
  label: string;
  description: string;
  slots: SteppedSlot[];
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
      CANDIDATE_WIDTH_FACTORS.map((factor) =>
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
