import { booleans, primitives, transforms } from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import type {
  SteppedCadBaseHoleFeature,
  SteppedCadFeatureGraph,
  SteppedCadGroupFeature,
  SteppedCadMagnetPostHoleFeature,
  SteppedCadSlotHoleFeature,
} from "@/lib/stepped-cad-feature-graph";
import type { SlotGroup } from "@/types/custom-tray";

const { intersect, union } = booleans;
const { circle, rectangle } = primitives;
const { translate } = transforms;

const PARTITION_MARGIN = 100;
const INTERFACE_FOOTPRINT_SEGMENTS = 24;

export interface SteppedCadSplitPartitionRequest {
  graph: Pick<
    SteppedCadFeatureGraph,
    | "trayWidth"
    | "trayDepth"
    | "groups"
    | "slotHoles"
    | "baseHoles"
    | "magnetPostHoles"
  >;
  layoutGroups: readonly Pick<SlotGroup, "id" | "splitPartGroupId">[];
}

export interface SteppedCadPartitionedGroup {
  group: SteppedCadGroupFeature;
  footprint: Geom2;
}

export interface SteppedCadSupportFootprintAtHeight {
  topHeight: number;
  groupIds: readonly string[];
  footprint: Geom2;
}

export interface SteppedCadSplitPartitionUnit {
  unitKey: string;
  groups: readonly SteppedCadGroupFeature[];
  groupIds: readonly string[];
  slotHoles: readonly SteppedCadSlotHoleFeature[];
  baseHoles: readonly SteppedCadBaseHoleFeature[];
  magnetPostHoles: readonly SteppedCadMagnetPostHoleFeature[];
  minHeight: number;
  maxHeight: number;
  externalBaseHeight: number;
  partitionFootprint: Geom2 | null;
  partitionedGroups: readonly SteppedCadPartitionedGroup[];
  supportFootprint: Geom2 | null;
  supportFootprintsByHeight: readonly SteppedCadSupportFootprintAtHeight[];
  locatorSupportFootprint: Geom2 | null;
}

export interface SteppedCadSplitPartitionPlan {
  units: readonly SteppedCadSplitPartitionUnit[];
}

interface MutableSplitUnit {
  unitKey: string;
  groups: SteppedCadGroupFeature[];
  slotHoles: SteppedCadSlotHoleFeature[];
  baseHoles: SteppedCadBaseHoleFeature[];
  magnetPostHoles: SteppedCadMagnetPostHoleFeature[];
  minHeight: number;
  maxHeight: number;
}

function isEmptyGeom2(geometry: Geom2 | null | undefined) {
  const sides = (geometry as Geom2 & { sides?: unknown[] } | null | undefined)
    ?.sides;
  return !geometry || !Array.isArray(sides) || sides.length === 0;
}

function unionGeom2Parts(parts: readonly Geom2[]) {
  return parts.length === 1 ? parts[0] : (union(...parts) as Geom2);
}

function getSlotCenter(slotHoles: readonly SteppedCadSlotHoleFeature[]) {
  const totals = slotHoles.reduce(
    (acc, slot) => ({ x: acc.x + slot.cx, y: acc.y + slot.cy }),
    { x: 0, y: 0 },
  );
  const count = Math.max(slotHoles.length, 1);
  return { x: totals.x / count, y: totals.y / count };
}

function buildSplitUnitKeyByGroupId(
  groups: readonly SteppedCadGroupFeature[],
  layoutGroups: readonly Pick<SlotGroup, "id" | "splitPartGroupId">[],
) {
  const groupIds = new Set(groups.map((group) => group.groupId));
  const parentByGroupId = new Map<string, string>();

  for (const groupId of groupIds) {
    parentByGroupId.set(groupId, groupId);
  }

  const find = (groupId: string): string => {
    const parent = parentByGroupId.get(groupId) ?? groupId;
    if (parent === groupId) return parent;
    const root = find(parent);
    parentByGroupId.set(groupId, root);
    return root;
  };

  const unionKeys = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parentByGroupId.set(leftRoot, rightRoot);
    }
  };

  for (const group of layoutGroups) {
    const targetGroupId = group.splitPartGroupId;
    if (targetGroupId && groupIds.has(group.id) && groupIds.has(targetGroupId)) {
      unionKeys(group.id, targetGroupId);
    }
  }

  return new Map([...groupIds].map((groupId) => [groupId, find(groupId)]));
}

