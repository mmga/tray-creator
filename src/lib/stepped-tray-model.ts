import {
  booleans,
  primitives,
  transforms,
  extrusions,
  measurements,
  geometries,
} from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";
import { RENDER_CONFIG } from "@/lib/config";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import {
  generateOutlineGeom2,
  type OutlineCircle,
} from "@/lib/outline-geometry";
import {
  clusterConnectivityCircles,
  getConnectivityRadius,
  getEffectiveBridgeGap,
  type ConnectivityCircle,
} from "@/lib/stepped-connectivity";
import { getEffectiveGroupStructureParams } from "@/lib/stepped-group-params";

const { intersect, subtract, union } = booleans;
const { translate, rotateZ } = transforms;
const { cuboid, ellipse, circle } = primitives;
const { extrudeLinear } = extrusions;
const { measureVolume } = measurements;
const { geom2 } = geometries;

const DEG_TO_RAD = Math.PI / 180;
const SPLIT_EPSILON = 0.02;

export interface SteppedSplitConnectorOptions {
  enabled?: boolean;
  diameter?: number;
  clearance?: number;
  depth?: number;
  maxPerInterface?: number;
  interfaceGrooveDepth?: number;
}

export interface SteppedSplitPart {
  index: number;
  filenameLabel: string;
  label: string;
  fromHeight: number;
  toHeight: number;
  geometry: Geom3;
  connectorCount: number;
}

const DEFAULT_SPLIT_CONNECTORS: Required<SteppedSplitConnectorOptions> = {
  enabled: true,
  diameter: 3,
  clearance: 0.2,
  depth: 3,
  maxPerInterface: 4,
  interfaceGrooveDepth: 2,
};

function getSlotBoundingHalfSize(
  width: number,
  height: number,
  rotation: number,
  shape: SteppedSlot["shape"],
  offset: number,
) {
  const rad = (rotation * Math.PI) / 180;
  const points = sampleSlotProfilePoints(
    width,
    height,
    shape,
    offset,
    RENDER_CONFIG.cylinderSegments,
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
): Geom2 {
  if (offset <= 0) {
    return ellipse({
      radius: [width / 2, height / 2],
      segments: RENDER_CONFIG.cylinderSegments,
    });
  }

  const points = sampleSlotProfilePoints(
    width,
    height,
    shape,
    offset,
    RENDER_CONFIG.cylinderSegments,
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

type NormalizedSlotData = ReturnType<typeof buildNormalizedSlotData>["slots"][number];

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
    const group = params.groups.find((g) => g.id === slot.groupId);
    const normalizedX = slot.x - sourceCenterX + trayWidth / 2;
    const normalizedY = slot.y - sourceCenterY + trayDepth / 2;
    const cx = normalizedX - trayWidth / 2;
    const cy = normalizedY - trayDepth / 2;
    const rotation = slot.rotation || 0;
    const profile = getFreeSlotProfileGeometry(slot);
    const actualW = profile.width + profile.outerOffset * 2;
    const actualH = profile.height + profile.outerOffset * 2;
    const columnHeight = Math.max(group?.bottomHeight ?? 10, 3);
    return {
      slot,
      cx,
      cy,
      rotation,
      actualW,
      actualH,
      profile,
      columnHeight,
      groupId: slot.groupId,
    };
  });

  return {
    effective,
    trayWidth,
    trayDepth,
    slots,
  };
}

function buildConnectorCylinder(
  radius: number,
  depth: number,
  z: number,
): Geom3 {
  return translate(
    [0, 0, z],
    extrudeLinear(
      { height: depth },
      circle({ radius, segments: RENDER_CONFIG.cylinderSegments }),
    ),
  );
}

