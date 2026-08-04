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
import {
  createMagnetPostHoleSolid,
  subtractBaseHoles,
} from "@/lib/model-utils";
import type {
  SteppedCadBaseHoleFeature,
  SteppedCadFeatureGraph,
  SteppedCadGroupFeature,
  SteppedCadLayerFeature,
  SteppedCadMagnetPostHoleFeature,
  SteppedCadSlotHoleFeature,
} from "@/lib/stepped-cad-feature-graph";
import type {
  SteppedCadLayerProfilePlan,
  SteppedCadSplitProfilePlan,
} from "@/lib/stepped-cad-split-profiles";
import type {
  SteppedCadSplitPartitionPlan,
  SteppedCadSplitPartitionUnit,
} from "@/lib/stepped-cad-split-partition-plan";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { resolveSteppedBaseHoleStructure } from "@/lib/stepped-base-hole";
import { MAGNET_POST_HOLE_BOTTOM_WALL } from "@/lib/stepped-config";
import generalizeModule from "@jscad/modeling/src/operations/modifiers/generalize";

const { intersect, subtract, union } = booleans;
const { extrudeLinear } = extrusions;
const { geom3 } = geometries;
const { measureBoundingBox, measureVolume } = measurements;
const { circle, ellipse } = primitives;
const { rotateZ, translate } = transforms;

const DEG_TO_RAD = Math.PI / 180;
const FEATURE_EPSILON = 0.02;
const LAYER_OVERLAP = 0.1;
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

export function realizeSteppedCadWhole(
  graph: SteppedCadFeatureGraph,
  params: Readonly<SteppedLayoutParams>,
): Geom3 {
  if (graph.groups.length === 0) {
    return createEmptyGeom();
  }
  return realizeCadEntity(buildWholeRealizationPlan(graph, params))!;
}