function buildSplitUnits(
  request: SteppedCadSplitPartitionRequest,
): MutableSplitUnit[] {
  const { graph } = request;
  const keyByGroupId = buildSplitUnitKeyByGroupId(
    graph.groups,
    request.layoutGroups,
  );
  const unitsByKey = new Map<string, MutableSplitUnit>();

  for (const group of graph.groups) {
    const unitKey = keyByGroupId.get(group.groupId) ?? group.groupId;
    const unit = unitsByKey.get(unitKey) ?? {
      unitKey,
      groups: [],
      slotHoles: [],
      baseHoles: [],
      magnetPostHoles: [],
      minHeight: group.columnHeight,
      maxHeight: group.columnHeight,
    };
    unit.groups.push(group);
    unit.minHeight = Math.min(unit.minHeight, group.columnHeight);
    unit.maxHeight = Math.max(unit.maxHeight, group.columnHeight);
    unitsByKey.set(unitKey, unit);
  }

  for (const unit of unitsByKey.values()) {
    const groupIds = new Set(unit.groups.map((group) => group.groupId));
    unit.slotHoles = graph.slotHoles.filter((hole) => groupIds.has(hole.groupId));
    unit.baseHoles = graph.baseHoles.filter((hole) => groupIds.has(hole.groupId));
    unit.magnetPostHoles = graph.magnetPostHoles.filter((hole) =>
      groupIds.has(hole.groupId)
    );
    unit.groups.sort((left, right) => left.columnHeight - right.columnHeight);
  }

  return [...unitsByKey.values()].sort(
    (left, right) =>
      left.minHeight - right.minHeight || left.maxHeight - right.maxHeight,
  );
}

function buildPartitionFootprints(
  units: readonly MutableSplitUnit[],
  trayWidth: number,
  trayDepth: number,
) {
  const partitions = new Map<string, Geom2>();
  const unitsByHeight = new Map<number, MutableSplitUnit[]>();

  for (const unit of units) {
    const sameHeightUnits = unitsByHeight.get(unit.minHeight) ?? [];
    sameHeightUnits.push(unit);
    unitsByHeight.set(unit.minHeight, sameHeightUnits);
  }

  for (const sameHeightUnits of unitsByHeight.values()) {
    if (sameHeightUnits.length < 2) continue;

    const entries = sameHeightUnits.map((unit) => ({
      unit,
      center: getSlotCenter(unit.slotHoles),
    }));
    const xSpread = Math.max(...entries.map((entry) => entry.center.x)) -
      Math.min(...entries.map((entry) => entry.center.x));
    const ySpread = Math.max(...entries.map((entry) => entry.center.y)) -
      Math.min(...entries.map((entry) => entry.center.y));
    const axis = xSpread >= ySpread ? "x" : "y";
    const sorted = entries.sort(
      (left, right) => left.center[axis] - right.center[axis],
    );

    for (let index = 0; index < sorted.length; index += 1) {
      const previousBoundary = index === 0
        ? (axis === "x" ? -trayWidth / 2 : -trayDepth / 2) - PARTITION_MARGIN
        : (sorted[index - 1].center[axis] + sorted[index].center[axis]) / 2;
      const nextBoundary = index === sorted.length - 1
        ? (axis === "x" ? trayWidth / 2 : trayDepth / 2) + PARTITION_MARGIN
        : (sorted[index].center[axis] + sorted[index + 1].center[axis]) / 2;
      const width = axis === "x"
        ? nextBoundary - previousBoundary
        : trayWidth + PARTITION_MARGIN * 2;
      const depth = axis === "y"
        ? nextBoundary - previousBoundary
        : trayDepth + PARTITION_MARGIN * 2;
      const centerX = axis === "x" ? (previousBoundary + nextBoundary) / 2 : 0;
      const centerY = axis === "y" ? (previousBoundary + nextBoundary) / 2 : 0;

      partitions.set(
        sorted[index].unit.unitKey,
        rectangle({ size: [width, depth], center: [centerX, centerY] }),
      );
    }
  }

  return partitions;
}