function selectGroupConnectorPositions(
  leftSlotData: NormalizedSlotData[],
  rightSlotData: NormalizedSlotData[],
  radius: number,
  maxCount: number,
) {
  if (maxCount <= 0) return [];

  const candidates: { x: number; y: number; distance: number }[] = [];
  for (const left of leftSlotData) {
    for (const right of rightSlotData) {
      const dx = right.cx - left.cx;
      const dy = right.cy - left.cy;
      candidates.push({
        x: (left.cx + right.cx) / 2,
        y: (left.cy + right.cy) / 2,
        distance: Math.hypot(dx, dy),
      });
    }
  }

  const selected: { x: number; y: number }[] = [];
  const minimumSpacing = Math.max(radius * 4, 8);
  for (const candidate of candidates.sort((a, b) => a.distance - b.distance)) {
    if (selected.length >= maxCount) break;
    const isFarEnough = selected.every((existing) => {
      const dx = existing.x - candidate.x;
      const dy = existing.y - candidate.y;
      return Math.hypot(dx, dy) >= minimumSpacing;
    });
    if (isFarEnough) {
      selected.push({ x: candidate.x, y: candidate.y });
    }
  }

  return selected;
}

function buildSlotDataSolid(
  groupSlotData: NormalizedSlotData[],
  spacing: number,
  height: number,
  structureParams: Pick<
    SteppedLayoutParams,
    "smoothingRadius" | "disconnectDistance"
  >,
): Geom3 {
  const circleMap = new Map<string, ConnectivityCircle>();
  const slotDataMap = new Map<string, NormalizedSlotData>();

  for (const d of groupSlotData) {
    const rOuter = getConnectivityRadius(
      d.slot.width,
      d.slot.height,
      spacing,
      d.profile.outerOffset * 2,
      d.profile.outerOffset * 2,
    );
    circleMap.set(d.slot.id, { id: d.slot.id, cx: d.cx, cy: d.cy, rOuter });
    slotDataMap.set(d.slot.id, d);
  }

  const clusteredCircles = clusterConnectivityCircles(
    [...circleMap.values()],
    getEffectiveBridgeGap(
      structureParams.smoothingRadius,
      structureParams.disconnectDistance,
    ),
  );

  const solids = clusteredCircles.map((cluster) => {
    const outlineCircles: OutlineCircle[] = cluster.map((circle) => ({
      cx: circle.cx,
      cy: circle.cy,
      rOuter: circle.rOuter,
    }));

    const outlineGeom = generateOutlineGeom2(
      outlineCircles,
      structureParams.smoothingRadius,
      RENDER_CONFIG.cylinderSegments,
    );
    if (outlineGeom) {
      const extruded = extrudeLinear({ height }, outlineGeom);
      if (measureVolume(extruded) >= 0) return extruded;
    }

    const cols = cluster
      .map((circle) => slotDataMap.get(circle.id))
      .filter((item): item is NormalizedSlotData => Boolean(item))
      .map((d) => {
        const r = Math.max(d.actualW, d.actualH) / 2 + spacing;
        return translate(
          [d.cx, d.cy, 0],
          extrudeLinear(
            { height },
            circle({ radius: r, segments: RENDER_CONFIG.cylinderSegments }),
          ),
        );
      });

    return cols.length === 1 ? cols[0] : union(...cols);
  });

  return solids.length === 1 ? solids[0] : union(...solids);
}

function buildSteppedSlotHoles(
  slotData: NormalizedSlotData[],
  holeDepth: number,
): Geom3[] {
  const holes: Geom3[] = [];
  for (const d of slotData) {
    const clampedHoleDepth = Math.min(holeDepth, d.columnHeight);
    const holeShape = createOffsetSlotShape(
      d.profile.width,
      d.profile.height,
      d.slot.shape,
      d.profile.outerOffset,
    );
    const hole3D = extrudeLinear(
      { height: clampedHoleDepth + SPLIT_EPSILON },
      holeShape,
    );
    const rotatedHole = rotateZ(d.rotation * DEG_TO_RAD, hole3D);
    const holeZ = d.columnHeight - clampedHoleDepth;
    holes.push(translate([d.cx, d.cy, holeZ], rotatedHole));
  }

  return holes;
}

