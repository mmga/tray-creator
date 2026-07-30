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
  roundToStep,
  sortSlotsByEffectiveSize,
} from "@/lib/stepped-optimize-slot-geometry";
import {
  packSlotsIntoShelves,
} from "@/lib/stepped-optimize-shelf-packer";
import {
  constructSteppedContouredFootprintsOutcome,
  projectSteppedContouredFootprintInput,
  type ConstructedSteppedContouredFootprints,
} from "@/lib/stepped-contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";

function constructProposalState(
  params: SteppedLayoutParams,
): ContouredFootprintState<ConstructedSteppedContouredFootprints> {
  if (params.footprintStyle === "rectangular") return { status: "inactive" };
  const outcome = constructSteppedContouredFootprintsOutcome(
    projectSteppedContouredFootprintInput(params),
  );
  return outcome.ok
    ? { status: "ready", value: outcome.value }
    : { status: "failed", error: outcome.error };
}

type ProposalKind = "compact";

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

function buildCompactCandidates(params: SteppedLayoutParams): CompactCandidate[] {
  return buildGroupCompactCandidates(params, params.slots)
    .slice(0, OVERALL_CANDIDATE_LIMIT);
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
    description: "在全部凹槽间自由排列并保留高度组身份；优先降低真实高度带材料与包络空白。",
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
  const compactedParams = { ...params, slots: compactedSlots };
  const compactedDims = calculateSteppedEffectiveDimensions(
    compactedParams,
    constructProposalState(compactedParams),
  );
  const usesFixedRectangularFootprint =
    params.footprintStyle === "rectangular" &&
    params.traySizingMode === "fixed";
  const fitsFixedFootprint =
    compactedDims.width <= params.trayWidth &&
    compactedDims.depth <= params.trayDepth;
  const nextParams = usesFixedRectangularFootprint
    ? fitsFixedFootprint
      ? {
          ...compactedParams,
          slots: compactedSlots.map((slot) => ({
            ...slot,
            x:
              slot.x +
              params.trayWidth / 2 -
              (compactedDims.minX + compactedDims.maxX) / 2,
            y:
              slot.y +
              params.trayDepth / 2 -
              (compactedDims.minY + compactedDims.maxY) / 2,
          })),
        }
      : params
    : trimSteppedBaseplate(compactedParams, compactedDims);
  const contentDims = calculateSteppedEffectiveDimensions(
    nextParams,
    constructProposalState(nextParams),
  );
  const dims = usesFixedRectangularFootprint
    ? {
        ...contentDims,
        width: params.trayWidth,
        depth: params.trayDepth,
      }
    : contentDims;
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
