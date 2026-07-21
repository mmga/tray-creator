/**
 * Contoured Footprint Construction（共用贴合轮廓构造）
 *
 * 从 Mode Adapter 提供的计划批量派生权威托盘编辑坐标 Geom2，并集中提供二维预览、
 * 三维构造、尺寸、Contour Body Count、底孔校验和诊断所需的所有派生结果。
 */
import {
  booleans,
  geometries,
  measurements,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import {
  generateOutlineGeom2,
  insetGeom2,
  type OutlineCircle,
} from "@/lib/outline-geometry";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import {
  clusterConnectivityCircles,
  getConnectivityRadius,
  getEffectiveBridgeGap,
  type ConnectivityCircle,
} from "@/lib/stepped-connectivity";
import type { FreeSlot } from "@/types/custom-tray";

const { union } = booleans;
const { geom2 } = geometries;
const { measureArea, measureBoundingBox } = measurements;
const { circle } = primitives;
const { rotateZ, translate } = transforms;
const DEG_TO_RAD = Math.PI / 180;
const CIRCLE_CONTAINMENT_SAMPLES = 32;

export interface ContouredFootprintSlot {
  id: string;
  cx: number;
  cy: number;
  rotation: number;
  shape: FreeSlot["shape"];
  profile: {
    width: number;
    height: number;
    outerOffset: number;
    profileExponent?: number;
  };
}

export interface ContouredFootprintRequest {
  key: string;
  slots: readonly ContouredFootprintSlot[];
  slotSpacing: number;
  boundarySpacing: number;
  smoothingRadius: number;
  disconnectDistance: number;
}

export interface ContouredFootprintPlan {
  requests: readonly ContouredFootprintRequest[];
}

export interface ContouredFootprintPoint {
  x: number;
  y: number;
}

export interface ContouredFootprintBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ContouredFootprintDiagnostic {
  code: "smoothing-fallback";
  requestKey: string;
  slotIds: readonly string[];
  message: string;
}

export interface ContouredFootprintBody {
  readonly geometry: Geom2;
  readonly outlines: readonly (readonly ContouredFootprintPoint[])[];
  readonly outerOutline: readonly ContouredFootprintPoint[];
  readonly bounds: ContouredFootprintBounds;
  readonly area: number;
  readonly slotIds: readonly string[];
}

export interface ConstructedContouredFootprint {
  readonly key: string;
  readonly bodies: readonly ContouredFootprintBody[];
  readonly bodyCount: number;
  readonly bounds: ContouredFootprintBounds | null;
  readonly area: number;
  readonly diagnostics: readonly ContouredFootprintDiagnostic[];
  containsExpandedCircle: (x: number, y: number, radius: number) => boolean;
}

export interface ContouredFootprintConstructionResult {
  readonly footprints: readonly ConstructedContouredFootprint[];
  readonly diagnostics: readonly ContouredFootprintDiagnostic[];
}

export type ContouredFootprintConstructionErrorCode =
  | "invalid-plan"
  | "duplicate-request-key"
  | "invalid-slot-geometry-snapshot"
  | "invalid-contour-parameters"
  | "cluster-construction-failed";

export interface ContouredFootprintConstructionError {
  code: ContouredFootprintConstructionErrorCode;
  message: string;
  requestKey?: string;
  slotIds?: readonly string[];
  cause?: unknown;
}

export type ContouredFootprintConstructionOutcome =
  | { ok: true; value: ContouredFootprintConstructionResult }
  | { ok: false; error: ContouredFootprintConstructionError };

interface ClusterConstruction {
  geometry: Geom2;
  usedSmoothingFallback: boolean;
}

function createOffsetProfileShape(
  slot: ContouredFootprintSlot,
  offset: number,
): Geom2 {
  const points = sampleSlotProfilePoints(
    slot.profile.width,
    slot.profile.height,
    slot.shape,
    offset,
    RENDER_CONFIG.cylinderSegments,
    slot.profile.profileExponent,
  ).map((point): [number, number] => [point.x, point.y]);
  return geom2.fromPoints(points);
}

function buildProfileClusterFootprint(
  cluster: readonly ConnectivityCircle[],
  slotsById: ReadonlyMap<string, ContouredFootprintSlot>,
  boundarySpacing: number,
  smoothingRadius: number,
): ClusterConstruction | null {
  const clampedSmoothing = Math.max(0, smoothingRadius);
  const buildParts = (extraOffset: number) => cluster
    .map((connectivity) => slotsById.get(connectivity.id))
    .filter((item): item is ContouredFootprintSlot => Boolean(item))
    .map((item) => {
      const profile = createOffsetProfileShape(
        item,
        item.profile.outerOffset + boundarySpacing + extraOffset,
      );
      return translate(
        [item.cx, item.cy],
        rotateZ(item.rotation * DEG_TO_RAD, profile),
      ) as Geom2;
    });

  if (cluster.length === 1) {
    const geometry = buildParts(0)[0];
    return geometry ? { geometry, usedSmoothingFallback: false } : null;
  }

  const parts = buildParts(clampedSmoothing);
  if (parts.length === 0) return null;
  const expanded = parts.length === 1 ? parts[0] : union(...parts);
  if (clampedSmoothing <= 0) {
    return { geometry: expanded, usedSmoothingFallback: false };
  }

  const smoothed = insetGeom2(
    expanded,
    clampedSmoothing,
    RENDER_CONFIG.cylinderSegments,
  );
  if (smoothed) {
    return { geometry: smoothed, usedSmoothingFallback: false };
  }

  const fallbackParts = buildParts(0);
  if (fallbackParts.length === 0) return null;
  return {
    geometry: fallbackParts.length === 1
      ? fallbackParts[0]
      : union(...fallbackParts),
    usedSmoothingFallback: true,
  };
}

function buildCircularClusterFootprint(
  cluster: readonly ConnectivityCircle[],
  slotsById: ReadonlyMap<string, ContouredFootprintSlot>,
  boundarySpacing: number,
  smoothingRadius: number,
): ClusterConstruction | null {
  const outlineCircles = cluster
    .map((item) => {
      const slot = slotsById.get(item.id);
      return slot
        ? {
            cx: item.cx,
            cy: item.cy,
            rOuter: Math.max(slot.profile.width, slot.profile.height) / 2 +
              slot.profile.outerOffset + boundarySpacing,
          }
        : null;
    })
    .filter((item): item is OutlineCircle => item !== null);
  if (outlineCircles.length !== cluster.length) return null;

  if (cluster.length === 1) {
    const item = outlineCircles[0];
    return {
      geometry: translate(
        [item.cx, item.cy],
        circle({
          radius: item.rOuter,
          segments: RENDER_CONFIG.cylinderSegments,
        }),
      ) as Geom2,
      usedSmoothingFallback: false,
    };
  }

  const outline = generateOutlineGeom2(
    outlineCircles,
    smoothingRadius,
    RENDER_CONFIG.cylinderSegments,
  );
  if (outline) {
    return { geometry: outline, usedSmoothingFallback: false };
  }

  const parts = outlineCircles.map((item) =>
    translate(
      [item.cx, item.cy],
      circle({
        radius: item.rOuter,
        segments: RENDER_CONFIG.cylinderSegments,
      }),
    ) as Geom2,
  );
  if (parts.length === 0) return null;
  return {
    geometry: parts.length === 1 ? parts[0] : union(...parts),
    usedSmoothingFallback: smoothingRadius > 0,
  };
}

function constructCluster(
  cluster: readonly ConnectivityCircle[],
  slotsById: ReadonlyMap<string, ContouredFootprintSlot>,
  boundarySpacing: number,
  smoothingRadius: number,
): ClusterConstruction | null {
  const containsEllipse = cluster.some(
    (item) => slotsById.get(item.id)?.shape === "ellipse",
  );
  return containsEllipse
    ? buildProfileClusterFootprint(
        cluster,
        slotsById,
        boundarySpacing,
        smoothingRadius,
      )
    : buildCircularClusterFootprint(
        cluster,
        slotsById,
        boundarySpacing,
        smoothingRadius,
      );
}

function boundsFromGeometry(geometry: Geom2): ContouredFootprintBounds {
  const [min, max] = measureBoundingBox(geometry);
  return { minX: min[0], maxX: max[0], minY: min[1], maxY: max[1] };
}

function unionBounds(
  bodies: readonly ContouredFootprintBody[],
): ContouredFootprintBounds | null {
  if (bodies.length === 0) return null;
  return {
    minX: Math.min(...bodies.map((body) => body.bounds.minX)),
    maxX: Math.max(...bodies.map((body) => body.bounds.maxX)),
    minY: Math.min(...bodies.map((body) => body.bounds.minY)),
    maxY: Math.max(...bodies.map((body) => body.bounds.maxY)),
  };
}

function pointInRing(
  x: number,
  y: number,
  ring: readonly ContouredFootprintPoint[],
): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    const crosses = (currentPoint.y > y) !== (previousPoint.y > y) &&
      x < ((previousPoint.x - currentPoint.x) * (y - currentPoint.y)) /
        (previousPoint.y - currentPoint.y) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function ringArea(ring: readonly ContouredFootprintPoint[]) {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const next = ring[(index + 1) % ring.length];
    area += ring[index].x * next.y - next.x * ring[index].y;
  }
  return area / 2;
}