function buildSteppedGroupSolids(params: SteppedLayoutParams) {
  const { groups, spacing } = params;
  const { trayWidth, trayDepth, slots: slotData } =
    buildNormalizedSlotData(params);
  const groupSolids: {
    group: SteppedLayoutParams["groups"][number];
    solid: Geom3;
    columnHeight: number;
    slotData: NormalizedSlotData[];
  }[] = [];

  for (const group of groups) {
    const ownSlotData = slotData.filter((d) => d.groupId === group.id);
    if (ownSlotData.length === 0) continue;

    const columnHeight = Math.max(group.bottomHeight, 3);
    const effectiveParams = getEffectiveGroupStructureParams(group, params);

    const contextSlotData = slotData.filter((d) => {
      if (d.groupId === group.id) return false;
      const otherGroup = groups.find((g) => g.id === d.groupId);
      return otherGroup && Math.max(otherGroup.bottomHeight, 3) > columnHeight;
    });

    let groupSolid = buildSlotDataSolid(
      [...ownSlotData, ...contextSlotData],
      spacing,
      columnHeight,
      effectiveParams,
    );

    const clearances: Geom3[] = [];
    for (const otherGroup of groups) {
      const otherHeight = Math.max(otherGroup.bottomHeight, 3);
      if (otherHeight >= columnHeight) continue;

      for (const d of slotData.filter((sd) => sd.groupId === otherGroup.id)) {
        const clearanceR = Math.max(d.actualW, d.actualH) / 2;
        const clearanceH = columnHeight - otherHeight + SPLIT_EPSILON;
        const cyl = extrudeLinear(
          { height: clearanceH },
          circle({
            radius: clearanceR,
            segments: RENDER_CONFIG.cylinderSegments,
          }),
        );
        clearances.push(translate([d.cx, d.cy, otherHeight], cyl));
      }
    }

    if (clearances.length > 0) {
      groupSolid = subtract(groupSolid, ...clearances);
    }

    groupSolids.push({
      group,
      solid: groupSolid,
      columnHeight,
      slotData: ownSlotData,
    });
  }

  return {
    trayWidth,
    trayDepth,
    slotData,
    groupSolids,
  };
}

function getGroupCenter(slotData: NormalizedSlotData[]) {
  const totals = slotData.reduce(
    (acc, slot) => ({
      x: acc.x + slot.cx,
      y: acc.y + slot.cy,
    }),
    { x: 0, y: 0 },
  );
  const count = Math.max(slotData.length, 1);
  return {
    x: totals.x / count,
    y: totals.y / count,
  };
}

function buildSameHeightPartitionMap(
  groupSolids: ReturnType<typeof buildSteppedGroupSolids>["groupSolids"],
  trayWidth: number,
  trayDepth: number,
) {
  const partitions = new Map<string, Geom3>();
  const groupsByHeight = new Map<number, typeof groupSolids>();
  const maxHeight =
    groupSolids.length > 0
      ? Math.max(...groupSolids.map((group) => group.columnHeight))
      : 0;
  const margin = 100;

  for (const groupSolid of groupSolids) {
    const bucket = groupsByHeight.get(groupSolid.columnHeight) ?? [];
    bucket.push(groupSolid);
    groupsByHeight.set(groupSolid.columnHeight, bucket);
  }

  for (const heightGroup of groupsByHeight.values()) {
    if (heightGroup.length < 2) continue;

    const entries = heightGroup.map((groupSolid) => ({
      groupSolid,
      center: getGroupCenter(groupSolid.slotData),
    }));
    const xSpread =
      Math.max(...entries.map((entry) => entry.center.x)) -
      Math.min(...entries.map((entry) => entry.center.x));
    const ySpread =
      Math.max(...entries.map((entry) => entry.center.y)) -
      Math.min(...entries.map((entry) => entry.center.y));
    const axis = xSpread >= ySpread ? "x" : "y";
    const sorted = entries.sort((a, b) => a.center[axis] - b.center[axis]);

    for (let index = 0; index < sorted.length; index += 1) {
      const previousBoundary =
        index === 0
          ? (axis === "x" ? -trayWidth / 2 : -trayDepth / 2) - margin
          : (sorted[index - 1].center[axis] + sorted[index].center[axis]) / 2;
      const nextBoundary =
        index === sorted.length - 1
          ? (axis === "x" ? trayWidth / 2 : trayDepth / 2) + margin
          : (sorted[index].center[axis] + sorted[index + 1].center[axis]) / 2;
      const width =
        axis === "x" ? nextBoundary - previousBoundary : trayWidth + margin * 2;
      const depth =
        axis === "y" ? nextBoundary - previousBoundary : trayDepth + margin * 2;
      const centerX =
        axis === "x" ? (previousBoundary + nextBoundary) / 2 : 0;
      const centerY =
        axis === "y" ? (previousBoundary + nextBoundary) / 2 : 0;

      partitions.set(
        sorted[index].groupSolid.group.id,
        cuboid({
          size: [width, depth, maxHeight + margin * 2],
          center: [centerX, centerY, maxHeight / 2],
        }),
      );
    }
  }

  return partitions;
}

