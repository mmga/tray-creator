import {
  booleans,
  extrusions,
  geometries,
  measurements,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import type { SteppedSplitPartResult } from "@/lib/model-ports";
import { subtractBaseHoles } from "@/lib/model-utils";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import { insetGeom2 } from "@/lib/outline-geometry";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import generalizeModule from "@jscad/modeling/src/operations/modifiers/generalize";

const { intersect, subtract, union } = booleans;
const { extrudeLinear } = extrusions;
const { geom2, geom3 } = geometries;
const { measureBoundingBox, measureVolume } = measurements;
const { ellipse, rectangle } = primitives;
const { rotateZ, translate } = transforms;

const DEG_TO_RAD = Math.PI / 180;
const FEATURE_EPSILON = 0.02;
const PARTITION_MARGIN = 100;
const DEFAULT_INTERFACE_GROOVE_DEPTH = 2;
const DEFAULT_INTERFACE_GROOVE_INSET = 1;
const MIN_VALID_VOLUME = 0.001;
const generalize = generalizeModule as unknown as (
  options: { snap?: boolean; simplify?: boolean; triangulate?: boolean },
  geometry: Geom3,
) => Geom3;

function createEmptyGeom() {
  return extrudeLinear(
    { height: 0.1 },
    ellipse({ radius: [1, 1], segments: 4 }),
  );
}

export function createSteppedCadTrayModel(
  params: SteppedLayoutParams,
): Geom3 {
  const graph = buildSteppedCadFeatureGraph(params);
  if (graph.groups.length === 0) {
    return createEmptyGeom();
  }

  const solids = graph.groups.map((group) => buildGroupSolid(group));
  const baseSolid = solids.length === 1 ? solids[0] : union(...solids);

  const slotHoles = graph.slotHoles.map((slotHole) =>
    translate(
      [slotHole.cx, slotHole.cy, slotHole.topHeight - slotHole.depth],
      rotateZ(
        slotHole.rotation * DEG_TO_RAD,
        extrudeLinear(
          { height: slotHole.depth + FEATURE_EPSILON },
          slotHole.profile,
        ),
      ),
    )
  );

  let tray = slotHoles.length > 0
    ? subtract(baseSolid, ...slotHoles)
    : baseSolid;

  if (params.enableBaseHole) {
    tray = subtractBaseHoles(tray, graph.baseHoles, 0, params.baseHoleSize);
  }

  return orientPositiveVolume(cleanupIfBeneficial(tray));
}

type SteppedCadGroupFeature = ReturnType<typeof buildSteppedCadFeatureGraph>["groups"][number];
type SteppedCadSlotHoleFeature = ReturnType<typeof buildSteppedCadFeatureGraph>["slotHoles"][number];
type SteppedCadBaseHoleFeature = ReturnType<typeof buildSteppedCadFeatureGraph>["baseHoles"][number];

type SteppedCadSplitUnit = {
  key: string;
  groups: SteppedCadGroupFeature[];
  slotHoles: SteppedCadSlotHoleFeature[];
  baseHoles: SteppedCadBaseHoleFeature[];
  minHeight: number;
  maxHeight: number;
};

type SteppedCadPartition = {
  footprint: Geom2;
};

type PartitionedGroupFootprint = {
  group: SteppedCadGroupFeature;
  footprint: Geom2;
};

type InterfacePocket = {
  interfaceHeight: number;
  depth: number;
  footprint: Geom2;
};

function buildGroupSolid(group: SteppedCadGroupFeature): Geom3 {
  return extrudeLinear({ height: group.columnHeight }, group.footprint);
}

function getSlotCenter(slotHoles: SteppedCadSlotHoleFeature[]) {
  const totals = slotHoles.reduce(
    (acc, slot) => ({
      x: acc.x + slot.cx,
      y: acc.y + slot.cy,
    }),
    { x: 0, y: 0 },
  );
  const count = Math.max(slotHoles.length, 1);
  return {
    x: totals.x / count,
    y: totals.y / count,
  };
}

function buildSplitUnitKeyByGroupId(
  groups: SteppedCadGroupFeature[],
  params: SteppedLayoutParams,
) {
  const groupIds = new Set(groups.map((group) => group.groupId));
  const parentByGroupId = new Map<string, string>();

  for (const groupId of groupIds) {
    parentByGroupId.set(groupId, groupId);
  }

  const find = (groupId: string): string => {
    const parent = parentByGroupId.get(groupId) ?? groupId;
    if (parent === groupId) {
      return parent;
    }
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

  for (const group of params.groups) {
    const targetGroupId = group.splitPartGroupId;
    if (targetGroupId && groupIds.has(group.id) && groupIds.has(targetGroupId)) {
      unionKeys(group.id, targetGroupId);
    }
  }

  const keyByGroupId = new Map<string, string>();
  for (const groupId of groupIds) {
    keyByGroupId.set(groupId, find(groupId));
  }
  return keyByGroupId;
}

function buildSplitUnits(
  groups: SteppedCadGroupFeature[],
  slotHoles: SteppedCadSlotHoleFeature[],
  baseHoles: SteppedCadBaseHoleFeature[],
  splitUnitKeyByGroupId: Map<string, string>,
) {
  const unitsByKey = new Map<string, SteppedCadSplitUnit>();

  for (const group of groups) {
    const key = splitUnitKeyByGroupId.get(group.groupId) ?? group.groupId;
    const unit = unitsByKey.get(key) ?? {
      key,
      groups: [],
      slotHoles: [],
      baseHoles: [],
      minHeight: group.columnHeight,
      maxHeight: group.columnHeight,
    };
    unit.groups.push(group);
    unit.minHeight = Math.min(unit.minHeight, group.columnHeight);
    unit.maxHeight = Math.max(unit.maxHeight, group.columnHeight);
    unitsByKey.set(key, unit);
  }

  for (const unit of unitsByKey.values()) {
    const groupIds = new Set(unit.groups.map((group) => group.groupId));
    unit.slotHoles = slotHoles.filter((slot) => groupIds.has(slot.groupId));
    unit.baseHoles = baseHoles.filter((slot) => groupIds.has(slot.groupId));
    unit.groups.sort((left, right) => left.columnHeight - right.columnHeight);
  }

  return [...unitsByKey.values()].sort(
    (left, right) =>
      left.minHeight - right.minHeight || left.maxHeight - right.maxHeight,
  );
}

function buildSameHeightPartitionMap(
  units: SteppedCadSplitUnit[],
  trayWidth: number,
  trayDepth: number,
) {
  const partitions = new Map<string, SteppedCadPartition>();
  const unitsByHeight = new Map<number, SteppedCadSplitUnit[]>();

  for (const unit of units) {
    const bucket = unitsByHeight.get(unit.minHeight) ?? [];
    bucket.push(unit);
    unitsByHeight.set(unit.minHeight, bucket);
  }

  for (const sameHeightUnits of unitsByHeight.values()) {
    if (sameHeightUnits.length < 2) {
      continue;
    }

    const entries = sameHeightUnits.map((unit) => ({
      unit,
      center: getSlotCenter(unit.slotHoles),
    }));
    const xSpread =
      Math.max(...entries.map((entry) => entry.center.x)) -
      Math.min(...entries.map((entry) => entry.center.x));
    const ySpread =
      Math.max(...entries.map((entry) => entry.center.y)) -
      Math.min(...entries.map((entry) => entry.center.y));
    const axis = xSpread >= ySpread ? "x" : "y";
    const sorted = entries.sort((left, right) => left.center[axis] - right.center[axis]);

    for (let index = 0; index < sorted.length; index += 1) {
      const previousBoundary =
        index === 0
          ? (axis === "x" ? -trayWidth / 2 : -trayDepth / 2) - PARTITION_MARGIN
          : (sorted[index - 1].center[axis] + sorted[index].center[axis]) / 2;
      const nextBoundary =
        index === sorted.length - 1
          ? (axis === "x" ? trayWidth / 2 : trayDepth / 2) + PARTITION_MARGIN
          : (sorted[index].center[axis] + sorted[index + 1].center[axis]) / 2;
      const width =
        axis === "x"
          ? nextBoundary - previousBoundary
          : trayWidth + PARTITION_MARGIN * 2;
      const depth =
        axis === "y"
          ? nextBoundary - previousBoundary
          : trayDepth + PARTITION_MARGIN * 2;
      const centerX = axis === "x" ? (previousBoundary + nextBoundary) / 2 : 0;
      const centerY = axis === "y" ? (previousBoundary + nextBoundary) / 2 : 0;

      partitions.set(
        sorted[index].unit.key,
        {
          footprint: rectangle({
            size: [width, depth],
            center: [centerX, centerY],
          }),
        },
      );
    }
  }

  return partitions;
}

function getSplitUnitExternalBaseHeight(
  splitUnit: SteppedCadSplitUnit,
  units: SteppedCadSplitUnit[],
) {
  const lowerHeights = units
    .filter((unit) => unit.key !== splitUnit.key && unit.maxHeight < splitUnit.minHeight)
    .map((unit) => unit.maxHeight);

  return lowerHeights.length > 0 ? Math.max(...lowerHeights) : 0;
}

function buildSplitPartLabel(groups: SteppedCadGroupFeature[], params: SteppedLayoutParams) {
  const nameById = new Map(params.groups.map((group) => [group.id, group.name]));
  return groups.map((group) => nameById.get(group.groupId) ?? group.groupId).join(" + ");
}

function buildSplitPartIdLabel(groups: SteppedCadGroupFeature[]) {
  return groups
    .map((group) => group.groupId.replace(/[^a-zA-Z0-9_-]+/g, "_"))
    .join("_");
}

function cleanupSplitPartMesh(part: Geom3, simplify = true) {
  return generalize(
    {
      snap: true,
      simplify,
    },
    part,
  ) as Geom3;
}

function cleanupIfBeneficial(part: Geom3) {
  const [[, , originalMinZ], [, , originalMaxZ]] = measureBoundingBox(part);

  for (const simplify of [true, false]) {
    try {
      const cleaned = cleanupSplitPartMesh(part, simplify);
      const [[, , cleanedMinZ], [, , cleanedMaxZ]] = measureBoundingBox(cleaned);
      const keepsZExtents =
        cleanedMinZ <= originalMinZ + FEATURE_EPSILON &&
        cleanedMaxZ >= originalMaxZ - FEATURE_EPSILON;

      if (keepsZExtents && Math.abs(measureVolume(cleaned)) > MIN_VALID_VOLUME) {
        return cleaned;
      }
    } catch {
      continue;
    }
  }
  return part;
}

function orientPositiveVolume(geometry: Geom3) {
  return measureVolume(geometry) < 0 ? geom3.invert(geometry) : geometry;
}

function isEmptyGeom2(geometry: Geom2 | null | undefined) {
  return !geometry || geom2.toOutlines(geometry).length === 0;
}

function unionGeom2Parts(parts: Geom2[]) {
  return parts.length === 1 ? parts[0] : (union(...parts) as Geom2);
}

function buildSolidFromFootprint(
  footprint: Geom2,
  fromHeight: number,
  toHeight: number,
) {
  const height = toHeight - fromHeight;
  if (height <= 0 || isEmptyGeom2(footprint)) {
    return null;
  }

  return translate(
    [0, 0, fromHeight],
    extrudeLinear({ height }, footprint),
  );
}

function getPartitionedGroupFootprints(
  splitUnit: SteppedCadSplitUnit,
  partitions: Map<string, SteppedCadPartition>,
) {
  const partition = partitions.get(splitUnit.key);
  return splitUnit.groups
    .map<PartitionedGroupFootprint | null>((group) => {
      const clipped = partition
        ? (intersect(group.footprint, partition.footprint) as Geom2)
        : group.footprint;
      return isEmptyGeom2(clipped)
        ? null
        : {
            group,
            footprint: clipped,
          };
    })
    .filter((item): item is PartitionedGroupFootprint => item !== null);
}

function buildSupportFootprint(
  splitUnit: SteppedCadSplitUnit,
  partitions: Map<string, SteppedCadPartition>,
  allowedGroupIds?: Set<string>,
) {
  const footprints = getPartitionedGroupFootprints(splitUnit, partitions)
    .filter((entry) =>
      allowedGroupIds ? allowedGroupIds.has(entry.group.groupId) : true,
    )
    .map((entry) => entry.footprint);

  if (footprints.length === 0) {
    return null;
  }

  return unionGeom2Parts(footprints);
}

function buildSlotHoleFootprint(slotHole: SteppedCadSlotHoleFeature) {
  return translate(
    [slotHole.cx, slotHole.cy],
    rotateZ(slotHole.rotation * DEG_TO_RAD, slotHole.profile),
  ) as Geom2;
}

function buildInterfacePocketMap(
  splitUnit: SteppedCadSplitUnit,
  splitUnits: SteppedCadSplitUnit[],
  partitions: Map<string, SteppedCadPartition>,
  baseHeight: number,
  grooveDepth: number,
) {
  const pockets = new Map<number, InterfacePocket>();
  const splitUnitHeights = new Set(splitUnit.groups.map((group) => group.columnHeight));

  for (const otherSplitUnit of splitUnits) {
    if (otherSplitUnit.key === splitUnit.key) {
      continue;
    }

    const otherBaseHeight = getSplitUnitExternalBaseHeight(otherSplitUnit, splitUnits);
    if (!splitUnitHeights.has(otherBaseHeight)) {
      continue;
    }

    const depth = Math.min(grooveDepth, otherBaseHeight - baseHeight);
    if (depth <= 0) {
      continue;
    }

    const supportGroupIds = new Set(
      otherSplitUnit.groups
        .filter((group) => group.columnHeight === otherSplitUnit.minHeight)
        .map((group) => group.groupId),
    );
    const supportFootprint = buildSupportFootprint(
      otherSplitUnit,
      partitions,
      supportGroupIds,
    );
    if (!supportFootprint) {
      continue;
    }

    const pocketFootprint =
      insetGeom2(
        supportFootprint,
        DEFAULT_INTERFACE_GROOVE_INSET,
      ) ?? supportFootprint;
    const existing = pockets.get(otherBaseHeight);

    pockets.set(
      otherBaseHeight,
      existing
        ? {
            interfaceHeight: otherBaseHeight,
            depth: Math.max(existing.depth, depth),
            footprint: unionGeom2Parts([existing.footprint, pocketFootprint]),
          }
        : {
            interfaceHeight: otherBaseHeight,
            depth,
            footprint: pocketFootprint,
          },
    );
  }

  return [...pockets.values()].sort(
    (left, right) => left.interfaceHeight - right.interfaceHeight,
  );
}

function buildSplitUnitBody(
  splitUnit: SteppedCadSplitUnit,
  splitUnits: SteppedCadSplitUnit[],
  partitions: Map<string, SteppedCadPartition>,
  grooveDepth: number,
) {
  const baseHeight = getSplitUnitExternalBaseHeight(splitUnit, splitUnits);
  const interfaceDepth = Math.max(grooveDepth, 0);
  const groupFootprints = getPartitionedGroupFootprints(splitUnit, partitions);
  if (groupFootprints.length === 0) {
    return null;
  }

  const pockets =
    interfaceDepth > 0
      ? buildInterfacePocketMap(
          splitUnit,
          splitUnits,
          partitions,
          baseHeight,
          interfaceDepth,
        )
      : [];

  const heightBreaks = new Set<number>([
    baseHeight,
    ...groupFootprints.map((entry) => entry.group.columnHeight),
  ]);
  for (const pocket of pockets) {
    heightBreaks.add(Math.max(baseHeight, pocket.interfaceHeight - pocket.depth));
    heightBreaks.add(pocket.interfaceHeight);
  }
  for (const slotHole of splitUnit.slotHoles) {
    heightBreaks.add(Math.max(baseHeight, slotHole.topHeight - slotHole.depth));
    heightBreaks.add(slotHole.topHeight);
  }

  const sortedBreaks = [...heightBreaks]
    .filter((height) => height >= baseHeight)
    .sort((left, right) => left - right);
  const bodyBands: Geom3[] = [];

  for (let index = 0; index < sortedBreaks.length - 1; index += 1) {
    const fromHeight = sortedBreaks[index];
    const toHeight = sortedBreaks[index + 1];
    if (toHeight <= fromHeight) {
      continue;
    }

    const activeFootprints = groupFootprints
      .filter((entry) => entry.group.columnHeight >= toHeight)
      .map((entry) => entry.footprint);
    if (activeFootprints.length === 0) {
      continue;
    }

    let bandFootprint = unionGeom2Parts(activeFootprints);
    const applicablePockets = pockets.filter(
      (pocket) =>
        fromHeight >= pocket.interfaceHeight - pocket.depth &&
        toHeight <= pocket.interfaceHeight,
    );
    if (applicablePockets.length > 0) {
      bandFootprint = subtract(
        bandFootprint,
        ...applicablePockets.map((pocket) => pocket.footprint),
      ) as Geom2;
      if (isEmptyGeom2(bandFootprint)) {
        continue;
      }
    }

    const applicableSlotHoles = splitUnit.slotHoles
      .filter(
        (slotHole) =>
          slotHole.topHeight > fromHeight &&
          slotHole.topHeight - slotHole.depth < toHeight,
      )
      .map(buildSlotHoleFootprint);
    if (applicableSlotHoles.length > 0) {
      bandFootprint = subtract(
        bandFootprint,
        ...applicableSlotHoles,
      ) as Geom2;
      if (isEmptyGeom2(bandFootprint)) {
        continue;
      }
    }

    const band = buildSolidFromFootprint(
      bandFootprint,
      index === 0 ? fromHeight : fromHeight - FEATURE_EPSILON,
      toHeight,
    );
    if (band) {
      bodyBands.push(band);
    }
  }

  if (interfaceDepth > 0 && baseHeight > 0) {
    const tenonDepth = Math.min(interfaceDepth, splitUnit.maxHeight - baseHeight);
    if (tenonDepth > 0) {
      const supportGroupIds = new Set(
        splitUnit.groups
          .filter((group) => group.columnHeight === splitUnit.minHeight)
          .map((group) => group.groupId),
      );
      const supportFootprint = buildSupportFootprint(
        splitUnit,
        partitions,
        supportGroupIds,
      );
      if (supportFootprint) {
        const tenonFootprint =
          insetGeom2(
            supportFootprint,
            DEFAULT_INTERFACE_GROOVE_INSET,
          ) ?? supportFootprint;
        const tenon = buildSolidFromFootprint(
          tenonFootprint,
          baseHeight - tenonDepth,
          baseHeight + FEATURE_EPSILON,
        );
        if (tenon) {
          bodyBands.push(tenon);
        }
      }
    }
  }

  if (bodyBands.length === 0) {
    return null;
  }

  return bodyBands.length === 1 ? bodyBands[0] : union(...bodyBands);
}

export function createSteppedCadSplitParts(
  params: SteppedLayoutParams,
  grooveDepth = params.splitGrooveDepth ?? DEFAULT_INTERFACE_GROOVE_DEPTH,
): SteppedSplitPartResult[] {
  const graph = buildSteppedCadFeatureGraph(params);
  if (graph.groups.length === 0) {
    return [];
  }

  const splitUnitKeyByGroupId = buildSplitUnitKeyByGroupId(graph.groups, params);
  const splitUnits = buildSplitUnits(
    graph.groups,
    graph.slotHoles,
    graph.baseHoles,
    splitUnitKeyByGroupId,
  );
  const partitions = buildSameHeightPartitionMap(
    splitUnits,
    graph.trayWidth,
    graph.trayDepth,
  );

  return splitUnits.flatMap((splitUnit, index) => {
    const splitUnitBaseHeight = getSplitUnitExternalBaseHeight(splitUnit, splitUnits);
    const body = buildSplitUnitBody(
      splitUnit,
      splitUnits,
      partitions,
      grooveDepth,
    );
    if (!body) {
      return [];
    }

    let part = body;

    if (params.enableBaseHole && splitUnitBaseHeight <= 0) {
      part = subtractBaseHoles(part, splitUnit.baseHoles, 0, params.baseHoleSize);
    }

    part = orientPositiveVolume(cleanupIfBeneficial(part));
    if (Math.abs(measureVolume(part)) <= MIN_VALID_VOLUME) {
      return [];
    }

    const filenameLabel = `part_${String(index + 1).padStart(2, "0")}_${buildSplitPartIdLabel(splitUnit.groups)}`;
    return [{
      index,
      filenameLabel,
      label: buildSplitPartLabel(splitUnit.groups, params),
      fromHeight: splitUnitBaseHeight,
      toHeight: splitUnit.maxHeight,
      geometry: part,
    }];
  });
}

export function calculateSteppedCadTrayDimensions(
  params: SteppedLayoutParams,
) {
  const graph = buildSteppedCadFeatureGraph(params);
  return {
    width: graph.trayWidth,
    depth: graph.trayDepth,
    height: graph.maxHeight,
  };
}

export function calculateSteppedCadTrayVolume(
  params: SteppedLayoutParams,
) {
  return measureVolume(createSteppedCadTrayModel(params));
}
