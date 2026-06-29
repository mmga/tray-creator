/**
 * 阶梯式布局优化的策略配置。
 *
 * 此前这些魔数散落在 stepped-global-optimize.ts 顶部，提取为命名配置后，
 * 业务偏好（搜索精度、目标比例、候选上限）可见且可审查。
 */

/** 坐标量化步长（mm）——所有候选坐标按此步长取整 */
export const SEARCH_STEP = 0.05;

/** 对称惩罚的比较容差——差异小于此值视为同等对称 */
export const SYMMETRY_TOLERANCE = 0.05;

/** 目标宽深比（横向约 5:2 的长方形） */
export const TARGET_WIDTH_TO_DEPTH_RATIO = 5 / 2;

/** 宽深比惩罚的比较容差 */
export const ASPECT_RATIO_TOLERANCE = 0.02;

/** 每个分组保留的候选数量上限 */
export const GROUP_CANDIDATE_LIMIT = 5;

/** 组间笛卡尔积搜索后保留的整体候选上限 */
export const OVERALL_CANDIDATE_LIMIT = 24;

/** 候选宽度因子——在目标货架宽度基础上探索的缩放比例 */
export const CANDIDATE_WIDTH_FACTORS = [0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5] as const;

/** 宽深比惩罚阈值——差异超过此值才翻转横向偏好 */
export const ASPECT_PENALTY_FLIP_THRESHOLD = 0.15;
