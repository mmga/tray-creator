import { booleans, expansions, primitives, transforms } from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import { insetGeom2 } from "@/lib/outline-geometry";
import type {
  SteppedCadBaseHoleFeature,
  SteppedCadFeatureGraph,
  SteppedCadGroupFeature,
  SteppedCadSlotHoleFeature,
} from "@/lib/stepped-cad-feature-graph";
import type {
  SlotGroup,
  SplitGrooveType,
  SteppedLayoutParams,
} from "@/types/custom-tray";

const { intersect, subtract, union } = booleans;
const { offset } = expansions;
const { circle } = primitives;
const { translate } = transforms;

const DEFAULT_INTERFACE_GROOVE_INSET = 1;
const INSET_INTERFACE_GROOVE_INSET = 1;
const DEFAULT_INTERFACE_CLEARANCE = 0.1;
const INTERFACE_FOOTPRINT_SEGMENTS = 24;
const LOCATOR_RECESS_DEPTH = 2;

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

type AssemblyMode = {
  enableRecess: boolean;
  grooveType: SplitGrooveType;
  enableLocators: boolean;
};

export type SteppedCadSplitProfileIssueCode =
  | "empty-contact-footprint"
  | "empty-male-after-inset"
  | "empty-female-after-clip"
  | "geom2-op-failed";

export interface SteppedCadSplitProfileIssue {
  code: SteppedCadSplitProfileIssueCode;
  unitKey: string;
  interfaceHeight?: number;
  detail?: string;
}

export interface SteppedCadSplitProfileRequest {
  graph: SteppedCadFeatureGraph;
  params: Pick<
    SteppedLayoutParams,
    | "groups"
    | "splitGrooveDepth"
    | "splitGrooveType"
    | "enableSplitRecess"
    | "enableSplitLocators"
    | "splitAssemblyMode"
  >;
}

export interface SteppedCadSplitInterfaceProfile {
  interfaceHeight: number;
  grooveType: SplitGrooveType;
  contactFootprint: Geom2;
  maleFootprint: Geom2 | null;
  femaleFootprint: Geom2 | null;
  maleDepth: number;
  femaleDepth: number;
  state: "active" | "suppressed-empty-inset" | "suppressed-empty-clip";
  upperUnitKey: string;
  lowerUnitKey: string;
}

export interface SteppedCadLayerProfilePlan {
  kind: "body-band" | "recess-shell-band" | "tenon-band";
  fromHeight: number;
  toHeight: number;
  footprint: Geom2;
  interfaceHeight?: number;
}

export interface SteppedCadSplitProfileUnit {
  unitKey: string;
  groupIds: string[];
  baseHeight: number;
  topHeight: number;
  interfaceProfiles: SteppedCadSplitInterfaceProfile[];
  layerProfiles: SteppedCadLayerProfilePlan[];
}

export interface SteppedCadSplitProfilePlan {
  units: SteppedCadSplitProfileUnit[];
  interfaces: SteppedCadSplitInterfaceProfile[];
  issues: SteppedCadSplitProfileIssue[];
}

function isEmptyGeom2(geometry: Geom2 | null | undefined) {
  const sides = (geometry as Geom2 & { sides?: unknown[] } | null | undefined)
    ?.sides;
  return !geometry || !Array.isArray(sides) || sides.length === 0;
}

function unionGeom2Parts(parts: Geom2[]) {
  return parts.length === 1 ? parts[0] : (union(...parts) as Geom2);
}

function sortIssues(issues: SteppedCadSplitProfileIssue[]) {
  return [...issues].sort((left, right) => {
    if (left.unitKey !== right.unitKey) {
      return left.unitKey.localeCompare(right.unitKey);
    }
    return (left.interfaceHeight ?? -1) - (right.interfaceHeight ?? -1);
  });
}

