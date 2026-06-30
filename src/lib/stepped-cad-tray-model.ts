import {
  booleans,
  extrusions,
  geometries,
  measurements,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { SteppedSplitPartResult } from "@/lib/model-ports";
import { subtractBaseHoles } from "@/lib/model-utils";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import generalizeModule from "@jscad/modeling/src/operations/modifiers/generalize";

const { intersect, subtract, union } = booleans;
const { extrudeLinear } = extrusions;
const { geom3 } = geometries;
const { measureVolume } = measurements;
const { circle, cuboid, ellipse } = primitives;
const { rotateZ, translate } = transforms;

const DEG_TO_RAD = Math.PI / 180;
const FEATURE_EPSILON = 0.02;
const PARTITION_MARGIN = 100;
const DEFAULT_INTERFACE_GROOVE_DEPTH = 2;
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
  const partitions = new Map<string, Geom3>();
  const unitsByHeight = new Map<number, SteppedCadSplitUnit[]>();
  const maxHeight =
    units.length > 0 ? Math.max(...units.map((unit) => unit.maxHeight)) : 0;

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
        cuboid({
          size: [width, depth, maxHeight + PARTITION_MARGIN * 2],
          center: [centerX, centerY, maxHeight / 2],
        }),
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

function clipSolidBelowHeight(
  solid: Geom3,
  baseHeight: number,
  trayWidth: number,
  trayDepth: number,
  maxHeight: number,
) {
  if (baseHeight <= 0) {
    return solid;
  }

  const clipHeight = Math.max(maxHeight - baseHeight + PARTITION_MARGIN, PARTITION_MARGIN);
  return intersect(
    solid,
    cuboid({
      size: [trayWidth + PARTITION_MARGIN * 2, trayDepth + PARTITION_MARGIN * 2, clipHeight],
      center: [0, 0, baseHeight + clipHeight / 2],
    }),
  );
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
  for (const simplify of [true, false]) {
    try {
      const cleaned = cleanupSplitPartMesh(part, simplify);
      if (Math.abs(measureVolume(cleaned)) > MIN_VALID_VOLUME) {
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

function getSupportGroups(
  splitUnit: SteppedCadSplitUnit,
  allowedGroupIds?: Set<string>,
) {
  return splitUnit.groups.filter((group) => {
    if (!allowedGroupIds) {
      return true;
    }
    return allowedGroupIds.has(group.groupId);
  });
}

function getSupportSlotHoles(
  splitUnit: SteppedCadSplitUnit,
  allowedGroupIds?: Set<string>,
) {
  return splitUnit.slotHoles.filter((slotHole) => {
    if (!allowedGroupIds) {
      return true;
    }
    return allowedGroupIds.has(slotHole.groupId);
  });
}

function buildWholeFaceMateFeature(
  splitUnit: SteppedCadSplitUnit,
  depth: number,
  zBase: number,
  allowedGroupIds?: Set<string>,
) {
  if (depth <= 0) {
    return null;
  }

  const supportGroups = getSupportGroups(splitUnit, allowedGroupIds);
  const supportSlotHoles = getSupportSlotHoles(splitUnit, allowedGroupIds);
  if (supportGroups.length === 0) {
    return null;
  }

  const footprint = supportSlotHoles.length > 0
    ? supportSlotHoles.map((slotHole) =>
        translate(
          [slotHole.cx, slotHole.cy],
          circle({
            radius: slotHole.connectorRadius,
            segments: 48,
          }),
        )
      )
    : supportGroups.map((group) => group.footprint);

  const mergedFootprint =
    footprint.length === 1
      ? footprint[0]
      : union(...footprint);

  return translate(
    [0, 0, zBase],
    extrudeLinear({ height: depth }, mergedFootprint),
  );
}

export function createSteppedCadSplitParts(
  params: SteppedLayoutParams,
  grooveDepth = DEFAULT_INTERFACE_GROOVE_DEPTH,
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
  const maxHeight =
    splitUnits.length > 0 ? Math.max(...splitUnits.map((unit) => unit.maxHeight)) : 0;
  const claimedSolids: Geom3[] = [];

  return splitUnits.flatMap((splitUnit, index) => {
    const groupSolids = splitUnit.groups.map((group) => {
      const solid = buildGroupSolid(group);
      const partition = partitions.get(splitUnit.key);
      return partition ? intersect(solid, partition) : solid;
    });
    if (groupSolids.length === 0) {
      return [];
    }

    const splitUnitBaseHeight = getSplitUnitExternalBaseHeight(splitUnit, splitUnits);
    const unionedSolid = groupSolids.length === 1 ? groupSolids[0] : union(...groupSolids);
    const clippedSolid = clipSolidBelowHeight(
      unionedSolid,
      splitUnitBaseHeight,
      graph.trayWidth,
      graph.trayDepth,
      maxHeight,
    );

    const slotHoles = splitUnit.slotHoles.map((slotHole) =>
      translate(
        [slotHole.cx, slotHole.cy, slotHole.topHeight - slotHole.depth],
        rotateZ(
          slotHole.rotation * DEG_TO_RAD,
          extrudeLinear(
            { height: slotHole.depth + FEATURE_EPSILON },
            slotHole.profile,
          ),
        ),
      ),
    );

    let part = slotHoles.length > 0 ? subtract(clippedSolid, ...slotHoles) : clippedSolid;

    if (claimedSolids.length > 0) {
      const claimedCutters = claimedSolids.flatMap((solid) => [
        solid,
        translate([0, 0, FEATURE_EPSILON], solid),
      ]);
      part = subtract(part, ...claimedCutters);
    }

    if (params.enableBaseHole && splitUnitBaseHeight <= 0) {
      part = subtractBaseHoles(part, splitUnit.baseHoles, 0, params.baseHoleSize);
    }

    const grooveCutters: Geom3[] = [];
    const grooveAdditions: Geom3[] = [];
    const interfaceDepth = Math.max(grooveDepth, 0);
    if (interfaceDepth > 0 && splitUnitBaseHeight > 0) {
      const upperTenonDepth = Math.min(
        interfaceDepth,
        splitUnit.maxHeight - splitUnitBaseHeight,
      );
      const supportGroupIds = new Set(
        splitUnit.groups
          .filter((group) => group.columnHeight === splitUnit.minHeight)
          .map((group) => group.groupId),
      );
      const upperTenon = buildWholeFaceMateFeature(
        splitUnit,
        upperTenonDepth + FEATURE_EPSILON,
        splitUnitBaseHeight - upperTenonDepth,
        supportGroupIds,
      );
      if (upperTenon) {
        grooveAdditions.push(upperTenon);
      }
    }

    if (interfaceDepth > 0) {
      const splitUnitHeights = new Set(splitUnit.groups.map((group) => group.columnHeight));
      for (const otherSplitUnit of splitUnits) {
        if (otherSplitUnit.key === splitUnit.key) {
          continue;
        }
        const otherBaseHeight = getSplitUnitExternalBaseHeight(otherSplitUnit, splitUnits);
        if (!splitUnitHeights.has(otherBaseHeight)) {
          continue;
        }

        const lowPocketDepth = Math.min(interfaceDepth, otherBaseHeight - splitUnitBaseHeight);
        if (lowPocketDepth <= 0) {
          continue;
        }
        const supportGroupIds = new Set(
          otherSplitUnit.groups
            .filter((group) => group.columnHeight === otherSplitUnit.minHeight)
            .map((group) => group.groupId),
        );
        const lowPocket = buildWholeFaceMateFeature(
          otherSplitUnit,
          lowPocketDepth + FEATURE_EPSILON,
          otherBaseHeight - lowPocketDepth,
          supportGroupIds,
        );
        if (lowPocket) {
          grooveCutters.push(lowPocket);
        }
      }
    }

    if (grooveCutters.length > 0) {
      part = subtract(part, ...grooveCutters);
    }
    if (grooveAdditions.length > 0) {
      part = union(part, ...grooveAdditions);
    }

    if (Math.abs(measureVolume(part)) <= MIN_VALID_VOLUME) {
      return [];
    }
    part = orientPositiveVolume(cleanupIfBeneficial(part));

    claimedSolids.push(part);
    const filenameLabel = `part_${String(index + 1).padStart(2, "0")}_${buildSplitPartIdLabel(splitUnit.groups)}`;
    return [{
      index,
      filenameLabel,
      label: buildSplitPartLabel(splitUnit.groups, params),
      fromHeight: 0,
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
