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
import {
  buildSteppedCadSplitProfilePlan,
  type SteppedCadLayerProfilePlan,
} from "@/lib/stepped-cad-split-profiles";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { resolveSteppedBaseHoleStructure } from "@/lib/stepped-base-hole";
import { MAGNET_POST_HOLE_BOTTOM_WALL } from "@/lib/stepped-config";
import generalizeModule from "@jscad/modeling/src/operations/modifiers/generalize";

const { intersect, subtract, union } = booleans;
const { extrudeLinear } = extrusions;
const { geom3 } = geometries;
const { measureBoundingBox, measureVolume } = measurements;
const { circle, ellipse, rectangle } = primitives;
const { rotateZ, translate } = transforms;

const DEG_TO_RAD = Math.PI / 180;
const FEATURE_EPSILON = 0.02;
const LAYER_OVERLAP = 0.1;
const PARTITION_MARGIN = 100;
const DEFAULT_INTERFACE_GROOVE_DEPTH = 2;
const INTERFACE_FOOTPRINT_SEGMENTS = 24;
const LOCATOR_PIN_RADIUS = 3;
const LOCATOR_CLEARANCE = 0.35;
const LOCATOR_MAX_HEIGHT = 1.8;
const LOCATOR_TAPER_STEPS = 6;
const LOCATOR_MAX_COUNT = 6;
const LOCATOR_MIN_SPACING = 14;
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

  const baseSolid = buildBaseSolid(graph);

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
  const magnetPostHoles = graph.magnetPostHoles.map(buildMagnetPostHoleSolid);
  const baseHoleStructure = resolveSteppedBaseHoleStructure(params);

  let tray = baseSolid;
  if (baseHoleStructure === "magnetic-base-hole") {
    tray = subtractBaseHoles(tray, graph.baseHoles, 0, params.baseHoleSize);
  }
  if (slotHoles.length > 0) {
    tray = subtract(tray, ...slotHoles);
  }
  if (baseHoleStructure === "magnet-post-hole" && magnetPostHoles.length > 0) {
    tray = subtract(tray, ...magnetPostHoles);
  }

  return orientPositiveVolume(
    cleanupIfBeneficial(tray, baseHoleStructure === "magnet-post-hole"),
  );
}

type SteppedCadFeatureGraph = ReturnType<typeof buildSteppedCadFeatureGraph>;
type SteppedCadGroupFeature = SteppedCadFeatureGraph["groups"][number];
type SteppedCadLayerFeature = SteppedCadFeatureGraph["layers"][number];
type SteppedCadSlotHoleFeature = SteppedCadFeatureGraph["slotHoles"][number];
type SteppedCadBaseHoleFeature = SteppedCadFeatureGraph["baseHoles"][number];
type SteppedCadMagnetPostHoleFeature = SteppedCadFeatureGraph["magnetPostHoles"][number];

function buildMagnetPostHoleSolid(hole: SteppedCadMagnetPostHoleFeature) {
  const booleanOverlap = LAYER_OVERLAP;
  return translate(
    [hole.cx, hole.cy, hole.topHeight - hole.depth / 2 + booleanOverlap / 2],
    primitives.cylinder({
      radius: hole.diameter / 2,
      height: hole.depth + booleanOverlap,
      segments: INTERFACE_FOOTPRINT_SEGMENTS,
    }),
  );
}

function buildMagnetPostFloorSolid(
  slotHole: SteppedCadSlotHoleFeature,
  postHoleDepth: number,
) {
  const floorThickness = postHoleDepth + MAGNET_POST_HOLE_BOTTOM_WALL;
  return translate(
    [slotHole.cx, slotHole.cy, slotHole.topHeight - slotHole.depth - floorThickness],
    rotateZ(
      slotHole.rotation * DEG_TO_RAD,
      extrudeLinear({ height: floorThickness }, slotHole.profile),
    ),
  );
}