function sortInterfaces(interfaces: SteppedCadSplitInterfaceProfile[]) {
  return [...interfaces].sort((left, right) => {
    if (left.interfaceHeight !== right.interfaceHeight) {
      return left.interfaceHeight - right.interfaceHeight;
    }
    if (left.lowerUnitKey !== right.lowerUnitKey) {
      return left.lowerUnitKey.localeCompare(right.lowerUnitKey);
    }
    return left.upperUnitKey.localeCompare(right.upperUnitKey);
  });
}

function sortLayers(layers: SteppedCadLayerProfilePlan[]) {
  const rank: Record<SteppedCadLayerProfilePlan["kind"], number> = {
    "body-band": 0,
    "recess-shell-band": 1,
    "tenon-band": 2,
  };
  return [...layers].sort((left, right) => {
    if (left.fromHeight !== right.fromHeight) {
      return left.fromHeight - right.fromHeight;
    }
    if (left.toHeight !== right.toHeight) {
      return left.toHeight - right.toHeight;
    }
    return rank[left.kind] - rank[right.kind];
  });
}

function resolveAssemblyMode(
  params: Pick<
    SteppedLayoutParams,
    "splitGrooveType" | "enableSplitRecess" | "enableSplitLocators" | "splitAssemblyMode"
  >,
): AssemblyMode {
  const grooveType: SplitGrooveType =
    params.splitGrooveType === "inset" ? "inset" : "profile";

  return {
    enableRecess:
      params.enableSplitRecess === true ||
      params.splitAssemblyMode === "locator-recess",
    grooveType,
    enableLocators:
      params.enableSplitLocators === true ||
      params.splitAssemblyMode === "locator-recess",
  };
}

