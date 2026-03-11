/**
 * 形态学闭运算轮廓生成算法
 *
 * 管线：geom2 圆(rOuter+SR) → JSCAD union → 提取多边形 → 纯数学内缩(SR) → geom2
 *
 * JSCAD 的 offset(-delta) 在特定 segments 和几何参数组合下会产出 CW 绕序的
 * 错误几何或抛出 "geometry is not closed" 异常。
 * 因此 2D 内缩阶段完全用纯数学实现，仅保留 JSCAD 做圆的创建和 union。
 */

import { booleans, primitives, transforms, geometries } from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";

const { union } = booleans;
const { circle } = primitives;
const { translate } = transforms;
const { geom2 } = geometries;

// 防止"膨胀后刚好相切"导致的布尔拓扑抖动。
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

// ── 纯数学多边形内缩 ──────────────────────

/**
 * 计算有向多边形面积（Shoelace），正 = CCW，负 = CW
 */
function signedPolygonArea(pts: [number, number][]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return area / 2;
}

/** 两直线求交（无限延长） */
function lineIntersection(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): [number, number] | null {
  const d1x = p1[0] - p0[0],
    d1y = p1[1] - p0[1];
  const d2x = p3[0] - p2[0],
    d2y = p3[1] - p2[1];
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((p2[0] - p0[0]) * d2y - (p2[1] - p0[1]) * d2x) / denom;
  return [p0[0] + t * d1x, p0[1] + t * d1y];
}

/** 两线段求交（限制在线段范围内） */
function segmentIntersection(
  a0: [number, number],
  a1: [number, number],
  b0: [number, number],
  b1: [number, number],
): [number, number] | null {
  const d1x = a1[0] - a0[0],
    d1y = a1[1] - a0[1];
  const d2x = b1[0] - b0[0],
    d2y = b1[1] - b0[1];
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((b0[0] - a0[0]) * d2y - (b0[1] - a0[1]) * d2x) / denom;
  const u = ((b0[0] - a0[0]) * d1y - (b0[1] - a0[1]) * d1x) / denom;
  if (t < 0.001 || t > 0.999 || u < 0.001 || u > 0.999) return null;
  return [a0[0] + t * d1x, a0[1] + t * d1y];
}

/** 去除多边形自交：保留最大面积的简单环 */
function removeSelfintersections(pts: [number, number][]): [number, number][] {
  if (pts.length < 4) return pts;

  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const j2 = (j + 1) % n;
      const inter = segmentIntersection(pts[i], pts[i2], pts[j], pts[j2]);
      if (inter) {
        const loop1: [number, number][] = [inter];
        for (let k = i2; k !== (j + 1) % n; k = (k + 1) % n) loop1.push(pts[k]);
        const loop2: [number, number][] = [inter];
        for (let k = j2; k !== (i + 1) % n; k = (k + 1) % n) loop2.push(pts[k]);
        return removeSelfintersections(
          Math.abs(signedPolygonArea(loop1)) >=
            Math.abs(signedPolygonArea(loop2))
            ? loop1
            : loop2,
        );
      }
    }
  }
  return pts;
}

/**
 * 将 CCW 多边形向内缩进 distance。
 * 凸角处使用交点，凹角处插入圆弧过渡（round corners）。
 *
 * @param pts CCW 闭合多边形顶点
 * @param distance 缩进距离（正值 = 缩小）
 * @param arcSegments 凹角圆弧细分段数
 * @returns 内缩后的 CCW 多边形，如果完全退化则返回 null
 */
