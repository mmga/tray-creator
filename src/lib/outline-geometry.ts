/**
 * 形态学闭运算轮廓生成算法
 *
 * 使用 JSCAD 2D 布尔 union + offset（膨胀/腐蚀）替代旧的 convex hull + TTR 桥接算法。
 * 管线：geom2 圆 union → offset(+smoothingRadius) → offset(-smoothingRadius) → 提取轮廓
 */

import {
  booleans,
  primitives,
  transforms,
  expansions,
  geometries,
} from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";

const { union } = booleans;
const { circle } = primitives;
const { translate } = transforms;
const { offset } = expansions;
const { geom2 } = geometries;

// 防止“膨胀后刚好相切”导致的布尔拓扑抖动。
// 使用连续 ramp 而不是开关，避免滑动参数时出现几何突跳。
const MORPH_EPSILON_MAX = 0.005;
const MORPH_TANGENCY_OUTER_TOLERANCE = MORPH_EPSILON_MAX * 2;
const MORPH_TANGENCY_INNER_TOLERANCE = 0.01;

function computeTangencyEpsilon(
  circles: OutlineCircle[],
  smoothingRadius: number,
): number {
  if (circles.length < 2 || smoothingRadius <= 0) return 0;

  let maxWeight = 0;

  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const c1 = circles[i];
      const c2 = circles[j];
      const dx = c1.cx - c2.cx;
      const dy = c1.cy - c2.cy;
      const d = Math.hypot(dx, dy);
      const expandedSum =
        c1.rOuter + smoothingRadius + (c2.rOuter + smoothingRadius);
      const gap = d - expandedSum;

      // gap < 0 表示膨胀圆已重叠，gap > 0 表示尚未接触。
      // 在 [-innerTol, 0] 与 [0, outerTol] 区间内做线性 ramp。
      let weight = 0;
      if (gap >= 0 && gap <= MORPH_TANGENCY_OUTER_TOLERANCE) {
        weight = 1 - gap / MORPH_TANGENCY_OUTER_TOLERANCE;
      } else if (gap < 0 && gap >= -MORPH_TANGENCY_INNER_TOLERANCE) {
        weight = 1 + gap / MORPH_TANGENCY_INNER_TOLERANCE;
      }

      if (weight > maxWeight) maxWeight = weight;
    }
  }

  return MORPH_EPSILON_MAX * maxWeight;
}

// ── 类型 ──────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export interface OutlineCircle {
  cx: number;
  cy: number;
  /** 外扩后的半径 (slotRadius + spacing/2) */
  rOuter: number;
}

/** 2D 轮廓路径上的一段弧 */
export interface ArcSegment {
  type: "convex" | "concave";
  center: Vec2;
  radius: number;
  startAngle: number;
  endAngle: number;
}

/** 最终输出：可直接绘制的轮廓数据 */
export interface OutlineData {
  /** 有序弧段列表（保留接口兼容，新算法下为空数组） */
  segments: ArcSegment[];
  /** 采样后的闭合多边形点列 */
  points: Vec2[];
}

// ── 核心：形态学闭运算 ──────────────────────

/**
 * 使用 JSCAD 形态学闭运算生成外轮廓 Geom2
 *
 * @param circles 所有 slot 的外扩圆
 * @param smoothingRadius 平滑半径（膨胀/腐蚀量）
 * @param segments 圆弧细分段数
 * @returns JSCAD Geom2 对象
 */
export function generateOutlineGeom2(
  circles: OutlineCircle[],
  smoothingRadius: number,
  segments: number = 64,
): Geom2 | null {
  if (circles.length === 0) return null;

  const clampedSmoothing = Math.max(0, smoothingRadius);
  const epsilon = computeTangencyEpsilon(circles, clampedSmoothing);

  // 策略：先用膨胀后的半径创建圆（rOuter + smoothingRadius），
  // union 合并后 offset(-smoothingRadius) 腐蚀回去。
  // 这样确保不相邻的圆在膨胀后重叠、被 union 正确合并，
  // 腐蚀后产生平滑的连接过渡。
  // 在近相切场景额外加极小 epsilon，避免反向/交叠等数值不稳定。
  const geom2Circles = circles.map((c) => {
    const expandedRadius = c.rOuter + clampedSmoothing + epsilon;
    const circ = circle({ radius: expandedRadius, segments });
    return translate([c.cx, c.cy, 0], circ) as Geom2;
  });

  // 合并所有膨胀后的圆
  let merged: Geom2;
  if (geom2Circles.length === 1) {
    merged = geom2Circles[0];
  } else {
    merged = union(...geom2Circles) as Geom2;
  }

  // 腐蚀回到目标尺寸，保留平滑过渡
  if (clampedSmoothing > 0 || epsilon > 0) {
    merged = offset(
      { delta: -(clampedSmoothing + epsilon), corners: "round", segments },
      merged,
    ) as Geom2;
  }

  return merged;
}

/**
 * 计算多边形面积（Shoelace 公式）
 */
function polygonArea(pts: [number, number][]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2;
}

/**
 * 主入口：生成闭合轮廓数据
 *
 * @param circles 所有 slot 的外扩圆（cx, cy 为 JSCAD 坐标系）
 * @param smoothingRadius 平滑半径
 * @param arcSegments 弧线采样精度
 * @returns 轮廓数据（弧段为空，points 为闭合多边形）
 */
export function generateOutline(
  circles: OutlineCircle[],
  smoothingRadius: number,
  arcSegments: number = 64,
): OutlineData | null {
  const geom = generateOutlineGeom2(circles, smoothingRadius, arcSegments);
  if (!geom) return null;

  // 提取轮廓点列
  const outlines = geom2.toOutlines(geom);
  if (outlines.length === 0) return null;

  // 多轮廓时取面积最大的（忽略内孔和小碎片）
  let largest = outlines[0];
  let largestArea = polygonArea(largest);
  for (let i = 1; i < outlines.length; i++) {
    const area = polygonArea(outlines[i]);
    if (area > largestArea) {
      largest = outlines[i];
      largestArea = area;
    }
  }

  const points: Vec2[] = largest.map(([x, y]) => ({ x, y }));

  return { segments: [], points };
}

/**
 * 将 OutlineData 的采样点转为 JSCAD geom2 多边形坐标
 * 保留接口兼容
 */
export function outlinePointsToGeom2(points: Vec2[]): [number, number][] {
  return points.map((p) => [p.x, p.y]);
}
