import { measurements, booleans } from "@jscad/modeling";
import { describe, expect, it } from "vitest";
import { buildSteppedCadFeatureGraph } from "@/test/contoured-state";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { buildSteppedCadSplitPartitionPlan } from "@/lib/stepped-cad-split-partition-plan";
import type { SlotGroup, SteppedLayoutParams } from "@/types/custom-tray";

const { measureArea } = measurements;
const { intersect } = booleans;

function group(id: string, bottomHeight: number): SlotGroup {
  return {
    ...STEPPED_LAYOUT_DEFAULTS.groups[0],
    id,
    name: id,
    bottomHeight,
  };
}

function buildParams(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    footprintStyle: "rectangular",
    traySizingMode: "auto",
    boundarySpacing: 5,
    boundarySpacingIndependent: true,
    enableSplitAssembly: true,
    baseHoleStructure: "magnet-post-hole",
    groups: [group("low", 10), group("high", 20)],
    slots: [
      {
        id: "slot-low",
        x: 80,
        y: 100,
        shape: "circle",
        width: 28,
        height: 28,
        rotation: 0,
        groupId: "low",
      },
      {
        id: "slot-high",
        x: 180,
        y: 100,
        shape: "circle",
        width: 40,
        height: 40,
        rotation: 0,
        groupId: "high",
      },
    ],
  };
}

function buildPlan(params: SteppedLayoutParams) {
  return buildSteppedCadSplitPartitionPlan({
    graph: buildSteppedCadFeatureGraph(params),
    layoutGroups: params.groups,
  });
}

describe("Split Assembly Partition Plan", () => {
  it("assigns every CAD feature to one stable split unit", () => {
    const plan = buildPlan(buildParams());

    expect(plan.units.map((unit) => unit.groupIds)).toEqual([["low"], ["high"]]);
    expect(plan.units.map((unit) => unit.externalBaseHeight)).toEqual([0, 10]);
    expect(plan.units.map((unit) => unit.slotHoles.map((hole) => hole.id))).toEqual([
      ["slot-low"],
      ["slot-high"],
    ]);
    expect(plan.units.map((unit) => unit.baseHoles.length)).toEqual([1, 1]);
    expect(plan.units.map((unit) => unit.magnetPostHoles.length)).toEqual([1, 1]);
  });

  it("merges transitive split targets before assigning features", () => {
    const params = buildParams();
    const top = group("top", 30);
    params.groups = [
      { ...params.groups[0], splitPartGroupId: "high" },
      { ...params.groups[1], splitPartGroupId: "top" },
      top,
    ];
    params.slots = [
      ...params.slots,
      {
        id: "slot-top",
        x: 130,
        y: 160,
        shape: "circle",
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "top",
      },
    ];

    const plan = buildPlan(params);

    expect(plan.units).toHaveLength(1);
    expect(plan.units[0].groupIds).toEqual(["low", "high", "top"]);
    expect(plan.units[0].slotHoles.map((hole) => hole.id)).toEqual([
      "slot-low",
      "slot-high",
      "slot-top",
    ]);
  });

  it("ignores split targets that are not present in the CAD feature graph", () => {
    const params = buildParams();
    params.groups = [
      { ...params.groups[0], splitPartGroupId: "missing" },
      params.groups[1],
    ];

    const plan = buildPlan(params);

    expect(plan.units.map((unit) => unit.groupIds)).toEqual([
      ["low"],
      ["high"],
    ]);
  });

  it("creates non-overlapping support footprints for same-height units", () => {
    const params = buildParams();
    params.groups = [group("left", 10), group("right", 10)];
    params.slots = [
      { ...params.slots[0], id: "slot-left", groupId: "left", x: 70 },
      { ...params.slots[1], id: "slot-right", groupId: "right", x: 190 },
    ];

    const plan = buildPlan(params);
    const [left, right] = plan.units;
    const overlap = intersect(left.supportFootprint!, right.supportFootprint!);

    expect(left.partitionFootprint).not.toBeNull();
    expect(right.partitionFootprint).not.toBeNull();
    expect(Math.abs(measureArea(overlap))).toBeLessThan(1e-6);
    expect(left.supportFootprintsByHeight).toHaveLength(1);
    expect(right.supportFootprintsByHeight).toHaveLength(1);
  });
});