function buildMagnetPostHoleSolid(hole: SteppedCadMagnetPostHoleFeature) {
  return createMagnetPostHoleSolid(
    { cx: hole.cx, cy: hole.cy, floorHeight: hole.topHeight },
    hole.diameter,
    hole.depth,
    LAYER_OVERLAP,
    INTERFACE_FOOTPRINT_SEGMENTS,
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

type CadBodyPlan =
  | {
      kind: "height-band-body";
      graph: SteppedCadFeatureGraph;
      skipCollapsedUnionCheck: boolean;
    }
  | {
      kind: "profile-band-body";
      layers: readonly SteppedCadLayerProfilePlan[];
    };

type CadSolidRecipe =
  | { kind: "slot-hole"; feature: SteppedCadSlotHoleFeature }
  | {
      kind: "magnet-post-floor";
      feature: SteppedCadSlotHoleFeature;
      postHoleDepth: number;
    }
  | {
      kind: "locator-pin";
      point: LocatorPoint;
      fromHeight: number;
      depth: number;
    }
  | {
      kind: "locator-socket";
      point: LocatorPoint;
      fromHeight: number;
      depth: number;
    };

type CadBaseCutPlan =
  | { kind: "none" }
  | {
      kind: "magnetic-base-hole";
      holes: readonly SteppedCadBaseHoleFeature[];
      fallbackSize: SteppedLayoutParams["baseHoleSize"];
    }
  | {
      kind: "magnet-post-hole";
      holes: readonly SteppedCadMagnetPostHoleFeature[];
    };

type CadFinishingPlan =
  | { kind: "rectangular-fast-path" }
  | {
      kind: "repair";
      preserveSmallFeatures: boolean;
      rejectAtOrBelowVolume: number | null;
    };

interface CadEntityRealizationPlan {
  body: CadBodyPlan;
  assemblyAdditions: readonly CadSolidRecipe[];
  assemblyCuts: readonly CadSolidRecipe[];
  manufacturingAdditions: readonly CadSolidRecipe[];
  primaryCuts: readonly CadSolidRecipe[];
  baseCuts: CadBaseCutPlan;
  finishing: CadFinishingPlan;
}

interface CadSplitPartRealizationPlan extends CadEntityRealizationPlan {
  metadata: Omit<SteppedSplitPartResult, "geometry">;
}

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

function buildBaseSolid(
  graph: SteppedCadFeatureGraph,
  skipCollapsedUnionCheck = false,
): Geom3 {
  const layerSolids = graph.layers.map((layer) => buildLayerSolid(layer));
  const layeredBase =
    layerSolids.length === 1 ? layerSolids[0] : union(...layerSolids);
  // 矩形高度带由轴对齐矩形拉伸并带有层间重叠，不会触发相切轮廓塌缩。
  // 跳过两轮完整体积扫描，避免小型历史模型的固定成本超过旧后端。
  if (skipCollapsedUnionCheck) {
    return layeredBase;
  }
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

function getSlotCenter(slotHoles: readonly SteppedCadSlotHoleFeature[]) {
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

function buildSplitPartLabel(
  groups: readonly SteppedCadGroupFeature[],
  params: SteppedLayoutParams,
) {
  const nameById = new Map(params.groups.map((group) => [group.id, group.name]));
  return groups.map((group) => nameById.get(group.groupId) ?? group.groupId).join(" + ");
}

function buildSplitPartIdLabel(groups: readonly SteppedCadGroupFeature[]) {
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

function selectInterfaceLocatorPoints(
  splitUnit: SteppedCadSplitPartitionUnit,
) {
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
  splitUnit: SteppedCadSplitPartitionUnit,
  splitUnits: readonly SteppedCadSplitPartitionUnit[],
  baseHeight: number,
  grooveDepth: number,
) {
  const locators = new Map<number, InterfaceLocator>();
  const splitUnitHeights = new Set(splitUnit.groups.map((group) => group.columnHeight));

  for (const otherSplitUnit of splitUnits) {
    if (otherSplitUnit.unitKey === splitUnit.unitKey) {
      continue;
    }

    const otherBaseHeight = otherSplitUnit.externalBaseHeight;
    if (!splitUnitHeights.has(otherBaseHeight)) {
      continue;
    }

    const depth = getLocatorFeatureDepth(grooveDepth, otherBaseHeight - baseHeight);
    if (depth <= 0) {
      continue;
    }

    const contactFootprint = splitUnit.supportFootprintsByHeight.find(
      (entry) => entry.topHeight === otherBaseHeight,
    )?.footprint ?? null;
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

function buildBaseCutPlan(
  structure: ReturnType<typeof resolveSteppedBaseHoleStructure>,
  baseHoles: readonly SteppedCadBaseHoleFeature[],
  magnetPostHoles: readonly SteppedCadMagnetPostHoleFeature[],
  fallbackSize: SteppedLayoutParams["baseHoleSize"],
): CadBaseCutPlan {
  if (structure === "magnetic-base-hole") {
    return {
      kind: "magnetic-base-hole",
      holes: baseHoles,
      fallbackSize,
    };
  }
  if (structure === "magnet-post-hole") {
    return {
      kind: "magnet-post-hole",
      holes: magnetPostHoles,
    };
  }
  return { kind: "none" };
}

function buildWholeRealizationPlan(
  graph: SteppedCadFeatureGraph,
  params: Readonly<SteppedLayoutParams>,
): CadEntityRealizationPlan {
  const baseHoleStructure = resolveSteppedBaseHoleStructure(params);
  const rectangularFastPath = params.footprintStyle === "rectangular";
  return {
    body: {
      kind: "height-band-body",
      graph,
      skipCollapsedUnionCheck: rectangularFastPath,
    },
    assemblyAdditions: [],
    assemblyCuts: [],
    manufacturingAdditions: [],
    primaryCuts: graph.slotHoles.map((feature) => ({
      kind: "slot-hole" as const,
      feature,
    })),
    baseCuts: buildBaseCutPlan(
      baseHoleStructure,
      graph.baseHoles,
      graph.magnetPostHoles,
      params.baseHoleSize,
    ),
    finishing: rectangularFastPath
      ? { kind: "rectangular-fast-path" }
      : {
          kind: "repair",
          preserveSmallFeatures: baseHoleStructure === "magnet-post-hole",
          rejectAtOrBelowVolume: null,
        },
  };
}

function realizeBody(plan: CadBodyPlan) {
  return plan.kind === "height-band-body"
    ? buildBaseSolid(plan.graph, plan.skipCollapsedUnionCheck)
    : buildBodyFromLayerProfiles([...plan.layers]);
}

function realizeSolidRecipe(recipe: CadSolidRecipe): Geom3[] {
  switch (recipe.kind) {
    case "slot-hole":
      return [buildSlotHoleSolid(recipe.feature)];
    case "magnet-post-floor":
      return [
        buildMagnetPostFloorSolid(recipe.feature, recipe.postHoleDepth),
      ];
    case "locator-pin": {
      const solid = buildLocatorSolid(
        recipe.point,
        recipe.fromHeight,
        recipe.depth,
      );
      return solid ? [solid] : [];
    }
    case "locator-socket":
      return buildLocatorBandSolids(
        recipe.point,
        recipe.fromHeight,
        recipe.depth,
        LOCATOR_CLEARANCE,
      );
  }
}

function realizeRecipes(recipes: readonly CadSolidRecipe[]) {
  return recipes.flatMap(realizeSolidRecipe);
}

function applyAdditions(body: Geom3, recipes: readonly CadSolidRecipe[]) {
  const solids = realizeRecipes(recipes);
  return solids.length > 0 ? (union(body, ...solids) as Geom3) : body;
}

function applyCuts(body: Geom3, recipes: readonly CadSolidRecipe[]) {
  const solids = realizeRecipes(recipes);
  return solids.length > 0 ? (subtract(body, ...solids) as Geom3) : body;
}

function applyBaseCuts(body: Geom3, plan: CadBaseCutPlan) {
  if (plan.kind === "magnetic-base-hole") {
    return subtractBaseHoles(
      body,
      [...plan.holes],
      0,
      plan.fallbackSize,
    );
  }
  if (plan.kind === "magnet-post-hole" && plan.holes.length > 0) {
    return subtract(
      body,
      ...plan.holes.map(buildMagnetPostHoleSolid),
    ) as Geom3;
  }
  return body;
}

function realizeCadEntity(plan: CadEntityRealizationPlan): Geom3 | null {
  let body = realizeBody(plan.body);
  if (!body) {
    return null;
  }

  body = applyAdditions(body, plan.assemblyAdditions);
  body = applyCuts(body, plan.assemblyCuts);
  body = applyAdditions(body, plan.manufacturingAdditions);

  // 主槽必须先于 Base-hole Structure；先切小底孔会放大后续布尔成本。
  body = applyCuts(body, plan.primaryCuts);
  body = applyBaseCuts(body, plan.baseCuts);

  if (plan.finishing.kind === "rectangular-fast-path") {
    return body;
  }

  const finished = orientPositiveVolume(
    cleanupIfBeneficial(body, plan.finishing.preserveSmallFeatures),
  );
  if (
    plan.finishing.rejectAtOrBelowVolume !== null &&
    Math.abs(measureVolume(finished)) <= plan.finishing.rejectAtOrBelowVolume
  ) {
    return null;
  }
  return finished;
}

function buildSplitPartRealizationPlans({
  partitionPlan,
  splitProfilePlan,
  params,
}: {
  partitionPlan: SteppedCadSplitPartitionPlan;
  splitProfilePlan: SteppedCadSplitProfilePlan;
  params: Readonly<SteppedLayoutParams>;
},
): CadSplitPartRealizationPlan[] {
  const grooveDepth = params.splitGrooveDepth;
  const splitUnits = partitionPlan.units;
  const assemblyMode = resolveSplitAssemblyMode(params);
  const baseHoleStructure = resolveSteppedBaseHoleStructure(params);
  const profileUnitByKey = new Map(
    splitProfilePlan.units.map((unit) => [unit.unitKey, unit]),
  );

  return splitUnits.flatMap((splitUnit, index) => {
    const splitUnitBaseHeight = splitUnit.externalBaseHeight;
    const profileUnit = profileUnitByKey.get(splitUnit.unitKey);
    if (!profileUnit) {
      return [];
    }

    const assemblyAdditions: CadSolidRecipe[] = [];
    const assemblyCuts: CadSolidRecipe[] = [];

    if (assemblyMode.enableLocators && grooveDepth > 0) {
      const locators = buildInterfaceLocatorMap(
        splitUnit,
        splitUnits,
        splitUnitBaseHeight,
        grooveDepth,
      );
      const activeLowerInterfacesByHeight = new Map(
        profileUnit.interfaceProfiles
          .filter(
            (profile) =>
              profile.lowerUnitKey === splitUnit.unitKey &&
              profile.state === "active" &&
              profile.femaleDepth > 0,
          )
          .map((profile) => [profile.interfaceHeight, profile] as const),
      );
      assemblyAdditions.push(
        ...locators.flatMap((locator): CadSolidRecipe[] => {
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
          return locator.points.map((point) => ({
            kind: "locator-pin",
            point,
            fromHeight: pinBaseHeight,
            depth: locator.depth,
          }));
        }),
      );

      if (splitUnitBaseHeight > 0) {
        const activeUpperInterfaces = profileUnit.interfaceProfiles.filter(
          (profile) =>
            profile.upperUnitKey === splitUnit.unitKey &&
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
          if (socketDepth > 0) {
            assemblyCuts.push(
              ...selectInterfaceLocatorPoints(splitUnit).map((point) => ({
                kind: "locator-socket" as const,
                point,
                fromHeight: socketBaseHeight,
                depth: socketDepth,
              })),
            );
          }
        }
      }
    }

    const manufacturingAdditions: CadSolidRecipe[] = [];
    if (baseHoleStructure === "magnet-post-hole") {
      const postDepthBySlotId = new Map(
        splitUnit.magnetPostHoles.map((hole) => [hole.id, hole.depth]),
      );
      manufacturingAdditions.push(...splitUnit.slotHoles.flatMap((slotHole) => {
        const postDepth = postDepthBySlotId.get(slotHole.id);
        return postDepth === undefined
          ? []
          : [{
              kind: "magnet-post-floor" as const,
              feature: slotHole,
              postHoleDepth: postDepth,
            }];
      }));
    }

    const filenameLabel = `part_${String(index + 1).padStart(2, "0")}_${buildSplitPartIdLabel(splitUnit.groups)}`;
    return [{
      body: {
        kind: "profile-band-body",
        layers: profileUnit.layerProfiles,
      },
      assemblyAdditions,
      assemblyCuts,
      manufacturingAdditions,
      primaryCuts: splitUnit.slotHoles.map((feature) => ({
        kind: "slot-hole" as const,
        feature,
      })),
      baseCuts: buildBaseCutPlan(
        baseHoleStructure,
        splitUnit.baseHoles,
        splitUnit.magnetPostHoles,
        params.baseHoleSize,
      ),
      finishing: {
        kind: "repair",
        preserveSmallFeatures: baseHoleStructure === "magnet-post-hole",
        rejectAtOrBelowVolume: MIN_VALID_VOLUME,
      },
      metadata: {
        index,
        filenameLabel,
        label: buildSplitPartLabel(splitUnit.groups, params),
        fromHeight: profileUnit.baseHeight,
        toHeight: profileUnit.topHeight,
      },
    }];
  });
}

export function realizeSteppedCadSplitParts(request: {
  partitionPlan: SteppedCadSplitPartitionPlan;
  splitProfilePlan: SteppedCadSplitProfilePlan;
  params: Readonly<SteppedLayoutParams>;
}): SteppedSplitPartResult[] {
  return buildSplitPartRealizationPlans(request).flatMap((plan) => {
    const geometry = realizeCadEntity(plan);
    return geometry ? [{ ...plan.metadata, geometry }] : [];
  });
}
