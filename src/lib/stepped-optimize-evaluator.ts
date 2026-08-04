/**
 * 阶梯式布局优化的候选评估与多目标比较。
 *
 * 从 stepped-global-optimize.ts 提取，把核心业务偏好（横向优先 → 宽深比 →
 * 对称性 → 高度带材料成本 → 面积）集中到一处，便于审查和单独测试。
 */
import { calculateSteppedEffectiveDimensions } from "@/lib/stepped-layout-math";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import { measurements } from "@jscad/modeling";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";
import {
  ASPECT_PENALTY_FLIP_THRESHOLD,
  ASPECT_RATIO_TOLERANCE,
  SYMMETRY_TOLERANCE,
  TARGET_WIDTH_TO_DEPTH_RATIO,
} from "@/lib/stepped-optimize-config";
import {
  constructSteppedContouredFootprintsOutcome,
  projectSteppedContouredFootprintInput,
  type ConstructedSteppedContouredFootprints,
} from "@/lib/stepped-contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";

export interface CompactCandidateEvaluation {
  width: number;
  depth: number;
  area: number;
  maxSide: number;
  symmetryPenalty: number;
  aspectPenalty: number;
  widthToDepthRatio: number;
  rowCount: number;
  heightBandArea: number;
  heightBandWhitespace: number;
  estimatedVolume: number;
}

const { measureArea } = measurements;

function constructCandidateState(
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

export function calculateHeightBandFootprintCost(
  params: SteppedLayoutParams,
  slots: SteppedSlot[],
) {
  if (slots.length === 0) {
    return { heightBandArea: 0, heightBandWhitespace: 0, estimatedVolume: 0 };
  }

  const candidateParams = { ...params, slots };
  const candidateState = constructCandidateState(candidateParams);
  const graph = buildSteppedCadFeatureGraph(candidateParams, candidateState);
  const heightByGroupId = new Map(
    graph.groups.map((group) => [group.groupId, group.columnHeight] as const),
  );
  let heightBandArea = 0;
  let heightBandWhitespace = 0;
  let estimatedVolume = 0;

  graph.layers.forEach((layer) => {
    const area = Math.abs(measureArea(layer.footprint));
    const bandHeight = layer.toHeight - layer.fromHeight;
    const activeSlotArea = slots.reduce((sum, slot) => {
      const groupHeight = heightByGroupId.get(slot.groupId) ?? 0;
      if (groupHeight + 1e-6 < layer.toHeight) {
        return sum;
      }
      const slotParams = {
        ...candidateParams,
        slots: [slot],
        boundarySpacing: 0,
        boundarySpacingIndependent: true,
      };
      const dims = calculateSteppedEffectiveDimensions(
        slotParams,
        constructCandidateState(slotParams),
      );
      return sum + dims.width * dims.depth;
    }, 0);

    heightBandArea += area;
    heightBandWhitespace += Math.max(0, area - activeSlotArea);
    estimatedVolume += area * bandHeight;
  });

  return { heightBandArea, heightBandWhitespace, estimatedVolume };
}

export function evaluateCompactCandidate(
  params: SteppedLayoutParams,
  slots: SteppedSlot[],
  symmetryPenalty: number,
  rowCount: number,
): CompactCandidateEvaluation {
  const candidateParams = {
    ...params,
    slots,
  };
  const dims = calculateSteppedEffectiveDimensions(
    candidateParams,
    constructCandidateState(candidateParams),
  );
  const widthToDepthRatio =
    dims.depth <= 0 ? Number.POSITIVE_INFINITY : dims.width / dims.depth;
  const aspectPenalty = Number(
    (
      Math.abs(widthToDepthRatio - TARGET_WIDTH_TO_DEPTH_RATIO) /
      TARGET_WIDTH_TO_DEPTH_RATIO
    ).toFixed(3),
  );
  const heightBandCost = calculateHeightBandFootprintCost(params, slots);

  return {
    width: dims.width,
    depth: dims.depth,
    area: dims.width * dims.depth,
    maxSide: Math.max(dims.width, dims.depth),
    symmetryPenalty,
    aspectPenalty,
    widthToDepthRatio,
    rowCount,
    ...heightBandCost,
  };
}

/**
 * 多目标候选比较：返回负数表示 current 更优。
 *
 * 比较顺序（核心业务偏好）：
 * 1. 横向优先（width > depth 的排前面）
 * 2. 宽深比惩罚（差异超过 ASPECT_PENALTY_FLIP_THRESHOLD 才翻转）
 * 3. 对称性惩罚（SYMMETRY_TOLERANCE 容差内视为同等）
 * 4. 实际高度带体积 → 高度带空白 → 高度带面积
 * 5. 宽深比精细比较（ASPECT_RATIO_TOLERANCE 容差）
 * 6. 面积 → 最大边 → 行数
 */
export function compareCompactCandidateEvaluations(
  current: CompactCandidateEvaluation,
  best: CompactCandidateEvaluation,
): number {
  const currentIsHorizontal = current.width > current.depth;
  const bestIsHorizontal = best.width > best.depth;
  if (currentIsHorizontal !== bestIsHorizontal) {
    return currentIsHorizontal ? -1 : 1;
  }

  if (current.aspectPenalty < best.aspectPenalty - ASPECT_PENALTY_FLIP_THRESHOLD) {
    return -1;
  }

  if (current.aspectPenalty > best.aspectPenalty + ASPECT_PENALTY_FLIP_THRESHOLD) {
    return 1;
  }

  if (current.symmetryPenalty < best.symmetryPenalty - SYMMETRY_TOLERANCE) {
    return -1;
  }

  if (current.symmetryPenalty > best.symmetryPenalty + SYMMETRY_TOLERANCE) {
    return 1;
  }

  if (current.estimatedVolume !== best.estimatedVolume) {
    return current.estimatedVolume - best.estimatedVolume;
  }

  if (current.heightBandWhitespace !== best.heightBandWhitespace) {
    return current.heightBandWhitespace - best.heightBandWhitespace;
  }

  if (current.heightBandArea !== best.heightBandArea) {
    return current.heightBandArea - best.heightBandArea;
  }

  if (current.aspectPenalty < best.aspectPenalty - ASPECT_RATIO_TOLERANCE) {
    return -1;
  }

  if (current.aspectPenalty > best.aspectPenalty + ASPECT_RATIO_TOLERANCE) {
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

/** 序列化槽位布局为稳定 key（按 id 排序，坐标取 3 位小数） */
export function serializeSlots(slots: SteppedSlot[]): string {
  return slots
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((slot) => `${slot.id}:${slot.x.toFixed(3)}:${slot.y.toFixed(3)}`)
    .join("|");
}
