import {
  booleans,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import {
  insetGeom2,
} from "@/lib/outline-geometry";
import type {
  SteppedCadBaseHoleFeature,
  SteppedCadGroupFeature,
  SteppedCadSlotHoleFeature,
} from "@/lib/stepped-cad-feature-graph";

const { intersect, subtract, union } = booleans;
const { circle } = primitives;
const { translate } = transforms;

const DEFAULT_INTERFACE_GROOVE_INSET = 1;
const INTERFACE_FOOTPRINT_SEGMENTS = 24;
const LOCATOR_RECESS_DEPTH = 2;

export type SteppedCadSplitUnitInput = {
  key: string;
  groups: SteppedCadGroupFeature[];
  slotHoles: SteppedCadSlotHoleFeature[];
  baseHoles: SteppedCadBaseHoleFeature[];
  minHeight: number;
  maxHeight: number;
};

export type SteppedCadPartitionInput = {
  footprint: Geom2;
};

export interface SteppedCadSplitLayerProfile {
  fromHeight: number;
  toHeight: number;
  footprint: Geom2;
  kind: "body" | "recess" | "tenon";
}

export interface SteppedCadSplitUnitProfile {
  layers: SteppedCadSplitLayerProfile[];
}

type PartitionedGroupFootprint = {
  group: SteppedCadGroupFeature;
  footprint: Geom2;
};

type InterfaceBand = {
  fromHeight: number;
  toHeight: number;
  footprint: Geom2;
};

function isEmptyGeom2(geometry: Geom2 | null | undefined) {
  const sides = (geometry as Geom2 & { sides?: unknown[] } | null | undefined)
    ?.sides;
  return !geometry || !Array.isArray(sides) || sides.length === 0;
}

function unionGeom2Parts(parts: Geom2[]) {
  return parts.length === 1 ? parts[0] : (union(...parts) as Geom2);
}

function subtractGeom2(base: Geom2, cutters: Geom2[]) {
  if (cutters.length === 0) {
    return base;
  }

  try {
    const result = subtract(base, ...cutters) as Geom2;
    return isEmptyGeom2(result) ? null : result;
  } catch {
    return base;
  }
}

function getPartitionedGroupFootprints(
  splitUnit: SteppedCadSplitUnitInput,
  partitions: Map<string, SteppedCadPartitionInput>,
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
  splitUnit: SteppedCadSplitUnitInput,
  partitions: Map<string, SteppedCadPartitionInput>,
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

function buildInterfaceSupportFootprint(
  splitUnit: SteppedCadSplitUnitInput,
  partitions: Map<string, SteppedCadPartitionInput>,
) {
  if (splitUnit.slotHoles.length === 0) {
    return buildSupportFootprint(splitUnit, partitions);
  }

  const slotFootprints = splitUnit.slotHoles.map((slotHole) =>
    translate(
      [slotHole.cx, slotHole.cy],
      circle({
        radius: slotHole.connectorRadius,
        segments: INTERFACE_FOOTPRINT_SEGMENTS,
      }),
    ) as Geom2
  );
  const footprint = unionGeom2Parts(slotFootprints);
  const partition = partitions.get(splitUnit.key);

  if (!partition) {
    return footprint;
  }

  const clipped = intersect(footprint, partition.footprint) as Geom2;
  return isEmptyGeom2(clipped) ? footprint : clipped;
}

function insetInterfaceFootprint(footprint: Geom2) {
  try {
    return insetGeom2(
      footprint,
      DEFAULT_INTERFACE_GROOVE_INSET,
    ) ?? footprint;
  } catch {
    return footprint;
  }
}

function getSplitUnitExternalBaseHeight(
  splitUnit: SteppedCadSplitUnitInput,
  splitUnits: SteppedCadSplitUnitInput[],
) {
  const lowerHeights = splitUnits
    .filter((unit) => unit.key !== splitUnit.key && unit.maxHeight < splitUnit.minHeight)
    .map((unit) => unit.maxHeight);

  return lowerHeights.length > 0 ? Math.max(...lowerHeights) : 0;
}

function buildRecessBands(
  splitUnit: SteppedCadSplitUnitInput,
  splitUnits: SteppedCadSplitUnitInput[],
  partitions: Map<string, SteppedCadPartitionInput>,
  baseHeight: number,
  grooveDepth: number,
) {
  const bands: InterfaceBand[] = [];
  const splitUnitHeights = new Set(
    splitUnit.groups.map((group) => group.columnHeight),
  );

  for (const otherSplitUnit of splitUnits) {
    if (otherSplitUnit.key === splitUnit.key) {
      continue;
    }

    const otherBaseHeight = getSplitUnitExternalBaseHeight(otherSplitUnit, splitUnits);
    if (!splitUnitHeights.has(otherBaseHeight)) {
      continue;
    }

    const depth = Math.min(
      LOCATOR_RECESS_DEPTH,
      grooveDepth,
      otherBaseHeight - baseHeight,
    );
    if (depth <= 0) {
      continue;
    }

    const femaleFootprint = buildSupportFootprint(otherSplitUnit, partitions);
    if (!femaleFootprint) {
      continue;
    }

    bands.push({
      fromHeight: otherBaseHeight - depth,
      toHeight: otherBaseHeight,
      footprint: femaleFootprint,
    });
  }

  return bands;
}

function buildTenonBand(
  splitUnit: SteppedCadSplitUnitInput,
  partitions: Map<string, SteppedCadPartitionInput>,
  baseHeight: number,
  grooveDepth: number,
) {
  if (baseHeight <= 0) {
    return null;
  }

  const depth = Math.min(
    LOCATOR_RECESS_DEPTH,
    grooveDepth,
    splitUnit.maxHeight - baseHeight,
  );
  if (depth <= 0) {
    return null;
  }

  const supportFootprint = buildSupportFootprint(splitUnit, partitions);
  if (!supportFootprint) {
    return null;
  }

  return {
    fromHeight: baseHeight - depth,
    toHeight: baseHeight,
    footprint: insetInterfaceFootprint(supportFootprint),
  };
}

export function buildSteppedCadSplitUnitProfile(
  splitUnit: SteppedCadSplitUnitInput,
  splitUnits: SteppedCadSplitUnitInput[],
  partitions: Map<string, SteppedCadPartitionInput>,
  grooveDepth: number,
) {
  const baseHeight = getSplitUnitExternalBaseHeight(splitUnit, splitUnits);
  const partitionedGroups = getPartitionedGroupFootprints(splitUnit, partitions);
  if (partitionedGroups.length === 0) {
    return { layers: [] } satisfies SteppedCadSplitUnitProfile;
  }

  const recessBands = buildRecessBands(
    splitUnit,
    splitUnits,
    partitions,
    baseHeight,
    grooveDepth,
  );
  const tenonBand = buildTenonBand(
    splitUnit,
    partitions,
    baseHeight,
    grooveDepth,
  );

  const breakpoints = new Set<number>([
    baseHeight,
    ...partitionedGroups.map((entry) => entry.group.columnHeight),
    ...recessBands.flatMap((band) => [band.fromHeight, band.toHeight]),
  ]);
  if (tenonBand) {
    breakpoints.add(tenonBand.fromHeight);
    breakpoints.add(tenonBand.toHeight);
  }

  const sortedHeights = [...breakpoints]
    .filter((height) => Number.isFinite(height))
    .sort((left, right) => left - right);

  const layers: SteppedCadSplitLayerProfile[] = [];
  for (let index = 0; index < sortedHeights.length - 1; index += 1) {
    const fromHeight = sortedHeights[index];
    const toHeight = sortedHeights[index + 1];
    if (toHeight - fromHeight <= 0.001) {
      continue;
    }

    const activeBodyFootprints = partitionedGroups
      .filter(
        (entry) =>
          entry.group.columnHeight > fromHeight &&
          entry.group.columnHeight > baseHeight,
      )
      .map((entry) => entry.footprint);

    const recessCutters = recessBands
      .filter(
        (band) =>
          fromHeight >= band.fromHeight - 0.001 &&
          toHeight <= band.toHeight + 0.001,
      )
      .map((band) => band.footprint);

    const additionFootprints: Geom2[] = [];
    let bodyFootprint =
      activeBodyFootprints.length > 0
        ? unionGeom2Parts(activeBodyFootprints)
        : null;

    if (bodyFootprint && recessCutters.length > 0) {
      bodyFootprint = subtractGeom2(bodyFootprint, recessCutters);
    }
    if (bodyFootprint) {
      additionFootprints.push(bodyFootprint);
    }

    if (
      tenonBand &&
      fromHeight >= tenonBand.fromHeight - 0.001 &&
      toHeight <= tenonBand.toHeight + 0.001
    ) {
      additionFootprints.push(tenonBand.footprint);
    }

    if (additionFootprints.length === 0) {
      continue;
    }

    layers.push({
      fromHeight,
      toHeight,
      footprint: unionGeom2Parts(additionFootprints),
      kind:
        tenonBand &&
        fromHeight >= tenonBand.fromHeight - 0.001 &&
        toHeight <= tenonBand.toHeight + 0.001 &&
        !bodyFootprint
          ? "tenon"
          : recessCutters.length > 0
            ? "recess"
            : "body",
    });
  }

  return { layers } satisfies SteppedCadSplitUnitProfile;
}

export function buildSteppedCadDefaultGrooveTenonFootprint(
  splitUnit: SteppedCadSplitUnitInput,
  partitions: Map<string, SteppedCadPartitionInput>,
) {
  const supportFootprint = buildInterfaceSupportFootprint(splitUnit, partitions);
  return supportFootprint ? insetInterfaceFootprint(supportFootprint) : null;
}
