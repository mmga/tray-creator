import {
  booleans,
  geometries,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";
import { RENDER_CONFIG } from "@/lib/config";
import { resolveMagneticBaseHolePreset } from "@/lib/base-hole-config";
import { roundLayoutDimensionToTenth } from "@/lib/custom-layout-math";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import {
  clusterConnectivityCircles,
  getConnectivityRadius,
  getEffectiveBridgeGap,
  type ConnectivityCircle,
} from "@/lib/stepped-connectivity";
import { getEffectiveGroupStructureParams } from "@/lib/stepped-group-params";
import {
  buildContouredClusterFootprint,
  type ContouredFootprintSlot,
} from "@/lib/contoured-footprint";
import {
  getSteppedGroupMinBottomHeight,
  resolveMagnetPostHoleDepth,
  resolveMagnetPostHoleDiameter,
} from "@/lib/stepped-base-hole";

const { union } = booleans;
const { geom2 } = geometries;
const { circle } = primitives;
const { translate } = transforms;

function getSlotBoundingHalfSize(
  width: number,
  height: number,
  rotation: number,
  shape: SteppedSlot["shape"],
  offset: number,
  profileExponent?: number,
) {
  const rad = (rotation * Math.PI) / 180;
  const points = sampleSlotProfilePoints(
    width,
    height,
    shape,
    offset,
    RENDER_CONFIG.cylinderSegments,
    profileExponent,
  );
  let halfW = 0;
  let halfH = 0;

  for (const point of points) {
    const x = point.x * Math.cos(rad) - point.y * Math.sin(rad);
    const y = point.x * Math.sin(rad) + point.y * Math.cos(rad);
    halfW = Math.max(halfW, Math.abs(x));
    halfH = Math.max(halfH, Math.abs(y));
  }

  return { halfW, halfH };
}

function createOffsetSlotShape(
  width: number,
  height: number,
  shape: SteppedSlot["shape"],
  offset: number,
  profileExponent?: number,
): Geom2 {
  if (shape === "circle" && offset <= 0) {
    return circle({
      radius: width / 2,
      segments: RENDER_CONFIG.cylinderSegments,
    });
  }

  const points = sampleSlotProfilePoints(
    width,
    height,
    shape,
    offset,
    RENDER_CONFIG.cylinderSegments,
    profileExponent,
  ).map((point): [number, number] => [point.x, point.y]);

  return geom2.fromPoints(points);
}

function calculateEffectiveBaseplate(params: SteppedLayoutParams) {
  // boundary spacing 缺失时跟随 spacing（CONTEXT:613）；rectangular 与 contoured 共用此规则
  const boundarySpacingIndependent = params.boundarySpacingIndependent === true;
  const boundarySpacing = boundarySpacingIndependent
    ? (params.boundarySpacing ?? params.spacing)
    : params.spacing;

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
    const profile = getFreeSlotProfileGeometry(slot);
    const { halfW, halfH } = getSlotBoundingHalfSize(
      profile.width,
      profile.height,
      slot.rotation,
      slot.shape,
      profile.outerOffset,
      profile.profileExponent,
    );
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  });

  return {
    hasSlots: true,
    width: roundLayoutDimensionToTenth(maxX - minX + boundarySpacing * 2),
    depth: roundLayoutDimensionToTenth(maxY - minY + boundarySpacing * 2),
    minX,
    maxX,
    minY,
    maxY,
  };
}

type NormalizedSlotData = ReturnType<typeof buildNormalizedSlotData>["slots"][number];

export interface SteppedCadLayerFeature {
  id: string;
  fromHeight: number;
  toHeight: number;
  groupIds: string[];
  footprint: Geom2;
}

export interface SteppedCadGroupFeature {
  groupId: string;
  columnHeight: number;
  footprint: Geom2;
}

export interface SteppedCadSlotHoleFeature {
  id: string;
  groupId: string;
  cx: number;
  cy: number;
  rotation: number;
  topHeight: number;
  depth: number;
  connectorRadius: number;
  profile: Geom2;
}

export interface SteppedCadBaseHoleFeature {
  groupId: string;
  cx: number;
  cy: number;
  baseHoleSize: ReturnType<typeof resolveMagneticBaseHolePreset>;
  baseThickness: number;
}

export interface SteppedCadMagnetPostHoleFeature {
  id: string;
  groupId: string;
  cx: number;
  cy: number;
  topHeight: number;
  diameter: number;
  depth: number;
}

export interface SteppedCadFeatureGraph {
  trayWidth: number;
  trayDepth: number;
  maxHeight: number;
  groups: SteppedCadGroupFeature[];
  layers: SteppedCadLayerFeature[];
  slotHoles: SteppedCadSlotHoleFeature[];
  baseHoles: SteppedCadBaseHoleFeature[];
  magnetPostHoles: SteppedCadMagnetPostHoleFeature[];
}