function insetPolygon(
  pts: [number, number][],
  distance: number,
  arcSegments: number = 16,
): [number, number][] | null {
  const n = pts.length;
  if (n < 3 || distance <= 0) return pts;

  // 1. 计算每条边的方向和内法线
  //    CCW 多边形的内法线 = 边方向左侧 = (-dy, dx) 归一化
  interface Edge {
    i: number;
    j: number;
    dx: number;
    dy: number;
    nx: number;
    ny: number;
  }
  const edges: Edge[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = pts[j][0] - pts[i][0];
    const dy = pts[j][1] - pts[i][1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-10) continue;
    edges.push({
      i,
      j,
      dx: dx / len,
      dy: dy / len,
      nx: -dy / len,
      ny: dx / len,
    });
  }
  if (edges.length < 3) return null;

  // 2. 每条边沿内法线平移 distance
  const offsetEdges = edges.map((e) => ({
    ...e,
    p0: [pts[e.i][0] + e.nx * distance, pts[e.i][1] + e.ny * distance] as [
      number,
      number,
    ],
    p1: [pts[e.j][0] + e.nx * distance, pts[e.j][1] + e.ny * distance] as [
      number,
      number,
    ],
  }));

  // 3. 相邻偏移边求交/插弧 → 新顶点
  const result: [number, number][] = [];
  const ne = offsetEdges.length;

  for (let i = 0; i < ne; i++) {
    const curr = offsetEdges[i];
    const next = offsetEdges[(i + 1) % ne];
    const cross = curr.dx * next.dy - curr.dy * next.dx;

    if (cross > 1e-10) {
      // 凸角（左转）→ 偏移边交叉 → 用交点
      const pt = lineIntersection(curr.p0, curr.p1, next.p0, next.p1);
      if (pt) result.push(pt);
    } else if (cross < -1e-10) {
      // 凹角（右转）→ 偏移边有间隙 → 插入圆弧
      const cv = pts[curr.j];
      const angle1 = Math.atan2(curr.p1[1] - cv[1], curr.p1[0] - cv[0]);
      const angle2 = Math.atan2(next.p0[1] - cv[1], next.p0[0] - cv[0]);
      let sweep = angle2 - angle1;
      while (sweep > Math.PI) sweep -= 2 * Math.PI;
      while (sweep < -Math.PI) sweep += 2 * Math.PI;

      const arcPts = Math.max(
        2,
        Math.ceil(Math.abs(sweep) / (Math.PI / arcSegments)),
      );
      for (let a = 0; a <= arcPts; a++) {
        const t = a / arcPts;
        const angle = angle1 + sweep * t;
        result.push([
          cv[0] + distance * Math.cos(angle),
          cv[1] + distance * Math.sin(angle),
        ]);
      }
    } else {
      // 平行边
      result.push(curr.p1);
    }
  }

  // 4. 去除自交
  const cleaned = removeSelfintersections(result);
  if (cleaned.length < 3) return null;

  // 5. 确保 CCW
  const area = signedPolygonArea(cleaned);
  if (area < 0) cleaned.reverse();
  if (Math.abs(area) < 1) return null;

  return cleaned;
}

// ── 核心：形态学闭运算（JSCAD union + 数学内缩）──

/**
 * 使用形态学闭运算生成外轮廓 Geom2
 *
 * 管线：
 * 1. JSCAD circle + union 创建膨胀后的合并几何（可靠）
 * 2. 纯数学 insetPolygon 替代 JSCAD offset(-delta)（避免系统性 bug）
 * 3. geom2.fromPoints 转回 JSCAD 格式
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
  const totalSmoothing = clampedSmoothing + epsilon;

  // 1. JSCAD 创建膨胀圆 + union（这一步可靠，不涉及 offset）
  const geom2Circles = circles.map((c) => {
    const expandedRadius = c.rOuter + totalSmoothing;
    const circ = circle({ radius: expandedRadius, segments });
    return translate([c.cx, c.cy, 0], circ) as Geom2;
  });

  let merged: Geom2;
  if (geom2Circles.length === 1) {
    merged = geom2Circles[0];
  } else {
    merged = union(...geom2Circles) as Geom2;
  }

  // 不需要内缩时直接返回
  if (totalSmoothing <= 0) return merged;

  // 2. 提取合并后的多边形轮廓
  const outlines = geom2.toOutlines(merged);
  if (outlines.length === 0) return null;

  // 取面积最大的轮廓
  let largest = outlines[0];
  let largestAbsArea = Math.abs(signedPolygonArea(largest));
  for (let i = 1; i < outlines.length; i++) {
    const absArea = Math.abs(signedPolygonArea(outlines[i]));
    if (absArea > largestAbsArea) {
      largest = outlines[i];
      largestAbsArea = absArea;
    }
  }

  // 确保 CCW 绕序
  if (signedPolygonArea(largest) < 0) {
    largest = [...largest].reverse() as [number, number][];
  }

  // 3. 纯数学内缩（替代 JSCAD offset(-delta)）
  const inset = insetPolygon(largest, totalSmoothing, segments);
  if (!inset) {
    // 退化情况：smoothingRadius 太大导致完全缩没了，回退到不平滑的 union
    console.warn(
      `[OUTLINE] Inset collapsed (smoothingRadius=${smoothingRadius}). Falling back to no smoothing.`,
    );
    const fallbackCircles = circles.map((c) => {
      const circ = circle({ radius: c.rOuter, segments });
      return translate([c.cx, c.cy, 0], circ) as Geom2;
    });
    return fallbackCircles.length === 1
      ? fallbackCircles[0]
      : (union(...fallbackCircles) as Geom2);
  }

  return geom2.fromPoints(inset);
}

// ── 公共接口 ──────────────────────────────

/**
 * 计算多边形面积（Shoelace 公式，绝对值）
 */
function polygonArea(pts: [number, number][]): number {
  return Math.abs(signedPolygonArea(pts));
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