function buildSplitUnitKeyByGroupId(
  groups: SteppedCadGroupFeature[],
  layoutGroups: Pick<SlotGroup, "id" | "splitPartGroupId">[],
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

  for (const group of layoutGroups) {
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
    unit.baseHoles = baseHoles.filter((hole) => groupIds.has(hole.groupId));
    unit.groups.sort((left, right) => left.columnHeight - right.columnHeight);
  }

  return [...unitsByKey.values()].sort(
    (left, right) =>
      left.minHeight - right.minHeight || left.maxHeight - right.maxHeight,
  );
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
          ? (axis === "x" ? -trayWidth / 2 : -trayDepth / 2) - 100
          : (sorted[index - 1].center[axis] + sorted[index].center[axis]) / 2;
      const nextBoundary =
        index === sorted.length - 1
          ? (axis === "x" ? trayWidth / 2 : trayDepth / 2) + 100
          : (sorted[index].center[axis] + sorted[index + 1].center[axis]) / 2;
      const width =
        axis === "x"
          ? nextBoundary - previousBoundary
          : trayWidth + 200;
      const depth =
        axis === "y"
          ? nextBoundary - previousBoundary
          : trayDepth + 200;
      const centerX = axis === "x" ? (previousBoundary + nextBoundary) / 2 : 0;
      const centerY = axis === "y" ? (previousBoundary + nextBoundary) / 2 : 0;

      partitions.set(sorted[index].unit.key, {
        footprint: primitives.rectangle({
          size: [width, depth],
          center: [centerX, centerY],
        }),
      });
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

function buildInterfaceSupportFootprint(
  splitUnit: SteppedCadSplitUnit,
  partitions: Map<string, SteppedCadPartition>,
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
    ) as Geom2,
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

function buildSplitGrooveMaleFootprint(
  splitUnit: SteppedCadSplitUnit,
  partitions: Map<string, SteppedCadPartition>,
  grooveType: SplitGrooveType,
) {
  const footprint = buildSupportFootprint(splitUnit, partitions);
  if (!footprint || grooveType !== "inset") {
    return footprint;
  }

  const insetParts = getPartitionedGroupFootprints(splitUnit, partitions)
    .map((entry) => {
      try {
        return insetGeom2(entry.footprint, INSET_INTERFACE_GROOVE_INSET);
      } catch {
        return null;
      }
    })
    .filter((item): item is Geom2 => item !== null && !isEmptyGeom2(item));

  if (insetParts.length === 0) {
    return null;
  }

  return unionGeom2Parts(insetParts);
}

function offsetInterfaceFootprint(footprint: Geom2, delta: number) {
  if (delta <= 0) {
    return footprint;
  }

  try {
    const expanded = offset(
      {
        delta,
        corners: "edge",
        segments: INTERFACE_FOOTPRINT_SEGMENTS,
      },
      footprint,
    ) as Geom2;
    return isEmptyGeom2(expanded) ? footprint : expanded;
  } catch {
    return footprint;
  }
}

function subtractGeom2Safe(
  source: Geom2,
  cutter: Geom2,
  issues: SteppedCadSplitProfileIssue[],
  unitKey: string,
  interfaceHeight: number,
) {
  try {
    const result = subtract(source, cutter) as Geom2;
    return isEmptyGeom2(result) ? null : result;
  } catch (error) {
    issues.push({
      code: "geom2-op-failed",
      unitKey,
      interfaceHeight,
      detail: error instanceof Error ? error.message : String(error),
    });
    return source;
  }
}

function buildInterfaceProfiles(
  splitUnits: SteppedCadSplitUnit[],
  partitions: Map<string, SteppedCadPartition>,
  assemblyMode: AssemblyMode,
  grooveDepth: number,
  issues: SteppedCadSplitProfileIssue[],
) {
  if (grooveDepth <= 0) {
    return [] as SteppedCadSplitInterfaceProfile[];
  }

  const interfaces: SteppedCadSplitInterfaceProfile[] = [];
  for (const lowerUnit of splitUnits) {
    const lowerBaseHeight = getSplitUnitExternalBaseHeight(lowerUnit, splitUnits);
    const lowerHeights = new Set(lowerUnit.groups.map((group) => group.columnHeight));

    for (const upperUnit of splitUnits) {
      if (upperUnit.key === lowerUnit.key) {
        continue;
      }

      const interfaceHeight = getSplitUnitExternalBaseHeight(upperUnit, splitUnits);
      if (!lowerHeights.has(interfaceHeight)) {
        continue;
      }

      const lowerDepthCap = interfaceHeight - lowerBaseHeight;
      if (lowerDepthCap <= 0) {
        continue;
      }

      if (!assemblyMode.enableRecess && assemblyMode.enableLocators) {
        continue;
      }

      if (assemblyMode.enableRecess) {
        const contactFootprint = buildSupportFootprint(upperUnit, partitions);
        if (!contactFootprint) {
          issues.push({
            code: "empty-contact-footprint",
            unitKey: lowerUnit.key,
            interfaceHeight,
          });
          continue;
        }

        const contactGroupIds = new Set(
          lowerUnit.groups
            .filter((group) => group.columnHeight === interfaceHeight)
            .map((group) => group.groupId),
        );
        const lowerContactFootprint = buildSupportFootprint(
          lowerUnit,
          partitions,
          contactGroupIds,
        );
        if (!lowerContactFootprint) {
          issues.push({
            code: "empty-contact-footprint",
            unitKey: lowerUnit.key,
            interfaceHeight,
          });
          continue;
        }

        const maleFootprint = buildSplitGrooveMaleFootprint(
          upperUnit,
          partitions,
          assemblyMode.grooveType,
        );
        const maleDepth = Math.min(
          LOCATOR_RECESS_DEPTH,
          grooveDepth,
          upperUnit.maxHeight - interfaceHeight,
        );
        const femaleDepth = Math.min(
          LOCATOR_RECESS_DEPTH,
          grooveDepth,
          lowerDepthCap,
        );

        if (!maleFootprint) {
          interfaces.push({
            interfaceHeight,
            grooveType: assemblyMode.grooveType,
            contactFootprint,
            maleFootprint: null,
            femaleFootprint: null,
            maleDepth,
            femaleDepth,
            state: "suppressed-empty-inset",
            upperUnitKey: upperUnit.key,
            lowerUnitKey: lowerUnit.key,
          });
          issues.push({
            code: "empty-male-after-inset",
            unitKey: upperUnit.key,
            interfaceHeight,
          });
          continue;
        }

        const femaleRaw = offsetInterfaceFootprint(
          maleFootprint,
          DEFAULT_INTERFACE_CLEARANCE,
        );
        const femaleFootprint = intersect(
          femaleRaw,
          lowerContactFootprint,
        ) as Geom2;
        if (isEmptyGeom2(femaleFootprint)) {
          interfaces.push({
            interfaceHeight,
            grooveType: assemblyMode.grooveType,
            contactFootprint,
            maleFootprint,
            femaleFootprint: null,
            maleDepth,
            femaleDepth,
            state: "suppressed-empty-clip",
            upperUnitKey: upperUnit.key,
            lowerUnitKey: lowerUnit.key,
          });
          issues.push({
            code: "empty-female-after-clip",
            unitKey: lowerUnit.key,
            interfaceHeight,
          });
          continue;
        }

        interfaces.push({
          interfaceHeight,
          grooveType: assemblyMode.grooveType,
          contactFootprint,
          maleFootprint,
          femaleFootprint,
          maleDepth,
          femaleDepth,
          state: "active",
          upperUnitKey: upperUnit.key,
          lowerUnitKey: lowerUnit.key,
        });
        continue;
      }

      const contactFootprint = buildInterfaceSupportFootprint(upperUnit, partitions);
      if (!contactFootprint) {
        issues.push({
          code: "empty-contact-footprint",
          unitKey: lowerUnit.key,
          interfaceHeight,
        });
        continue;
      }

      const pocketFootprint = insetInterfaceFootprint(contactFootprint);
      if (isEmptyGeom2(pocketFootprint)) {
        issues.push({
          code: "empty-male-after-inset",
          unitKey: upperUnit.key,
          interfaceHeight,
        });
        continue;
      }

      interfaces.push({
        interfaceHeight,
        grooveType: assemblyMode.grooveType,
        contactFootprint,
        maleFootprint: pocketFootprint,
        femaleFootprint: pocketFootprint,
        maleDepth: Math.min(grooveDepth, upperUnit.maxHeight - interfaceHeight),
        femaleDepth: Math.min(grooveDepth, lowerDepthCap),
        state: "active",
        upperUnitKey: upperUnit.key,
        lowerUnitKey: lowerUnit.key,
      });
    }
  }

  return sortInterfaces(interfaces);
}

function buildUnitLayerProfiles(
  splitUnit: SteppedCadSplitUnit,
  splitUnits: SteppedCadSplitUnit[],
  partitions: Map<string, SteppedCadPartition>,
  interfaces: SteppedCadSplitInterfaceProfile[],
  issues: SteppedCadSplitProfileIssue[],
) {
  const baseHeight = getSplitUnitExternalBaseHeight(splitUnit, splitUnits);
  const groupFootprints = getPartitionedGroupFootprints(splitUnit, partitions);
  const layers: SteppedCadLayerProfilePlan[] = [];

  const activeLowerInterfaces = interfaces.filter(
    (item) =>
      item.lowerUnitKey === splitUnit.key &&
      item.state === "active" &&
      item.femaleFootprint &&
      item.femaleDepth > 0,
  );
  const femaleByHeight = new Map<
    number,
    { depth: number; footprint: Geom2 }
  >();
  for (const profile of activeLowerInterfaces) {
    const existing = femaleByHeight.get(profile.interfaceHeight);
    if (!existing) {
      femaleByHeight.set(profile.interfaceHeight, {
        depth: profile.femaleDepth,
        footprint: profile.femaleFootprint!,
      });
      continue;
    }

    femaleByHeight.set(profile.interfaceHeight, {
      depth: Math.max(existing.depth, profile.femaleDepth),
      footprint: unionGeom2Parts([
        existing.footprint,
        profile.femaleFootprint!,
      ]),
    });
  }

  for (const entry of groupFootprints) {
    const interfaceEntry = femaleByHeight.get(entry.group.columnHeight);
    const topHeight = entry.group.columnHeight;
    const lowerSliceTop = interfaceEntry
      ? Math.max(baseHeight, topHeight - interfaceEntry.depth)
      : topHeight;

    if (lowerSliceTop > baseHeight) {
      layers.push({
        kind: "body-band",
        fromHeight: baseHeight,
        toHeight: lowerSliceTop,
        footprint: entry.footprint,
        interfaceHeight: interfaceEntry ? topHeight : undefined,
      });
    }

    if (interfaceEntry) {
      const shellFootprint = subtractGeom2Safe(
        entry.footprint,
        interfaceEntry.footprint,
        issues,
        splitUnit.key,
        topHeight,
      );
      if (shellFootprint && !isEmptyGeom2(shellFootprint) && topHeight > lowerSliceTop) {
        layers.push({
          kind: "recess-shell-band",
          fromHeight: lowerSliceTop,
          toHeight: topHeight,
          footprint: shellFootprint,
          interfaceHeight: topHeight,
        });
      }
    }
  }

  const activeUpperInterfaces = interfaces.filter(
    (item) =>
      item.upperUnitKey === splitUnit.key &&
      item.state === "active" &&
      item.maleFootprint &&
      item.maleDepth > 0,
  );
  if (activeUpperInterfaces.length > 0 && baseHeight > 0) {
    const tenonDepth = Math.max(...activeUpperInterfaces.map((item) => item.maleDepth));
    const tenonFootprint = unionGeom2Parts(
      activeUpperInterfaces.map((item) => item.maleFootprint!),
    );
    const fromHeight = Math.max(0, baseHeight - tenonDepth);
    if (!isEmptyGeom2(tenonFootprint) && baseHeight > fromHeight) {
      layers.push({
        kind: "tenon-band",
        fromHeight,
        toHeight: baseHeight,
        footprint: tenonFootprint,
        interfaceHeight: baseHeight,
      });
    }
  }

  return sortLayers(layers);
}

export function buildSteppedCadSplitProfilePlan({
  graph,
  params,
}: SteppedCadSplitProfileRequest): SteppedCadSplitProfilePlan {
  if (graph.groups.length === 0) {
    return {
      units: [],
      interfaces: [],
      issues: [],
    };
  }

  const splitUnitKeyByGroupId = buildSplitUnitKeyByGroupId(
    graph.groups,
    params.groups,
  );
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
  const assemblyMode = resolveAssemblyMode(params);
  const issues: SteppedCadSplitProfileIssue[] = [];
  const grooveDepth = Math.max(0, params.splitGrooveDepth ?? 0);
  const interfaces = buildInterfaceProfiles(
    splitUnits,
    partitions,
    assemblyMode,
    grooveDepth,
    issues,
  );

  const units = splitUnits.map<SteppedCadSplitProfileUnit>((splitUnit) => {
    const baseHeight = getSplitUnitExternalBaseHeight(splitUnit, splitUnits);
    return {
      unitKey: splitUnit.key,
      groupIds: splitUnit.groups.map((group) => group.groupId),
      baseHeight,
      topHeight: splitUnit.maxHeight,
      interfaceProfiles: interfaces.filter(
        (item) =>
          item.lowerUnitKey === splitUnit.key || item.upperUnitKey === splitUnit.key,
      ),
      layerProfiles: buildUnitLayerProfiles(
        splitUnit,
        splitUnits,
        partitions,
        interfaces,
        issues,
      ),
    };
  }).sort((left, right) => {
    if (left.baseHeight !== right.baseHeight) {
      return left.baseHeight - right.baseHeight;
    }
    if (left.topHeight !== right.topHeight) {
      return left.topHeight - right.topHeight;
    }
    return left.unitKey.localeCompare(right.unitKey);
  });

  return {
    units,
    interfaces,
    issues: sortIssues(issues),
  };
}