function buildNormalizedSlotData(params: SteppedLayoutParams) {
  const effective = calculateEffectiveBaseplate(params);
  const trayWidth = effective.hasSlots ? effective.width : params.trayWidth;
  const trayDepth = effective.hasSlots ? effective.depth : params.trayDepth;
  const sourceCenterX = effective.hasSlots
    ? (effective.minX + effective.maxX) / 2
    : trayWidth / 2;
  const sourceCenterY = effective.hasSlots
    ? (effective.minY + effective.maxY) / 2
    : trayDepth / 2;

  const slots = params.slots.map((slot) => {
    const group = params.groups.find((candidate) => candidate.id === slot.groupId);
    const normalizedX = slot.x - sourceCenterX + trayWidth / 2;
    const normalizedY = slot.y - sourceCenterY + trayDepth / 2;
    const cx = normalizedX - trayWidth / 2;
    const cy = normalizedY - trayDepth / 2;
    const profile = getFreeSlotProfileGeometry(slot);
    const columnHeight = Math.max(
      group?.bottomHeight ?? 10,
      group ? getSteppedGroupMinBottomHeight(params, group.id) : 3,
      3,
    );
    return {
      slot,
      group,
      groupId: slot.groupId,
      cx,
      cy,
      rotation: slot.rotation || 0,
      profile,
      columnHeight,
    };
  });

  return {
    trayWidth,
    trayDepth,
    slots,
  };
}

function buildClusteredFootprint(
  slotData: NormalizedSlotData[],
  spacing: number,
  structureParams: Pick<SteppedLayoutParams, "smoothingRadius" | "disconnectDistance">,
): Geom2 | null {
  if (slotData.length === 0) {
    return null;
  }

  const connectivityCircles: ConnectivityCircle[] = slotData.map((item) => ({
    id: item.slot.id,
    cx: item.cx,
    cy: item.cy,
    rOuter: getConnectivityRadius(
      item.slot.width,
      item.slot.height,
      spacing,
      item.profile.outerOffset * 2,
      item.profile.outerOffset * 2,
    ),
  }));

  const clusters = clusterConnectivityCircles(
    connectivityCircles,
    getEffectiveBridgeGap(
      structureParams.smoothingRadius,
      structureParams.disconnectDistance,
    ),
  );
  const footprintSlotsById = new Map<string, ContouredFootprintSlot>(
    slotData.map((item) => [
      item.slot.id,
      {
        id: item.slot.id,
        cx: item.cx,
        cy: item.cy,
        rotation: item.rotation,
        shape: item.slot.shape,
        profile: item.profile,
      },
    ]),
  );

  const outlines = clusters
    .map((cluster) =>
      buildContouredClusterFootprint(
        cluster,
        footprintSlotsById,
        spacing,
        structureParams.smoothingRadius,
      ),
    )
    .filter((item): item is Geom2 => item !== null);

  if (outlines.length === 0) {
    return null;
  }

  return outlines.length === 1 ? outlines[0] : union(...outlines);
}

/**
 * 解析阶梯模式的底座轮廓样式；缺失时默认 contoured 以兼容旧阶梯文件（CONTEXT:592）。
 */
function resolveSteppedFootprintStyle(
  params: Pick<SteppedLayoutParams, "footprintStyle">,
): "rectangular" | "contoured" {
  return params.footprintStyle === "rectangular" ? "rectangular" : "contoured";
}

/**
 * 计算一组 slot 的轴对齐矩形包络（含 boundary spacing 外扩）。
 * 包络在托盘坐标系中保持轴对齐，并包含旋转后的最终槽位几何（CONTEXT:243-245）。
 */
function calculateAxisAlignedEnvelope(
  slotData: NormalizedSlotData[],
  boundarySpacing: number,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (slotData.length === 0) {
    return null;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const item of slotData) {
    const { halfW, halfH } = getSlotBoundingHalfSize(
      item.profile.width,
      item.profile.height,
      item.rotation,
      item.slot.shape,
      item.profile.outerOffset,
      item.profile.profileExponent,
    );
    minX = Math.min(minX, item.cx - halfW);
    maxX = Math.max(maxX, item.cx + halfW);
    minY = Math.min(minY, item.cy - halfH);
    maxY = Math.max(maxY, item.cy + halfH);
  }
  return {
    minX: minX - boundarySpacing,
    maxX: maxX + boundarySpacing,
    minY: minY - boundarySpacing,
    maxY: maxY + boundarySpacing,
  };
}

/**
 * 构造矩形 Geom2（轴对齐，可选圆角）。
 * center 为矩形中心；rotateZ(0) 保证轴对齐。
 */
