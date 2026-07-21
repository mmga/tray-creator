import {
  booleans,
  geometries,
  primitives,
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
      const footprint = buildClusteredFootprint(
        [...ownSlots, ...contextSlots],
        params.spacing,
        getEffectiveGroupStructureParams(group, params),
      );

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
