import { describe, expect, it } from "vitest";
import downloadedTwoHeightRecessFixture from "@/lib/fixtures/tray-stepped-cad-download-two-height-recess.json";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import { buildSteppedCadSplitProfilePlan } from "@/lib/stepped-cad-split-profiles";
import type { SteppedLayoutParams } from "@/types/custom-tray";

function buildPlan(params: SteppedLayoutParams) {
  const graph = buildSteppedCadFeatureGraph(params);
  return buildSteppedCadSplitProfilePlan({
    graph,
    params: {
      groups: params.groups,
      splitGrooveDepth: params.splitGrooveDepth,
      splitGrooveType: params.splitGrooveType,
      enableSplitRecess: params.enableSplitRecess,
      enableSplitLocators: params.enableSplitLocators,
      splitAssemblyMode: params.splitAssemblyMode,
    },
  });
}

function buildBaseParams(): SteppedLayoutParams {
  return {
    trayWidth: 260,
    trayDepth: 260,
    slots: [
      {
        id: "slot-low",
        x: 130,
        y: 130,
        shape: "circle",
        width: 28,
        height: 28,
        rotation: 0,
        groupId: "group-low",
      },
      {
        id: "slot-high",
        x: 130,
        y: 130,
        shape: "circle",
        width: 28,
        height: 28,
        rotation: 0,
        groupId: "group-high",
      },
    ],
    groups: [
      {
        id: "group-low",
        name: "低层",
        color: "#22c55e",
        bottomHeight: 10,
        useGroupSmoothingRadius: false,
        groupSmoothingRadius: 0,
        useGroupDisconnectDistance: false,
        groupDisconnectDistance: 0,
      },
      {
        id: "group-high",
        name: "高层",
        color: "#3b82f6",
        bottomHeight: 20,
        useGroupSmoothingRadius: false,
        groupSmoothingRadius: 0,
        useGroupDisconnectDistance: false,
        groupDisconnectDistance: 0,
      },
    ],
    activeGroupId: "group-low",
    spacing: 0,
    holeDepth: 3,
    splitGrooveDepth: 2,
    smoothingRadius: 0,
    disconnectDistance: 0,
    enableBaseHole: false,
    baseHoleSize: "25",
  };
}

describe("stepped cad split profiles", () => {
  it("suppresses inset recess interfaces when the upper contact outline vanishes after inset", () => {
    const params: SteppedLayoutParams = {
      ...buildBaseParams(),
      slots: [
        {
          ...buildBaseParams().slots[0],
          width: 24,
          height: 24,
        },
        {
          ...buildBaseParams().slots[1],
          width: 1.5,
          height: 1.5,
        },
      ],
      enableSplitRecess: true,
      splitGrooveType: "inset",
    };
    const plan = buildPlan(params);
    const profile = plan.interfaces[0];

    expect(profile).toBeDefined();
    expect(profile.state).toBe("suppressed-empty-inset");
    expect(profile.maleFootprint).toBeNull();
    expect(profile.femaleFootprint).toBeNull();
    expect(
      plan.issues.some(
        (issue) =>
          issue.code === "empty-male-after-inset" &&
          issue.interfaceHeight === 10,
      ),
    ).toBe(true);
    const lowerUnit = plan.units.find((unit) => unit.baseHeight === 0);
    const upperUnit = plan.units.find((unit) => unit.baseHeight === 10);

    expect(
      lowerUnit?.layerProfiles.some(
        (layer) => layer.kind === "recess-shell-band",
      ),
    ).toBe(false);
    expect(
      upperUnit?.layerProfiles.some((layer) => layer.kind === "tenon-band"),
    ).toBe(false);
  });

  it("keeps merged multi-group units on a single active recess interface", () => {
    const params: SteppedLayoutParams = {
      ...buildBaseParams(),
      slots: [
        {
          id: "slot-low-left",
          x: 80,
          y: 130,
          shape: "circle",
          width: 26,
          height: 26,
          rotation: 0,
          groupId: "group-low-left",
        },
        {
          id: "slot-low-right",
          x: 180,
          y: 130,
          shape: "circle",
          width: 26,
          height: 26,
          rotation: 0,
          groupId: "group-low-right",
        },
        {
          id: "slot-high-left",
          x: 80,
          y: 130,
          shape: "circle",
          width: 26,
          height: 26,
          rotation: 0,
          groupId: "group-high-left",
        },
        {
          id: "slot-high-right",
          x: 180,
          y: 130,
          shape: "circle",
          width: 26,
          height: 26,
          rotation: 0,
          groupId: "group-high-right",
        },
      ],
      groups: [
        {
          id: "group-low-left",
          name: "低层左",
          color: "#22c55e",
          bottomHeight: 10,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 0,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
          splitPartGroupId: "group-low-right",
        },
        {
          id: "group-low-right",
          name: "低层右",
          color: "#16a34a",
          bottomHeight: 10,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 0,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
        },
        {
          id: "group-high-left",
          name: "高层左",
          color: "#3b82f6",
          bottomHeight: 20,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 0,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
          splitPartGroupId: "group-high-right",
        },
        {
          id: "group-high-right",
          name: "高层右",
          color: "#2563eb",
          bottomHeight: 20,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 0,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
        },
      ],
      activeGroupId: "group-low-left",
      enableSplitRecess: true,
      splitGrooveType: "inset",
    };
    const plan = buildPlan(params);
    const lowUnit = plan.units.find((unit) => unit.baseHeight === 0);
    const highUnit = plan.units.find((unit) => unit.baseHeight === 10);
    const profile = plan.interfaces.find((item) => item.state === "active");

    expect(plan.interfaces).toHaveLength(1);
    expect(lowUnit?.groupIds).toHaveLength(2);
    expect(highUnit?.groupIds).toHaveLength(2);
    expect(profile).toBeDefined();
    expect(profile?.maleFootprint).not.toBeNull();
    expect(profile?.femaleFootprint).not.toBeNull();
    expect(plan.issues).toEqual([]);
  });

  it("keeps the two-height recess lower shell as one planned shell band", () => {
    const params = {
      ...downloadedTwoHeightRecessFixture.params,
      splitGrooveDepth: 2,
      enableSplitRecess: true,
      enableSplitLocators: false,
    } as SteppedLayoutParams;
    const plan = buildPlan(params);
    const lowUnit = plan.units.find((unit) =>
      unit.groupIds.includes("9424be58-80a2-4faf-b54d-b447aede6cb7"),
    );
    const highUnit = plan.units.find((unit) =>
      unit.groupIds.includes("stepped-default-group"),
    );

    expect(lowUnit).toBeDefined();
    expect(lowUnit?.layerProfiles.filter((layer) => layer.kind === "recess-shell-band")).toHaveLength(1);
    expect(lowUnit?.layerProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "body-band",
          fromHeight: 0,
          toHeight: 18,
        }),
        expect.objectContaining({
          kind: "recess-shell-band",
          fromHeight: 18,
          toHeight: 20,
          interfaceHeight: 20,
        }),
      ]),
    );
    expect(highUnit).toBeDefined();
    expect(highUnit?.layerProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "tenon-band",
          fromHeight: 18,
          toHeight: 20,
          interfaceHeight: 20,
        }),
        expect.objectContaining({
          kind: "body-band",
          fromHeight: 20,
          toHeight: 31,
        }),
      ]),
    );
  });
});