function pointInBody(
  x: number,
  y: number,
  body: ContouredFootprintBody,
): boolean {
  let inside = false;
  for (const ring of body.outlines) {
    if (pointInRing(x, y, ring)) inside = !inside;
  }
  return inside;
}

function circleFitsFootprint(
  bodies: readonly ContouredFootprintBody[],
  x: number,
  y: number,
  radius: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) {
    return false;
  }
  return bodies.some((body) => {
    if (!pointInBody(x, y, body)) return false;
    for (let index = 0; index < CIRCLE_CONTAINMENT_SAMPLES; index += 1) {
      const angle = (Math.PI * 2 * index) / CIRCLE_CONTAINMENT_SAMPLES;
      const sampleX = x + Math.cos(angle) * radius;
      const sampleY = y + Math.sin(angle) * radius;
      if (!pointInBody(sampleX, sampleY, body)) return false;
    }
    return true;
  });
}

function invalidNumber(value: number) {
  return !Number.isFinite(value);
}

function validatePlan(
  plan: ContouredFootprintPlan,
): ContouredFootprintConstructionError | null {
  if (!plan || !Array.isArray(plan.requests)) {
    return { code: "invalid-plan", message: "轮廓派生计划无效" };
  }
  const requestKeys = new Set<string>();
  for (const request of plan.requests) {
    if (!request || typeof request.key !== "string" || request.key.length === 0) {
      return { code: "invalid-plan", message: "轮廓请求缺少稳定 key" };
    }
    if (requestKeys.has(request.key)) {
      return {
        code: "duplicate-request-key",
        requestKey: request.key,
        message: `轮廓请求 key 重复: ${request.key}`,
      };
    }
    requestKeys.add(request.key);
    for (const [field, value] of [
      ["slotSpacing", request.slotSpacing],
      ["boundarySpacing", request.boundarySpacing],
      ["smoothingRadius", request.smoothingRadius],
      ["disconnectDistance", request.disconnectDistance],
    ] as const) {
      if (invalidNumber(value) || value < 0) {
        return {
          code: "invalid-contour-parameters",
          requestKey: request.key,
          message: `${field} 必须是非负有限数值`,
        };
      }
    }
    if (!Array.isArray(request.slots)) {
      return {
        code: "invalid-plan",
        requestKey: request.key,
        message: "轮廓请求 slots 无效",
      };
    }
    const slotIds = new Set<string>();
    for (const slot of request.slots) {
      const invalid = !slot || typeof slot.id !== "string" || !slot.id ||
        slotIds.has(slot.id) ||
        (slot.shape !== "circle" && slot.shape !== "ellipse") ||
        [slot.cx, slot.cy, slot.rotation, slot.profile?.width,
          slot.profile?.height, slot.profile?.outerOffset]
          .some((value) => typeof value !== "number" || invalidNumber(value)) ||
        slot.profile.width <= 0 || slot.profile.height <= 0 ||
        slot.profile.outerOffset < 0 ||
        (slot.profile.profileExponent !== undefined &&
          (invalidNumber(slot.profile.profileExponent) || slot.profile.profileExponent <= 0));
      if (invalid) {
        return {
          code: "invalid-slot-geometry-snapshot",
          requestKey: request.key,
          slotIds: slot?.id ? [slot.id] : undefined,
          message: `请求 ${request.key} 包含无效 Slot Geometry Snapshot`,
        };
      }
      slotIds.add(slot.id);
    }
  }
  return null;
}