function buildRectangleFootprint(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  cornerRadius = 0,
): Geom2 {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxY - bounds.minY;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const safeRadius = Math.max(0, Math.min(cornerRadius, width / 2 - 0.01, depth / 2 - 0.01));

  if (safeRadius <= 0) {
    return primitives.rectangle({ size: [width, depth], center: [cx, cy] });
  }

  // 圆角矩形：用 4 段圆弧 + 4 段直线采样构造闭合多边形
  const segmentsPerArc = 8;
  const points: [number, number][] = [];
  const corners = [
    { x: bounds.maxX - safeRadius, y: bounds.maxY - safeRadius, startAngle: 0 },
    { x: bounds.minX + safeRadius, y: bounds.maxY - safeRadius, startAngle: Math.PI / 2 },
    { x: bounds.minX + safeRadius, y: bounds.minY + safeRadius, startAngle: Math.PI },
    { x: bounds.maxX - safeRadius, y: bounds.minY + safeRadius, startAngle: -Math.PI / 2 },
  ];
  for (const corner of corners) {
    for (let i = 0; i < segmentsPerArc; i += 1) {
      const angle = corner.startAngle + (Math.PI / 2) * (i / segmentsPerArc);
      points.push([
        corner.x + safeRadius * Math.cos(angle),
        corner.y + safeRadius * Math.sin(angle),
      ]);
    }
  }
  return translate([0, 0], geom2.fromPoints(points));
}

/**
 * 为阶梯模式构造 Rectangular Stepped Footprint（CONTEXT:235-237,601-603）。
 *
 * - 最低连续层：所有槽位的整体轴对齐包络 + boundary spacing；应用模型级 cornerRadius。
 *   若 traySizingMode=fixed，使用配置的 trayWidth/trayDepth 作为最低层尺寸。
 * - 更高高度带：每个高度组各自的轴对齐包络 + boundary spacing，直角（不应用 cornerRadius）。
 * - fixed sizing 仅决定最低层；不传播到更高分组（CONTEXT:603）。
 */
function buildRectangularSteppedGroupFootprint(
  ownSlotData: NormalizedSlotData[],
  higherSlotData: NormalizedSlotData[],
  params: SteppedLayoutParams,
  isLowestLayer: boolean,
  lowestLayerBounds?: { minX: number; maxX: number; minY: number; maxY: number } | null,
): Geom2 | null {
  const boundarySpacingIndependent = params.boundarySpacingIndependent === true;
  const boundarySpacing = boundarySpacingIndependent
    ? (params.boundarySpacing ?? params.spacing)
    : params.spacing;

  // 最低连续层：用整体包络（含所有槽位）或 fixed sizing
  if (isLowestLayer) {
    if (params.traySizingMode === "fixed" && params.trayWidth > 0 && params.trayDepth > 0) {
      return buildRectangleFootprint(
        {
          minX: -params.trayWidth / 2,
          maxX: params.trayWidth / 2,
          minY: -params.trayDepth / 2,
          maxY: params.trayDepth / 2,
        },
        params.cornerRadius ?? 0,
      );
    }
    if (lowestLayerBounds) {
      return buildRectangleFootprint(lowestLayerBounds, params.cornerRadius ?? 0);
    }
    return null;
  }

  // 更高高度带：本组包络 + 更高槽位包络的并集；保持直角（CONTEXT:601）
  const allSlots = [...ownSlotData, ...higherSlotData];
  const bounds = calculateAxisAlignedEnvelope(allSlots, boundarySpacing);
  if (!bounds) {
    return null;
  }
  return buildRectangleFootprint(bounds, 0);
}

