import {
  booleans,
  primitives,
  transforms,
  extrusions,
  measurements,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { RENDER_CONFIG, getSlotTolerance } from "@/lib/config";
import {
  generateOutlineGeom2,
  type OutlineCircle,
} from "@/lib/outline-geometry";

const { subtract, union, intersect } = booleans;
const { translate, rotateZ } = transforms;
const { ellipse, circle } = primitives;
const { extrudeLinear } = extrusions;
const { measureVolume, measureBoundingBox } = measurements;

const DEG_TO_RAD = Math.PI / 180;

interface OrientationDebugContext {
  enabled: boolean;
  flipCount: number;
}

function logOrientation(
  ctx: OrientationDebugContext,
  stage: string,
  payload: Record<string, unknown>,
) {
  if (!ctx.enabled) return;
  console.info("[STEPPED_ORIENT]", stage, payload);
}

function inspectSolidOrientation(
  solid: Geom3,
  stage: string,
  ctx: OrientationDebugContext,
): Geom3 {
  const volume = measureVolume(solid);
  if (!Number.isFinite(volume)) {
    logOrientation(ctx, stage, {
      volume,
      action: "non_finite",
    });
    return solid;
  }

  logOrientation(ctx, stage, {
    volume,
    action: volume < 0 ? "negative_detected" : "keep",
  });
  return solid;
}

function safeIntersectionVolume(a: Geom3, b: Geom3): number | null {
  try {
    const i = intersect(a, b);
    const v = measureVolume(i);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function getSlotBoundingHalfSize(
  width: number,
  height: number,
  rotation: number,
) {
  const rad = (rotation * Math.PI) / 180;
  const a = (width + getSlotTolerance(width)) / 2;
  const b = (height + getSlotTolerance(height)) / 2;
  const halfW = Math.sqrt(
    Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2),
  );
  const halfH = Math.sqrt(
    Math.pow(a * Math.sin(rad), 2) + Math.pow(b * Math.cos(rad), 2),
  );
  return { halfW, halfH };
}

function calculateEffectiveBaseplate(params: SteppedLayoutParams) {
  const boundarySpacing = params.spacing;

  if (params.slots.length === 0) {
    return {
      hasSlots: false,
      width: 0,
      depth: 0,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  params.slots.forEach((slot) => {
    const { halfW, halfH } = getSlotBoundingHalfSize(
      slot.width,
      slot.height,
      slot.rotation,
    );
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  });

  return {
    hasSlots: true,
    width: Math.ceil(maxX - minX + boundarySpacing * 2),
    depth: Math.ceil(maxY - minY + boundarySpacing * 2),
    minX,
    maxX,
    minY,
    maxY,
  };
}

/**
 * 根据阶梯底座参数生成托盘 3D 模型
 *
 * 结构说明（形态学闭运算底座）：
 * - 计算所有柱子的最低高度作为底座统一高度
 * - 2D union + offset 闭运算生成底座轮廓 → 拉伸到底座高度
 * - 高于底座的柱子部分独立 union
 * - 全局固定深度 holeDepth 从柱顶向下挖出凹槽
 */
export function createSteppedTrayModel(params: SteppedLayoutParams): Geom3 {
  const { slots, spacing, holeDepth, smoothingRadius } = params;
  const debugCtx: OrientationDebugContext = {
    enabled: Boolean(params.debugOrientation) || slots.length === 2,
    flipCount: 0,
  };

  logOrientation(debugCtx, "input", {
    slots: slots.length,
    spacing,
    holeDepth,
    smoothingRadius,
  });

  if (slots.length === 2) {
    const s1 = slots[0];
    const s2 = slots[1];
    logOrientation(debugCtx, "two_slot_distance", {
      dx: s2.x - s1.x,
      dy: s2.y - s1.y,
      distance: Math.hypot(s2.x - s1.x, s2.y - s1.y),
      w1: s1.width,
      h1: s1.height,
      w2: s2.width,
      h2: s2.height,
    });
  }

  const effective = calculateEffectiveBaseplate(params);
  const trayWidth = effective.hasSlots ? effective.width : params.trayWidth;
  const trayDepth = effective.hasSlots ? effective.depth : params.trayDepth;

  const sourceCenterX = effective.hasSlots
    ? (effective.minX + effective.maxX) / 2
    : trayWidth / 2;
  const sourceCenterY = effective.hasSlots
    ? (effective.minY + effective.maxY) / 2
    : trayDepth / 2;

  if (slots.length === 0) {
    const ph = extrudeLinear(
      { height: 0.1 },
      ellipse({ radius: [1, 1], segments: 4 }),
    );
    return ph;
  }

  // 计算 JSCAD 坐标
  const slotData = slots.map((slot) => {
    const normalizedX = slot.x - sourceCenterX + trayWidth / 2;
    const normalizedY = slot.y - sourceCenterY + trayDepth / 2;
    const cx = normalizedX - trayWidth / 2;
    const cy = normalizedY - trayDepth / 2;
    const rotation = slot.rotation || 0;
    const actualW = slot.width + getSlotTolerance(slot.width);
    const actualH = slot.height + getSlotTolerance(slot.height);
    const columnHeight = Math.max(slot.bottomHeight, 3);
    return { slot, cx, cy, rotation, actualW, actualH, columnHeight };
  });

  // 底座高度 = 所有柱子最低高度
  const baseHeight = Math.min(...slotData.map((d) => d.columnHeight));

  // 构建外扩圆列表用于轮廓生成
  const outlineCircles: OutlineCircle[] = slotData.map((d) => ({
    cx: d.cx,
    cy: d.cy,
    rOuter: Math.max(d.actualW, d.actualH) / 2 + spacing,
  }));

  // 生成底座轮廓（形态学闭运算）
  const outlineGeom = generateOutlineGeom2(
    outlineCircles,
    smoothingRadius,
    RENDER_CONFIG.cylinderSegments,
  );

  logOrientation(debugCtx, "outline", {
    hasOutline: Boolean(outlineGeom),
    circles: outlineCircles.length,
    rOuter: outlineCircles.map((c) => Number(c.rOuter.toFixed(4))),
  });

  let baseSolid: Geom3;

  if (outlineGeom) {
    // JSCAD offset(-delta) 在某些 segment 数下产生 CW 绕序 geom2，
    // 导致 extrudeLinear 生成反向实体(负体积)，使 subtract 变成 union。
    // 修复方案：先用正确朝向的 3D 扩展柱体 union，再与形态学轮廓 extrude
    // 做 intersect 来裁剪到目标边界。intersect 产出的实体 BSP 树始终正确。
    const expandedR = smoothingRadius;
    const expandedCyls: Geom3[] = slotData.map((d) => {
      const r = Math.max(d.actualW, d.actualH) / 2 + spacing + expandedR;
      const shape = circle({
        radius: r,
        segments: RENDER_CONFIG.cylinderSegments,
      });
      const col = extrudeLinear({ height: baseHeight }, shape);
      return translate([d.cx, d.cy, 0], col);
    });
    const expandedBase3D =
      expandedCyls.length === 1 ? expandedCyls[0] : union(...expandedCyls);

    const mask3D = extrudeLinear({ height: baseHeight }, outlineGeom);
    baseSolid = intersect(expandedBase3D, mask3D);
  } else {
    // 回退：合并独立的外扩柱子
    const fallbackColumns: Geom3[] = slotData.map((d) => {
      const shape = ellipse({
        radius: [(d.actualW + spacing) / 2, (d.actualH + spacing) / 2],
        segments: RENDER_CONFIG.cylinderSegments,
      });
      const col = extrudeLinear({ height: baseHeight }, shape);
      const rotated = rotateZ(d.rotation * DEG_TO_RAD, col);
      return translate([d.cx, d.cy, 0], rotated);
    });
    baseSolid =
      fallbackColumns.length === 1
        ? fallbackColumns[0]
        : union(...fallbackColumns);
  }

  baseSolid = inspectSolidOrientation(baseSolid, "base_solid", debugCtx);

  // 高于底座的柱子部分
  const tallColumns: Geom3[] = [];
  for (const d of slotData) {
    if (d.columnHeight > baseHeight) {
      const extraHeight = d.columnHeight - baseHeight;
      const expandedW = d.actualW + spacing;
      const expandedH = d.actualH + spacing;
      const shape = ellipse({
        radius: [expandedW / 2, expandedH / 2],
        segments: RENDER_CONFIG.cylinderSegments,
      });
      const col = extrudeLinear({ height: extraHeight }, shape);
      const rotated = rotateZ(d.rotation * DEG_TO_RAD, col);
      tallColumns.push(translate([d.cx, d.cy, baseHeight], rotated));
    }
  }

  let solid = baseSolid;
  if (tallColumns.length > 0) {
    solid = union(solid, ...tallColumns);
  }

  solid = inspectSolidOrientation(solid, "solid_before_subtract", debugCtx);
  logOrientation(debugCtx, "subtract_input", {
    solidVolume: measureVolume(solid),
    slotCount: slotData.length,
  });

  // 减去凹槽
  const holes: Geom3[] = [];
  for (const d of slotData) {
    const clampedHoleDepth = Math.min(holeDepth, d.columnHeight);
    const holeShape = ellipse({
      radius: [d.actualW / 2, d.actualH / 2],
      segments: RENDER_CONFIG.cylinderSegments,
    });
    const hole3D = extrudeLinear(
      { height: clampedHoleDepth + 0.02 },
      holeShape,
    );
    const rotatedHole = rotateZ(d.rotation * DEG_TO_RAD, hole3D);
    const holeZ = d.columnHeight - clampedHoleDepth;
    holes.push(
      inspectSolidOrientation(
        translate([d.cx, d.cy, holeZ], rotatedHole),
        `hole_${d.slot.id}`,
        debugCtx,
      ),
    );
  }

  const solidVolume = measureVolume(solid);
  if (debugCtx.enabled && holes.length > 0) {
    const solidBox = measureBoundingBox(solid);
    logOrientation(debugCtx, "subtract_diagnostics", {
      solidBBox: solidBox,
      solidVolume,
    });

    const overlapVolumes = holes.map((h, index) => {
      const overlap = safeIntersectionVolume(solid, h);
      const holeBox = measureBoundingBox(h);
      return {
        index,
        overlapVolume: overlap,
        holeBBox: holeBox,
        holeVolume: measureVolume(h),
      };
    });
    logOrientation(debugCtx, "hole_overlap", {
      overlapVolumes,
      overlapSum: overlapVolumes.reduce(
        (sum, item) => sum + (item.overlapVolume ?? 0),
        0,
      ),
    });
  }

  const tray = holes.length > 0 ? subtract(solid, ...holes) : solid;
  const trayRawVolume = measureVolume(tray);
  logOrientation(debugCtx, "subtract_output", {
    trayRawVolume,
    removedVolume: solidVolume - trayRawVolume,
  });

  const fixedTray = inspectSolidOrientation(tray, "final_tray", debugCtx);

  logOrientation(debugCtx, "summary", {
    flipCount: debugCtx.flipCount,
    finalVolume: measureVolume(fixedTray),
    polygonCount: fixedTray.polygons?.length,
  });

  return fixedTray;
}

/**
 * 计算阶梯底座托盘的边界尺寸
 */
export function calculateSteppedTrayDimensions(params: SteppedLayoutParams) {
  const effective = calculateEffectiveBaseplate(params);
  const maxHeight =
    params.slots.length > 0
      ? Math.max(...params.slots.map((s) => Math.max(s.bottomHeight, 3)))
      : 0;
  return {
    width: effective.hasSlots ? effective.width : params.trayWidth,
    depth: effective.hasSlots ? effective.depth : params.trayDepth,
    height: maxHeight,
  };
}