function buildGroupFootprintCutter(
  params: SteppedLayoutParams,
  groupSolid: {
    group: SteppedLayoutParams["groups"][number];
    slotData: NormalizedSlotData[];
  },
  depth: number,
  zBase: number,
): Geom3 | null {
  if (depth <= 0 || groupSolid.slotData.length === 0) {
    return null;
  }

  return translate(
    [0, 0, zBase],
    buildSlotDataSolid(
      groupSolid.slotData,
      params.spacing,
      depth,
      getEffectiveGroupStructureParams(groupSolid.group, params),
    ),
  );
}

/**
 * 根据阶梯底座参数生成托盘 3D 模型（按组独立实体 + 纳入更高组为平滑连接上下文）
 *
 * 结构说明：
 * - 每个分组独立生成自己的实体（组间不共享轮廓，同高度组互不干扰）
 * - 计算某组的平滑轮廓时，额外纳入"所有高度严格更高的组"的凹槽作为上下文
 *   → 低组实体自然包裹高组圆柱脚印，实现"低层过渡包围高层圆柱"的平滑效果
 *   → 同高度的不同组互不纳入，保持各自独立
 * - 每组实体高度 = group.bottomHeight，从 z=0 向上生长
 * - 高组在其实体内减除低组凹槽正上方的让位空间（避免高组连接桥侵占低组插槽上方）
 * - 所有组实体 union 后形成最终底座
 * - 每个凹槽从其所在组顶部向下挖 holeDepth 深度
 */
export function createSteppedTrayModel(params: SteppedLayoutParams): Geom3 {
  const { slots, groups, holeDepth } = params;

  if (slots.length === 0 || groups.length === 0) {
    return extrudeLinear(
      { height: 0.1 },
      ellipse({ radius: [1, 1], segments: 4 }),
    );
  }

  const { slotData, groupSolids } = buildSteppedGroupSolids(params);

  if (groupSolids.length === 0) {
    return extrudeLinear(
      { height: 0.1 },
      ellipse({ radius: [1, 1], segments: 4 }),
    );
  }

  const solid =
    groupSolids.length === 1
      ? groupSolids[0].solid
      : union(...groupSolids.map((part) => part.solid));

  const holes = buildSteppedSlotHoles(slotData, holeDepth);

  return holes.length > 0 ? subtract(solid, ...holes) : solid;
}

