/**
 * 阶梯式布局优化的候选评估与多目标比较。
 *
 * 从 stepped-global-optimize.ts 提取，把核心业务偏好（横向优先 → 宽深比 →
 * 对称性 → 面积 → 最大边 → 行数）集中到一处，便于审查和单独测试。
 */
import { calculateSteppedEffectiveDimensions } from "@/lib/stepped-layout-math";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";
import {
  ASPECT_PENALTY_FLIP_THRESHOLD,
  ASPECT_RATIO_TOLERANCE,
  SYMMETRY_TOLERANCE,
  TARGET_WIDTH_TO_DEPTH_RATIO,
} from "@/lib/stepped-optimize-config";

export interface CompactCandidateEvaluation {
  width: number;
  depth: number;
  area: number;
  maxSide: number;
  symmetryPenalty: number;
  aspectPenalty: number;
  widthToDepthRatio: number;
  rowCount: number;
}

export function evaluateCompactCandidate(
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

/**
 * 多目标候选比较：返回负数表示 current 更优。
 *
 * 比较顺序（核心业务偏好）：
 * 1. 横向优先（width > depth 的排前面）
 * 2. 宽深比惩罚（差异超过 ASPECT_PENALTY_FLIP_THRESHOLD 才翻转）
 * 3. 对称性惩罚（SYMMETRY_TOLERANCE 容差内视为同等）
 * 4. 宽深比精细比较（ASPECT_RATIO_TOLERANCE 容差）
 * 5. 面积 → 最大边 → 行数
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