function constructRequest(
  request: ContouredFootprintRequest,
): ConstructedContouredFootprint | ContouredFootprintConstructionError {
  if (request.slots.length === 0) {
    return {
      key: request.key,
      bodies: [],
      bodyCount: 0,
      bounds: null,
      area: 0,
      diagnostics: [],
      containsExpandedCircle: () => false,
    };
  }

  const slots = [...request.slots].sort((left, right) => left.id.localeCompare(right.id));
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const connectivityCircles: ConnectivityCircle[] = slots.map((slot) => ({
    id: slot.id,
    cx: slot.cx,
    cy: slot.cy,
    rOuter: getConnectivityRadius(
      slot.profile.width,
      slot.profile.height,
      request.slotSpacing,
      slot.profile.outerOffset * 2,
      slot.profile.outerOffset * 2,
    ),
  }));
  const clusters = clusterConnectivityCircles(
    connectivityCircles,
    getEffectiveBridgeGap(request.smoothingRadius, request.disconnectDistance),
  ).map((cluster) => [...cluster].sort((left, right) => left.id.localeCompare(right.id)));

  const diagnostics: ContouredFootprintDiagnostic[] = [];
  const bodies: ContouredFootprintBody[] = [];
  for (const cluster of clusters) {
    const slotIds = cluster.map((item) => item.id);
    let construction: ClusterConstruction | null;
    try {
      construction = constructCluster(
        cluster,
        slotsById,
        request.boundarySpacing,
        request.smoothingRadius,
      );
    } catch (cause) {
      return {
        code: "cluster-construction-failed",
        requestKey: request.key,
        slotIds,
        cause,
        message: `槽群 ${slotIds.join(", ")} 的轮廓构造失败`,
      };
    }
    if (!construction) {
      return {
        code: "cluster-construction-failed",
        requestKey: request.key,
        slotIds,
        message: `槽群 ${slotIds.join(", ")} 未生成有效轮廓`,
      };
    }
    const outlines = geom2.toOutlines(construction.geometry).map((ring) =>
      ring.map(([x, y]) => ({ x, y })),
    );
    if (outlines.length === 0 || outlines.some((ring) => ring.length < 3)) {
      return {
        code: "cluster-construction-failed",
        requestKey: request.key,
        slotIds,
        message: `槽群 ${slotIds.join(", ")} 生成了退化轮廓`,
      };
    }
    bodies.push({
      geometry: construction.geometry,
      outlines,
      outerOutline: outlines.reduce((largest, ring) =>
        Math.abs(ringArea(ring)) > Math.abs(ringArea(largest)) ? ring : largest,
      outlines[0]),
      bounds: boundsFromGeometry(construction.geometry),
      area: Math.abs(measureArea(construction.geometry)),
      slotIds,
    });
    if (construction.usedSmoothingFallback) {
      diagnostics.push({
        code: "smoothing-fallback",
        requestKey: request.key,
        slotIds,
        message: "平滑轮廓构造失败，已退回未平滑轮廓",
      });
    }
  }

  bodies.sort((left, right) => (left.slotIds[0] ?? "").localeCompare(right.slotIds[0] ?? ""));
  const bounds = unionBounds(bodies);
  return {
    key: request.key,
    bodies,
    bodyCount: bodies.length,
    bounds,
    area: bodies.reduce((sum, body) => sum + body.area, 0),
    diagnostics,
    containsExpandedCircle: (x, y, radius) =>
      circleFitsFootprint(bodies, x, y, radius),
  };
}

export function constructContouredFootprints(
  plan: ContouredFootprintPlan,
): ContouredFootprintConstructionOutcome {
  const validationError = validatePlan(plan);
  if (validationError) return { ok: false, error: validationError };

  const footprints: ConstructedContouredFootprint[] = [];
  for (const request of plan.requests) {
    const constructed = constructRequest(request);
    if ("code" in constructed) {
      return { ok: false, error: constructed };
    }
    footprints.push(constructed);
  }
  return {
    ok: true,
    value: {
      footprints,
      diagnostics: footprints.flatMap((footprint) => footprint.diagnostics),
    },
  };
}
