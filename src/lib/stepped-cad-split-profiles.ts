import { booleans, expansions } from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import { insetGeom2 } from "@/lib/outline-geometry";
import type {
  SteppedCadSplitPartitionPlan,
  SteppedCadSplitPartitionUnit,
} from "@/lib/stepped-cad-split-partition-plan";
import type {
  SplitGrooveType,
  SteppedLayoutParams,
} from "@/types/custom-tray";

const { intersect, subtract, union } = booleans;
const { offset } = expansions;

const DEFAULT_INTERFACE_GROOVE_INSET = 1;
const INSET_INTERFACE_GROOVE_INSET = 1;
const DEFAULT_INTERFACE_CLEARANCE = 0.1;
const INTERFACE_FOOTPRINT_SEGMENTS = 24;
const LOCATOR_RECESS_DEPTH = 2;

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
  partitionPlan: SteppedCadSplitPartitionPlan;
  params: Pick<
    SteppedLayoutParams,
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
  splitUnit: SteppedCadSplitPartitionUnit,
  grooveType: SplitGrooveType,
) {
  const footprint = splitUnit.supportFootprint;
  if (!footprint || grooveType !== "inset") {
    return footprint;
  }

  const insetParts = splitUnit.partitionedGroups
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
  splitUnits: readonly SteppedCadSplitPartitionUnit[],
  assemblyMode: AssemblyMode,
  grooveDepth: number,
  issues: SteppedCadSplitProfileIssue[],
) {
  if (grooveDepth <= 0) {
    return [] as SteppedCadSplitInterfaceProfile[];
  }

  const interfaces: SteppedCadSplitInterfaceProfile[] = [];
  for (const lowerUnit of splitUnits) {
    const lowerBaseHeight = lowerUnit.externalBaseHeight;
    const lowerHeights = new Set(lowerUnit.groups.map((group) => group.columnHeight));

    for (const upperUnit of splitUnits) {
      if (upperUnit.unitKey === lowerUnit.unitKey) {
        continue;
      }

      const interfaceHeight = upperUnit.externalBaseHeight;
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
        const contactFootprint = upperUnit.supportFootprint;
        if (!contactFootprint) {
          issues.push({
            code: "empty-contact-footprint",
            unitKey: lowerUnit.unitKey,
            interfaceHeight,
          });
          continue;
        }

        const lowerContactFootprint = lowerUnit.supportFootprintsByHeight.find(
          (entry) => entry.topHeight === interfaceHeight,
        )?.footprint ?? null;
        if (!lowerContactFootprint) {
          issues.push({
            code: "empty-contact-footprint",
            unitKey: lowerUnit.unitKey,
            interfaceHeight,
          });
          continue;
        }

        const maleFootprint = buildSplitGrooveMaleFootprint(
          upperUnit,
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
            upperUnitKey: upperUnit.unitKey,
            lowerUnitKey: lowerUnit.unitKey,
          });
          issues.push({
            code: "empty-male-after-inset",
            unitKey: upperUnit.unitKey,
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
            upperUnitKey: upperUnit.unitKey,
            lowerUnitKey: lowerUnit.unitKey,
          });
          issues.push({
            code: "empty-female-after-clip",
            unitKey: lowerUnit.unitKey,
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
          upperUnitKey: upperUnit.unitKey,
          lowerUnitKey: lowerUnit.unitKey,
        });
        continue;
      }

      const contactFootprint = upperUnit.locatorSupportFootprint;
      if (!contactFootprint) {
        issues.push({
          code: "empty-contact-footprint",
          unitKey: lowerUnit.unitKey,
          interfaceHeight,
        });
        continue;
      }

      const pocketFootprint = insetInterfaceFootprint(contactFootprint);
      if (isEmptyGeom2(pocketFootprint)) {
        issues.push({
          code: "empty-male-after-inset",
          unitKey: upperUnit.unitKey,
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
        upperUnitKey: upperUnit.unitKey,
        lowerUnitKey: lowerUnit.unitKey,
      });
    }
  }

  return sortInterfaces(interfaces);
}

function buildUnitLayerProfiles(
  splitUnit: SteppedCadSplitPartitionUnit,
  interfaces: SteppedCadSplitInterfaceProfile[],
  issues: SteppedCadSplitProfileIssue[],
) {
  const baseHeight = splitUnit.externalBaseHeight;
  const groupFootprints = splitUnit.partitionedGroups;
  const layers: SteppedCadLayerProfilePlan[] = [];

  const activeLowerInterfaces = interfaces.filter(
    (item) =>
      item.lowerUnitKey === splitUnit.unitKey &&
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
        splitUnit.unitKey,
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
      item.upperUnitKey === splitUnit.unitKey &&
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
  partitionPlan,
  params,
}: SteppedCadSplitProfileRequest): SteppedCadSplitProfilePlan {
  if (partitionPlan.units.length === 0) {
    return {
      units: [],
      interfaces: [],
      issues: [],
    };
  }

  const splitUnits = partitionPlan.units;
  const assemblyMode = resolveAssemblyMode(params);
  const issues: SteppedCadSplitProfileIssue[] = [];
  const grooveDepth = Math.max(0, params.splitGrooveDepth ?? 0);
  const interfaces = buildInterfaceProfiles(
    splitUnits,
    assemblyMode,
    grooveDepth,
    issues,
  );

  const units = splitUnits.map<SteppedCadSplitProfileUnit>((splitUnit) => {
    const baseHeight = splitUnit.externalBaseHeight;
    return {
      unitKey: splitUnit.unitKey,
      groupIds: [...splitUnit.groupIds],
      baseHeight,
      topHeight: splitUnit.maxHeight,
      interfaceProfiles: interfaces.filter(
        (item) =>
          item.lowerUnitKey === splitUnit.unitKey ||
          item.upperUnitKey === splitUnit.unitKey,
      ),
      layerProfiles: buildUnitLayerProfiles(
        splitUnit,
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