function buildPartitionedGroups(
  unit: MutableSplitUnit,
  partitionFootprint: Geom2 | null,
) {
  return unit.groups
    .map<SteppedCadPartitionedGroup | null>((group) => {
      const footprint = partitionFootprint
        ? (intersect(group.footprint, partitionFootprint) as Geom2)
        : group.footprint;
      return isEmptyGeom2(footprint) ? null : { group, footprint };
    })
    .filter((entry): entry is SteppedCadPartitionedGroup => entry !== null);
}

function buildSupportFootprintsByHeight(
  partitionedGroups: readonly SteppedCadPartitionedGroup[],
) {
  const entriesByHeight = new Map<number, SteppedCadPartitionedGroup[]>();
  for (const entry of partitionedGroups) {
    const sameHeight = entriesByHeight.get(entry.group.columnHeight) ?? [];
    sameHeight.push(entry);
    entriesByHeight.set(entry.group.columnHeight, sameHeight);
  }

  return [...entriesByHeight.entries()].map(([topHeight, entries]) => ({
    topHeight,
    groupIds: entries.map((entry) => entry.group.groupId),
    footprint: unionGeom2Parts(entries.map((entry) => entry.footprint)),
  }));
}

function buildLocatorSupportFootprint(
  unit: MutableSplitUnit,
  partitionFootprint: Geom2 | null,
  supportFootprint: Geom2 | null,
) {
  if (unit.slotHoles.length === 0) return supportFootprint;

  const slotFootprints = unit.slotHoles.map((slotHole) =>
    translate(
      [slotHole.cx, slotHole.cy],
      circle({
        radius: slotHole.connectorRadius,
        segments: INTERFACE_FOOTPRINT_SEGMENTS,
      }),
    ) as Geom2
  );
  const footprint = unionGeom2Parts(slotFootprints);
  if (!partitionFootprint) return footprint;

  const clipped = intersect(footprint, partitionFootprint) as Geom2;
  return isEmptyGeom2(clipped) ? footprint : clipped;
}

function getExternalBaseHeight(
  unit: MutableSplitUnit,
  units: readonly MutableSplitUnit[],
) {
  const lowerHeights = units
    .filter((candidate) =>
      candidate.unitKey !== unit.unitKey && candidate.maxHeight < unit.minHeight
    )
    .map((candidate) => candidate.maxHeight);
  return lowerHeights.length > 0 ? Math.max(...lowerHeights) : 0;
}

export function buildSteppedCadSplitPartitionPlan(
  request: SteppedCadSplitPartitionRequest,
): SteppedCadSplitPartitionPlan {
  const mutableUnits = buildSplitUnits(request);
  const partitions = buildPartitionFootprints(
    mutableUnits,
    request.graph.trayWidth,
    request.graph.trayDepth,
  );

  return {
    units: mutableUnits.map((unit) => {
      const partitionFootprint = partitions.get(unit.unitKey) ?? null;
      const partitionedGroups = buildPartitionedGroups(unit, partitionFootprint);
      const supportFootprint = partitionedGroups.length > 0
        ? unionGeom2Parts(partitionedGroups.map((entry) => entry.footprint))
        : null;

      return {
        unitKey: unit.unitKey,
        groups: unit.groups,
        groupIds: unit.groups.map((group) => group.groupId),
        slotHoles: unit.slotHoles,
        baseHoles: unit.baseHoles,
        magnetPostHoles: unit.magnetPostHoles,
        minHeight: unit.minHeight,
        maxHeight: unit.maxHeight,
        externalBaseHeight: getExternalBaseHeight(unit, mutableUnits),
        partitionFootprint,
        partitionedGroups,
        supportFootprint,
        supportFootprintsByHeight: buildSupportFootprintsByHeight(
          partitionedGroups,
        ),
        locatorSupportFootprint: buildLocatorSupportFootprint(
          unit,
          partitionFootprint,
          supportFootprint,
        ),
      };
    }),
  };
}