export function buildSteppedCadFeatureGraph(
  params: SteppedLayoutParams,
): SteppedCadFeatureGraph {
  const { trayWidth, trayDepth, slots } = buildNormalizedSlotData(params);
  if (slots.length === 0 || params.groups.length === 0) {
    return {
      trayWidth,
      trayDepth,
      maxHeight: 0,
      groups: [],
      layers: [],
      slotHoles: [],
      baseHoles: [],
      magnetPostHoles: [],
    };
  }

  const footprintStyle = resolveSteppedFootprintStyle(params);
  const boundarySpacingIndependent = params.boundarySpacingIndependent === true;
  const boundarySpacing = boundarySpacingIndependent
    ? (params.boundarySpacing ?? params.spacing)
    : params.spacing;

  // 预计算最低连续层的整体包络（rectangular 下复用）
  const lowestLayerBounds = footprintStyle === "rectangular"
    ? calculateAxisAlignedEnvelope(slots, boundarySpacing)
    : null;

  // 找出最低 columnHeight，用于判定哪个 group 是"最低连续层"
  const allColumnHeights = params.groups
    .map((group) => Math.max(group.bottomHeight, 3))
    .filter((height, _index, arr) => arr.length > 0);
  const lowestColumnHeight = allColumnHeights.length > 0
    ? Math.min(...allColumnHeights)
    : 0;

  const groups = params.groups
    .map<SteppedCadGroupFeature | null>((group) => {
      const ownSlots = slots.filter((slot) => slot.groupId === group.id);
      if (ownSlots.length === 0) {
        return null;
      }

      const columnHeight = Math.max(
        group.bottomHeight,
        getSteppedGroupMinBottomHeight(params, group.id),
        3,
      );
      const contextSlots = slots.filter((slot) => {
        if (slot.groupId === group.id) {
          return false;
        }
        return slot.columnHeight > columnHeight;
      });

      let footprint: Geom2 | null = null;
      if (footprintStyle === "rectangular") {
        // 最低 columnHeight 的分组使用最低连续层包络；其余分组用各自的矩形包络
        const isLowestLayer = columnHeight <= lowestColumnHeight + 1e-6;
        footprint = buildRectangularSteppedGroupFootprint(
          ownSlots,
          contextSlots,
          params,
          isLowestLayer,
          isLowestLayer ? lowestLayerBounds : null,
        );
      } else {
        footprint = buildClusteredFootprint(
          [...ownSlots, ...contextSlots],
          params.spacing,
          getEffectiveGroupStructureParams(group, params),
        );
      }

      if (!footprint) {
        return null;
      }

      return {
        groupId: group.id,
        columnHeight,
        footprint,
      };
    })
    .filter((item): item is SteppedCadGroupFeature => item !== null);

  const heights = [...new Set(groups.map((item) => item.columnHeight))]
    .filter((height) => height > 0)
    .sort((left, right) => left - right);

  let previousHeight = 0;
  const layers: SteppedCadLayerFeature[] = [];

  for (const height of heights) {
    const activeFootprints = groups.filter(
      (item) => item.columnHeight >= height,
    );
    if (activeFootprints.length === 0 || height <= previousHeight) {
      previousHeight = height;
      continue;
    }

    const footprint = activeFootprints.length === 1
      ? activeFootprints[0].footprint
      : union(...activeFootprints.map((item) => item.footprint));

    layers.push({
      id: `layer-${previousHeight}-${height}`,
      fromHeight: previousHeight,
      toHeight: height,
      groupIds: activeFootprints.map((item) => item.groupId),
      footprint,
    });
    previousHeight = height;
  }

  const slotHoles: SteppedCadSlotHoleFeature[] = slots.map((slot) => {
    const clampedDepth = Math.min(params.holeDepth, slot.columnHeight);
    return {
      id: slot.slot.id,
      groupId: slot.groupId,
      cx: slot.cx,
      cy: slot.cy,
      rotation: slot.rotation,
      topHeight: slot.columnHeight,
      depth: clampedDepth,
      connectorRadius: getConnectivityRadius(
        slot.slot.width,
        slot.slot.height,
        params.spacing,
        slot.profile.outerOffset * 2,
        slot.profile.outerOffset * 2,
      ),
      profile: createOffsetSlotShape(
        slot.profile.width,
        slot.profile.height,
        slot.slot.shape,
        slot.profile.outerOffset,
        slot.profile.profileExponent,
      ),
    };
  });

  const baseHoles: SteppedCadBaseHoleFeature[] = slots.map((slot) => {
    const clampedDepth = Math.min(params.holeDepth, slot.columnHeight);
    return {
      groupId: slot.groupId,
      cx: slot.cx,
      cy: slot.cy,
      baseHoleSize: resolveMagneticBaseHolePreset(
        slot.slot.shape,
        slot.slot.width,
        slot.slot.height,
      ),
      baseThickness: Math.max(slot.columnHeight - clampedDepth, 0),
    };
  });

  const magnetPostHoleDiameter = resolveMagnetPostHoleDiameter(params);
  const magnetPostHoleDepth = resolveMagnetPostHoleDepth(params);
  const magnetPostHoles: SteppedCadMagnetPostHoleFeature[] = slots.map((slot) => {
    const clampedSlotDepth = Math.min(params.holeDepth, slot.columnHeight);
    return {
      id: slot.slot.id,
      groupId: slot.groupId,
      cx: slot.cx,
      cy: slot.cy,
      topHeight: slot.columnHeight - clampedSlotDepth,
      diameter: magnetPostHoleDiameter,
      depth: magnetPostHoleDepth,
    };
  });

  const maxHeight = heights.length > 0 ? heights[heights.length - 1] : 0;

  return {
    trayWidth,
    trayDepth,
    maxHeight,
    groups,
    layers,
    slotHoles,
    baseHoles,
    magnetPostHoles,
  };
}