type SteppedCadSplitUnit = {
  key: string;
  groups: SteppedCadGroupFeature[];
  slotHoles: SteppedCadSlotHoleFeature[];
  baseHoles: SteppedCadBaseHoleFeature[];
  magnetPostHoles: SteppedCadMagnetPostHoleFeature[];
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

type LocatorPoint = {
  cx: number;
  cy: number;
  radius: number;
};

type InterfaceLocator = {
  interfaceHeight: number;
  depth: number;
  points: LocatorPoint[];
};

function buildLayerSolid(layer: SteppedCadLayerFeature): Geom3 {
  const fromHeight =
    layer.fromHeight > 0 ? layer.fromHeight - LAYER_OVERLAP : 0;
  const solid = translate(
    [0, 0, fromHeight],
    extrudeLinear(
      { height: layer.toHeight - fromHeight },
      layer.footprint,
    ),
  );

  return orientPositiveVolume(solid);
}

function buildGroupSolid(group: SteppedCadGroupFeature): Geom3 {
  const solid = extrudeLinear(
    { height: group.columnHeight },
    group.footprint,
  );

  return orientPositiveVolume(solid);
}

function buildBaseSolid(graph: SteppedCadFeatureGraph): Geom3 {
  const layerSolids = graph.layers.map((layer) => buildLayerSolid(layer));
  const layeredBase =
    layerSolids.length === 1 ? layerSolids[0] : union(...layerSolids);
  const layerVolume = layerSolids.reduce(
    (total, solid) => total + Math.abs(measureVolume(solid)),
    0,
  );
  const assembledVolume = Math.abs(measureVolume(layeredBase));

  // Adjacent height-band unions can collapse on near-tangent outlines; this
  // fallback is geometrically equivalent for the current feature graph.
  if (layerVolume > 0 && assembledVolume < layerVolume * 0.5) {
    const groupSolids = graph.groups.map((group) => buildGroupSolid(group));
    return groupSolids.length === 1 ? groupSolids[0] : union(...groupSolids);
  }

  return layeredBase;
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
  magnetPostHoles: SteppedCadMagnetPostHoleFeature[],
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
      magnetPostHoles: [],
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
    unit.magnetPostHoles = magnetPostHoles.filter((slot) => groupIds.has(slot.groupId));
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

function cleanupSplitPartMesh(
  part: Geom3,
  simplify = true,
  triangulate = false,
) {
  return generalize(
    {
      snap: true,
      simplify,
      triangulate,
    },
    part,
  ) as Geom3;
}

function cleanupIfBeneficial(part: Geom3, preserveSmallFeatures = false) {
  const [[, , originalMinZ], [, , originalMaxZ]] = measureBoundingBox(part);

  const cleanupOptions = preserveSmallFeatures
    ? [
        { simplify: false, triangulate: false },
        { simplify: false, triangulate: true },
      ]
    : [
        { simplify: true, triangulate: false },
        { simplify: false, triangulate: false },
        { simplify: true, triangulate: true },
        { simplify: false, triangulate: true },
      ];

  for (const { simplify, triangulate } of cleanupOptions) {
    try {
      const cleaned = cleanupSplitPartMesh(part, simplify, triangulate);
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
  const sides = (geometry as Geom2 & { sides?: unknown[] } | null | undefined)
    ?.sides;
  return !geometry || !Array.isArray(sides) || sides.length === 0;
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

  try {
    return translate(
      [0, 0, fromHeight],
      extrudeLinear({ height }, footprint),
    );
  } catch {
    return null;
  }
}

function buildBodyFromLayerProfiles(
  layerProfiles: SteppedCadLayerProfilePlan[],
) {
  const bodySolids = layerProfiles
    .map((layer) =>
      buildSolidFromFootprint(
        layer.footprint,
        layer.fromHeight,
        layer.toHeight,
      ),
    )
    .filter((item): item is Geom3 => item !== null);

  if (bodySolids.length === 0) {
    return null;
  }

  return bodySolids.length === 1
    ? bodySolids[0]
    : (union(...bodySolids) as Geom3);
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

function resolveSplitAssemblyMode(
  params: SteppedLayoutParams,
) {
  return {
    enableRecess:
      params.enableSplitRecess === true ||
      params.splitAssemblyMode === "locator-recess",
    enableLocators:
      params.enableSplitLocators === true ||
      params.splitAssemblyMode === "locator-recess",
  };
}

function buildSlotHoleSolid(slotHole: SteppedCadSlotHoleFeature) {
  return translate(
    [slotHole.cx, slotHole.cy, slotHole.topHeight - slotHole.depth],
    rotateZ(
      slotHole.rotation * DEG_TO_RAD,
      extrudeLinear(
        { height: slotHole.depth + FEATURE_EPSILON },
        slotHole.profile,
      ),
    ),
  );
}

function buildLocatorFootprint(point: LocatorPoint, clearance = 0) {
  return translate(
    [point.cx, point.cy],
    circle({
      radius: point.radius + clearance,
      segments: INTERFACE_FOOTPRINT_SEGMENTS,
    }),
  ) as Geom2;
}

function selectInterfaceLocatorPoints(splitUnit: SteppedCadSplitUnit) {
  const candidates = splitUnit.slotHoles.map((slotHole) => ({
    cx: slotHole.cx,
    cy: slotHole.cy,
    radius: Math.min(
      LOCATOR_PIN_RADIUS,
      Math.max(1.5, slotHole.connectorRadius - LOCATOR_CLEARANCE),
    ),
  }));
  if (candidates.length <= 1) {
    return candidates;
  }

  const center = getSlotCenter(splitUnit.slotHoles);
  const remaining = [...candidates];
  const selected: LocatorPoint[] = [];
  const firstIndex = remaining.reduce((bestIndex, candidate, index) => {
    const best = remaining[bestIndex];
    const candidateDistance = Math.hypot(candidate.cx - center.x, candidate.cy - center.y);
    const bestDistance = Math.hypot(best.cx - center.x, best.cy - center.y);
    return candidateDistance > bestDistance ? index : bestIndex;
  }, 0);

  selected.push(remaining.splice(firstIndex, 1)[0]);
  while (selected.length < LOCATOR_MAX_COUNT && remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const nearestSelectedDistance = Math.min(
        ...selected.map((point) =>
          Math.hypot(candidate.cx - point.cx, candidate.cy - point.cy),
        ),
      );
      if (nearestSelectedDistance > bestDistance) {
        bestDistance = nearestSelectedDistance;
        bestIndex = index;
      }
    }

    if (bestDistance < LOCATOR_MIN_SPACING && selected.length >= 3) {
      break;
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected.sort((left, right) => left.cx - right.cx || left.cy - right.cy);
}

function filterLocatorPointsOnFootprint(
  points: LocatorPoint[],
  footprint: Geom2 | null,
) {
  if (!footprint) {
    return points;
  }

  return points.filter((point) => {
    try {
      const contact = intersect(buildLocatorFootprint(point), footprint) as Geom2;
      return !isEmptyGeom2(contact);
    } catch {
      return true;
    }
  });
}

function mergeLocatorPoints(left: LocatorPoint[], right: LocatorPoint[]) {
  const merged = new Map<string, LocatorPoint>();
  for (const point of [...left, ...right]) {
    merged.set(`${point.cx.toFixed(2)}:${point.cy.toFixed(2)}`, point);
  }
  return [...merged.values()];
}

function getLocatorFeatureDepth(requestedDepth: number, availableDepth: number) {
  return Math.min(
    Math.max(requestedDepth, 0),
    Math.max(availableDepth, 0),
    LOCATOR_MAX_HEIGHT,
  );
}

function buildLocatorBands(radius: number, depth: number) {
  const taperDepth = Math.min(depth, radius * 0.4);
  const straightDepth = Math.max(depth - taperDepth, 0);
  const tipRadius = Math.max(1, radius - taperDepth);
  const bands: { from: number; to: number; radius: number }[] = [];

  if (straightDepth > FEATURE_EPSILON) {
    bands.push({
      from: 0,
      to: straightDepth,
      radius,
    });
  }

  const stepCount = Math.max(1, LOCATOR_TAPER_STEPS);
  for (let index = 0; index < stepCount; index += 1) {
    const from = straightDepth + (taperDepth * index) / stepCount;
    const to = straightDepth + (taperDepth * (index + 1)) / stepCount;
    if (to - from <= FEATURE_EPSILON) {
      continue;
    }

    const t = (index + 1) / stepCount;
    bands.push({
      from,
      to,
      radius: radius + (tipRadius - radius) * t,
    });
  }

  return bands;
}

function buildLocatorBandSolids(
  point: LocatorPoint,
  fromHeight: number,
  depth: number,
  clearance = 0,
) {
  return buildLocatorBands(point.radius + clearance, depth)
    .map((band) =>
      buildSolidFromFootprint(
        buildLocatorFootprint({ ...point, radius: band.radius }),
        fromHeight + Math.max(0, band.from - FEATURE_EPSILON),
        fromHeight + band.to + FEATURE_EPSILON,
      )
    )
    .map((item) => (item ? orientPositiveVolume(item) : null))
    .filter((item): item is Geom3 => item !== null);
}

function buildLocatorSolid(
  point: LocatorPoint,
  fromHeight: number,
  depth: number,
  clearance = 0,
) {
  const bands = buildLocatorBandSolids(point, fromHeight, depth, clearance);

  if (bands.length === 0) {
    return null;
  }

  return bands.length === 1 ? bands[0] : (union(...bands) as Geom3);
}

function buildInterfaceLocatorMap(
  splitUnit: SteppedCadSplitUnit,
  splitUnits: SteppedCadSplitUnit[],
  partitions: Map<string, SteppedCadPartition>,
  baseHeight: number,
  grooveDepth: number,
) {
  const locators = new Map<number, InterfaceLocator>();
  const splitUnitHeights = new Set(splitUnit.groups.map((group) => group.columnHeight));

  for (const otherSplitUnit of splitUnits) {
    if (otherSplitUnit.key === splitUnit.key) {
      continue;
    }

    const otherBaseHeight = getSplitUnitExternalBaseHeight(otherSplitUnit, splitUnits);
    if (!splitUnitHeights.has(otherBaseHeight)) {
      continue;
    }

    const depth = getLocatorFeatureDepth(grooveDepth, otherBaseHeight - baseHeight);
    if (depth <= 0) {
      continue;
    }

    const contactGroupIds = new Set(
      splitUnit.groups
        .filter((group) => group.columnHeight === otherBaseHeight)
        .map((group) => group.groupId),
    );
    const contactFootprint = buildSupportFootprint(
      splitUnit,
      partitions,
      contactGroupIds,
    );
    const points = filterLocatorPointsOnFootprint(
      selectInterfaceLocatorPoints(otherSplitUnit),
      contactFootprint,
    );
    if (points.length === 0) {
      continue;
    }

    const existing = locators.get(otherBaseHeight);

    locators.set(
      otherBaseHeight,
      existing
        ? {
            interfaceHeight: otherBaseHeight,
            depth: Math.max(existing.depth, depth),
            points: mergeLocatorPoints(existing.points, points),
          }
        : {
            interfaceHeight: otherBaseHeight,
            depth,
            points,
          },
    );
  }

  return [...locators.values()].sort(
    (left, right) => left.interfaceHeight - right.interfaceHeight,
  );
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
    graph.magnetPostHoles,
    splitUnitKeyByGroupId,
  );
  const partitions = buildSameHeightPartitionMap(
    splitUnits,
    graph.trayWidth,
    graph.trayDepth,
  );
  const assemblyMode = resolveSplitAssemblyMode(params);
  const splitProfilePlan = buildSteppedCadSplitProfilePlan({
    graph,
    params: {
      groups: params.groups,
      splitGrooveDepth: grooveDepth,
      splitGrooveType: params.splitGrooveType,
      enableSplitRecess: params.enableSplitRecess,
      enableSplitLocators: params.enableSplitLocators,
      splitAssemblyMode: params.splitAssemblyMode,
    },
  });
  const profileUnitByKey = new Map(
    splitProfilePlan.units.map((unit) => [unit.unitKey, unit]),
  );

  return splitUnits.flatMap((splitUnit, index) => {
    const splitUnitBaseHeight = getSplitUnitExternalBaseHeight(splitUnit, splitUnits);
    const profileUnit = profileUnitByKey.get(splitUnit.key);
    if (!profileUnit) {
      return [];
    }

    let body = buildBodyFromLayerProfiles(profileUnit.layerProfiles);
    if (!body) {
      return [];
    }

    if (assemblyMode.enableLocators && grooveDepth > 0) {
      const locators = buildInterfaceLocatorMap(
        splitUnit,
        splitUnits,
        partitions,
        splitUnitBaseHeight,
        grooveDepth,
      );
      const activeLowerInterfacesByHeight = new Map(
        profileUnit.interfaceProfiles
          .filter(
            (profile) =>
              profile.lowerUnitKey === splitUnit.key &&
              profile.state === "active" &&
              profile.femaleDepth > 0,
          )
          .map((profile) => [profile.interfaceHeight, profile] as const),
      );
      const pinSolids = locators
        .flatMap((locator) => {
          if (
            assemblyMode.enableRecess &&
            !activeLowerInterfacesByHeight.has(locator.interfaceHeight)
          ) {
            return [];
          }

          const femaleDepth =
            activeLowerInterfacesByHeight.get(locator.interfaceHeight)?.femaleDepth ?? 0;
          const pinBaseHeight =
            locator.interfaceHeight - femaleDepth - FEATURE_EPSILON;
          return locator.points.map((point) =>
            buildLocatorSolid(point, pinBaseHeight, locator.depth),
          );
        })
        .filter((item): item is Geom3 => item !== null);
      if (pinSolids.length > 0) {
        body = union(body, ...pinSolids) as Geom3;
      }

      if (splitUnitBaseHeight > 0) {
        const activeUpperInterfaces = profileUnit.interfaceProfiles.filter(
          (profile) =>
            profile.upperUnitKey === splitUnit.key &&
            profile.state === "active" &&
            profile.maleDepth > 0,
        );
        if (!assemblyMode.enableRecess || activeUpperInterfaces.length > 0) {
          const upperTabDepth = assemblyMode.enableRecess
            ? Math.max(...activeUpperInterfaces.map((profile) => profile.maleDepth))
            : 0;
          const socketDepth = getLocatorFeatureDepth(
            grooveDepth,
            splitUnit.maxHeight - splitUnitBaseHeight,
          );
          const socketBaseHeight =
            splitUnitBaseHeight - upperTabDepth - FEATURE_EPSILON;
          const socketSolids = socketDepth > 0
            ? selectInterfaceLocatorPoints(splitUnit)
                .flatMap((point) =>
                  buildLocatorBandSolids(
                    point,
                    socketBaseHeight,
                    socketDepth,
                    LOCATOR_CLEARANCE,
                  )
                )
                .filter((item): item is Geom3 => item !== null)
            : [];
          if (socketSolids.length > 0) {
            body = subtract(body, ...socketSolids) as Geom3;
          }
        }
      }
    }

    const baseHoleStructure = resolveSteppedBaseHoleStructure(params);
    if (
      baseHoleStructure === "magnet-post-hole" &&
      splitUnit.magnetPostHoles.length > 0
    ) {
      const postDepthBySlotId = new Map(
        splitUnit.magnetPostHoles.map((hole) => [hole.id, hole.depth]),
      );
      const floorSolids = splitUnit.slotHoles.flatMap((slotHole) => {
        const postDepth = postDepthBySlotId.get(slotHole.id);
        return postDepth === undefined
          ? []
          : [buildMagnetPostFloorSolid(slotHole, postDepth)];
      });
      if (floorSolids.length > 0) {
        body = union(body, ...floorSolids) as Geom3;
      }
    }

    const slotHoles = splitUnit.slotHoles.map(buildSlotHoleSolid);
    let part = slotHoles.length > 0 ? subtract(body, ...slotHoles) : body;

    if (baseHoleStructure === "magnetic-base-hole") {
      part = subtractBaseHoles(part, splitUnit.baseHoles, 0, params.baseHoleSize);
    }
    if (
      baseHoleStructure === "magnet-post-hole" &&
      splitUnit.magnetPostHoles.length > 0
    ) {
      const postSolids = splitUnit.magnetPostHoles.map(buildMagnetPostHoleSolid);
      part = subtract(
        part,
        ...postSolids,
      );
    }

    part = orientPositiveVolume(
      cleanupIfBeneficial(part, baseHoleStructure === "magnet-post-hole"),
    );
    if (Math.abs(measureVolume(part)) <= MIN_VALID_VOLUME) {
      return [];
    }

    const filenameLabel = `part_${String(index + 1).padStart(2, "0")}_${buildSplitPartIdLabel(splitUnit.groups)}`;
    return [{
      index,
      filenameLabel,
      label: buildSplitPartLabel(splitUnit.groups, params),
      fromHeight: profileUnit.baseHeight,
      toHeight: profileUnit.topHeight,
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