export function createSteppedSplitParts(
  params: SteppedLayoutParams,
  connectorOptions: SteppedSplitConnectorOptions = {},
): SteppedSplitPart[] {
  if (params.slots.length === 0 || params.groups.length === 0) {
    return [];
  }

  const connectorConfig = {
    ...DEFAULT_SPLIT_CONNECTORS,
    ...connectorOptions,
  };
  const connectorRadius =
    (connectorConfig.diameter + connectorConfig.clearance) / 2;
  const { trayWidth, trayDepth, groupSolids } = buildSteppedGroupSolids(params);
  const orderedGroupSolids = [...groupSolids].sort(
    (a, b) => a.columnHeight - b.columnHeight,
  );
  const parts: SteppedSplitPart[] = [];
  const claimedSolids: Geom3[] = [];
  const connectorMap = new Map<string, { x: number; y: number }[]>();
  const sameHeightPartitions = buildSameHeightPartitionMap(
    groupSolids,
    trayWidth,
    trayDepth,
  );

  if (connectorConfig.enabled) {
    for (
      let leftIndex = 0;
      leftIndex < orderedGroupSolids.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < orderedGroupSolids.length;
        rightIndex += 1
      ) {
        const left = orderedGroupSolids[leftIndex];
        const right = orderedGroupSolids[rightIndex];
        const positions = selectGroupConnectorPositions(
          left.slotData,
          right.slotData,
          connectorRadius,
          connectorConfig.maxPerInterface,
        );
        if (positions.length === 0) continue;

        connectorMap.set(left.group.id, [
          ...(connectorMap.get(left.group.id) ?? []),
          ...positions,
        ]);
        connectorMap.set(right.group.id, [
          ...(connectorMap.get(right.group.id) ?? []),
          ...positions,
        ]);
      }
    }
  }

  for (const [index, groupSolid] of orderedGroupSolids.entries()) {
    const partition = sameHeightPartitions.get(groupSolid.group.id);
    const partitionedSolid = partition
      ? intersect(groupSolid.solid, partition)
      : groupSolid.solid;
    const holes = buildSteppedSlotHoles(groupSolid.slotData, params.holeDepth);
    let part = holes.length > 0
      ? subtract(partitionedSolid, ...holes)
      : partitionedSolid;
    if (claimedSolids.length > 0) {
      part = subtract(part, ...claimedSolids);
    }

    const assignedPart = part;
    claimedSolids.push(assignedPart);

    const grooveCutters: Geom3[] = [];
    const interfaceGrooveDepth = Math.max(
      connectorConfig.interfaceGrooveDepth,
      0,
    );
    if (interfaceGrooveDepth > 0) {
      for (const otherGroupSolid of orderedGroupSolids) {
        if (otherGroupSolid.group.id === groupSolid.group.id) continue;

        if (otherGroupSolid.columnHeight > groupSolid.columnHeight) {
          const lowPocketDepth = Math.min(
            interfaceGrooveDepth,
            groupSolid.columnHeight,
          );
          const lowPocket = buildGroupFootprintCutter(
            params,
            otherGroupSolid,
            lowPocketDepth + SPLIT_EPSILON,
            groupSolid.columnHeight - lowPocketDepth,
          );
          if (lowPocket) {
            grooveCutters.push(lowPocket);
          }
        }

        if (otherGroupSolid.columnHeight < groupSolid.columnHeight) {
          const upperPocketDepth = Math.min(
            interfaceGrooveDepth,
            groupSolid.columnHeight - otherGroupSolid.columnHeight,
          );
          const upperPocket = buildGroupFootprintCutter(
            params,
            groupSolid,
            upperPocketDepth + SPLIT_EPSILON,
            otherGroupSolid.columnHeight,
          );
          if (upperPocket) {
            grooveCutters.push(upperPocket);
          }
        }
      }
    }
    if (grooveCutters.length > 0) {
      part = subtract(part, ...grooveCutters);
    }

    let connectorCount = 0;
    const connectorPositions = connectorMap.get(groupSolid.group.id) ?? [];
    if (connectorPositions.length > 0) {
      const socketDepth = Math.min(
        connectorConfig.depth,
        groupSolid.columnHeight,
      );
      const sockets = connectorPositions.map((position) =>
        translate(
          [position.x, position.y, -SPLIT_EPSILON],
          buildConnectorCylinder(
            connectorRadius,
            socketDepth + SPLIT_EPSILON,
            0,
          ),
        ),
      );
      part = subtract(part, ...sockets);
      connectorCount += connectorPositions.length;
    }

    if (measureVolume(part) > 0.001) {
      const safeGroupId = groupSolid.group.id.replace(/[^a-zA-Z0-9_-]+/g, "_");
      const filenameLabel = `part_${String(index + 1).padStart(2, "0")}_${safeGroupId}`;
      parts.push({
        index,
        filenameLabel,
        label: groupSolid.group.name,
        fromHeight: 0,
        toHeight: groupSolid.columnHeight,
        geometry: part,
        connectorCount,
      });
    }
  }

  return parts;
}

/**
 * 计算阶梯底座托盘的边界尺寸
 */
export function calculateSteppedTrayDimensions(params: SteppedLayoutParams) {
  const effective = calculateEffectiveBaseplate(params);
  const maxHeight =
    params.groups.length > 0
      ? Math.max(...params.groups.map((g) => Math.max(g.bottomHeight, 3)))
      : 0;
  return {
    width: effective.hasSlots ? effective.width : params.trayWidth,
    depth: effective.hasSlots ? effective.depth : params.trayDepth,
    height: maxHeight,
  };
}
