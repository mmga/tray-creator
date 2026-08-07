import { describe, expect, it } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { getBaseHoleMinBaseThickness, MAX_BUILD_SIZE } from "@/lib/config";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import { normalizeSimpleSteppedParams } from "@/lib/simple-stepped-projection";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import {
  migrateCustomParamsToStepped,
  normalizeParamsForMode,
} from "@/lib/param-normalization";
import type {
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";

describe("param normalization", () => {
  it("recognizes legacy 100mm slots across all modes", () => {
    const grid = normalizeParamsForMode("grid", {
      ...DEFAULT_TRAY_PARAMS,
      holeDiameter: 100,
      slotDefinitionId: undefined,
      slotDiameter: undefined,
    } as unknown as TrayParams) as TrayParams;
    const custom = normalizeParamsForMode("custom", {
      ...CUSTOM_LAYOUT_DEFAULTS,
      slots: [
        {
          id: "custom-100",
          x: 100,
          y: 100,
          shape: "circle",
          width: 100,
          height: 100,
          rotation: 0,
        },
      ],
    } as unknown as CustomLayoutParams) as CustomLayoutParams;
    const simpleStepped = normalizeSimpleSteppedParams({
      ...SIMPLE_STEPPED_LAYOUT_DEFAULTS,
      rows: [{ id: "row-1", name: "前排", slotIds: ["simple-100"] }],
      slots: [
        {
          id: "simple-100",
          rowId: "row-1",
          shape: "circle",
          diameter: 100,
          x: 0,
          y: 0,
        },
      ],
    } as SimpleSteppedLayoutParams) as SimpleSteppedLayoutParams;
    const stepped = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      slots: [
        {
          id: "stepped-100",
          x: 100,
          y: 100,
          shape: "circle",
          width: 100,
          height: 100,
          rotation: 0,
          groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
        },
      ],
    } as unknown as SteppedLayoutParams) as SteppedLayoutParams;

    expect(grid).toMatchObject({
      slotDefinitionId: "circle-100",
      slotDiameter: 100.4,
    });
    expect(custom.slots[0]).toMatchObject({
      slotDefinitionId: "circle-100",
      slotWidth: 100.4,
      slotHeight: 100.4,
    });
    expect(simpleStepped.slots[0]).toMatchObject({
      slotDefinitionId: "circle-100",
      effectiveDiameter: 100.4,
    });
    expect(stepped.slots[0]).toMatchObject({
      slotDefinitionId: "circle-100",
      slotWidth: 100.4,
      slotHeight: 100.4,
    });
  });

  it("defaults legacy custom params to auto sizing and clamps fixed dimensions", () => {
    const legacy = normalizeParamsForMode("custom", {
      ...CUSTOM_LAYOUT_DEFAULTS,
      traySizingMode: undefined,
      trayWidth: 5,
      trayDepth: 6000,
    } as unknown as CustomLayoutParams) as CustomLayoutParams;
    const fixed = normalizeParamsForMode("custom", {
      ...CUSTOM_LAYOUT_DEFAULTS,
      traySizingMode: "fixed",
      trayWidth: 10.1,
      trayDepth: 249.7,
    } as CustomLayoutParams) as CustomLayoutParams;

    expect(legacy.traySizingMode).toBe("auto");
    expect(legacy.trayWidth).toBe(10);
    expect(legacy.trayDepth).toBe(5000);
    expect(fixed).toMatchObject({
      traySizingMode: "fixed",
      trayWidth: 10.1,
      trayDepth: 249.7,
    });
  });

  it("normalizes grid params without requiring a param file wrapper", () => {
    const normalized = normalizeParamsForMode("grid", {
      ...DEFAULT_TRAY_PARAMS,
      rows: 2,
      columns: 2,
      holeDiameter: 32,
      slotDiameter: undefined,
      halfCircleSlots: true,
      basePlateOnly: undefined,
      baseHoleStructure: undefined,
      enableBaseHole: undefined,
    } as unknown as TrayParams) as TrayParams;

    expect(normalized.halfCircleSlots).toBe(false);
    expect(normalized.basePlateOnly).toBe(false);
    expect(normalized.baseHoleStructure).toBe("none");
    expect(normalized.enableBaseHole).toBeUndefined();
    expect(normalized.slotDefinitionId).toBe("circle-32");
    expect(normalized.slotDiameter).toBeCloseTo(32.4, 5);
  });

  it("磁吸孔启用时自动提高网格底板厚度", () => {
    const normalized = normalizeParamsForMode("grid", {
      ...DEFAULT_TRAY_PARAMS,
      enableBaseHole: true,
      baseThickness: 1,
    } as TrayParams) as TrayParams;

    expect(normalized.baseHoleStructure).toBe("magnetic-base-hole");
    expect(normalized.enableBaseHole).toBeUndefined();
    expect(normalized.baseThickness).toBe(2.4);
  });

  it("migrates custom params into normalized stepped params", () => {
    const customParams: CustomLayoutParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      slots: [
        {
          id: "custom-slot",
          x: 20,
          y: 30,
          shape: "ellipse",
          width: 40,
          height: 25,
          rotation: -90,
        },
      ],
    };

    const migrated = migrateCustomParamsToStepped(customParams) as SteppedLayoutParams;

    expect(migrated.groups).toHaveLength(1);
    expect(migrated).not.toHaveProperty("activeGroupId");
    expect(migrated.slots[0]).toMatchObject({
      id: "custom-slot",
      shape: "circle",
      width: 40,
      height: 40,
      rotation: 270,
      groupId: migrated.groups[0].id,
      slotDefinitionId: "circle-40",
      slotWidth: 40.4,
      slotHeight: 40.4,
    });
    expect(migrated.baseHoleStructure).toBe("none");
    expect(migrated.enableBaseHole).toBeUndefined();
    expect(migrated.baseHoleSize).toBe("25");
  });

  it("磁吸孔启用时自动提高自定义底板厚度", () => {
    const normalized = normalizeParamsForMode("custom", {
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseHoleStructure: undefined,
      enableBaseHole: true,
      baseThickness: 1,
      slots: [
        {
          id: "custom-60",
          x: 80,
          y: 80,
          shape: "circle",
          width: 60,
          height: 60,
          rotation: 0,
        },
      ],
    } as unknown as CustomLayoutParams) as CustomLayoutParams;

    expect(normalized.baseHoleStructure).toBe("magnetic-base-hole");
    expect(normalized.enableBaseHole).toBeUndefined();
    expect(normalized.baseHoleSize).toBe("40");
    expect(normalized.baseThickness).toBe(2.4);
  });

  it("normalizes simple stepped legacy rows before slot snapshots and derived size", () => {
    const normalized = normalizeSimpleSteppedParams({
      stepHeight: 5,
      rowGap: 0,
      spacing: 4,
      outerMargin: 4,
      holeDepth: 3,
      rows: [],
      slots: [
        {
          id: "",
          rowId: "missing-row",
          shape: "ellipse",
          diameter: 40,
          x: 12,
          y: Number.NaN,
        },
      ],
    } as unknown as SimpleSteppedLayoutParams) as SimpleSteppedLayoutParams;

    expect(normalized.rows).toHaveLength(1);
    expect(normalized.rows[0].slotIds).toEqual([normalized.slots[0].id]);
    expect(normalized.slots[0]).toMatchObject({
      rowId: normalized.rows[0].id,
      shape: "circle",
      diameter: 40,
      slotDefinitionId: "circle-40",
      effectiveDiameter: 40.4,
      y: 0,
    });
    expect(normalized.trayWidth).toBeGreaterThan(0);
    expect(normalized.trayDepth).toBeGreaterThan(0);
  });

  it("uses the simple stepped layout core for imported tray size and snapshots", () => {
    const normalized = normalizeSimpleSteppedParams({
      ...SIMPLE_STEPPED_LAYOUT_DEFAULTS,
      trayWidth: 100,
      trayDepth: 100,
      spacing: 6,
      outerMarginIndependent: false,
      outerMargin: 99,
      rows: [
        { id: "row-1", name: "超宽行", slotIds: ["stale"] },
      ],
      slots: [
        {
          id: "slot-1",
          rowId: "row-1",
          shape: "circle",
          diameter: 100,
          slotDefinitionId: undefined,
          effectiveDiameter: undefined,
          x: -MAX_BUILD_SIZE,
          y: Number.NaN,
        },
        {
          id: "slot-2",
          rowId: "row-1",
          shape: "circle",
          diameter: 100,
          slotDefinitionId: undefined,
          effectiveDiameter: undefined,
          x: MAX_BUILD_SIZE,
          y: 0,
        },
      ],
    } as unknown as SimpleSteppedLayoutParams) as SimpleSteppedLayoutParams;

    expect(normalized.outerMargin).toBe(6);
    expect(normalized.rows[0].slotIds).toEqual(["slot-1", "slot-2"]);
    expect(normalized.trayWidth).toBeGreaterThan(MAX_BUILD_SIZE);
    expect(normalized.slots[0]).toMatchObject({
      y: 0,
      slotDefinitionId: "circle-100",
      effectiveDiameter: 100.4,
    });
    expect(normalized.slots[1]).toMatchObject({
      slotDefinitionId: "circle-100",
      effectiveDiameter: 100.4,
    });
  });

  it("migrates stepped legacy groups before slot snapshots and derived clamps", () => {
    const normalized = normalizeParamsForMode("stepped", {
      trayWidth: 40,
      trayDepth: 300,
      spacing: 1,
      holeDepth: 3,
      bridgeRadius: 25,
      slots: [
        {
          id: "",
          x: 20,
          y: 30,
          shape: "ellipse",
          width: 40,
          height: 25,
          rotation: -45,
          bottomHeight: 8,
        },
      ],
    } as unknown as SteppedLayoutParams) as SteppedLayoutParams;

    expect(normalized.groups).toHaveLength(1);
    expect(normalized).not.toHaveProperty("activeGroupId");
    expect(normalized.groups[0]).toMatchObject({
      bottomHeight: 8,
      groupSmoothingRadius: 25,
    });
    expect(normalized.groups[0].splitPartGroupId).toBeUndefined();
    expect(normalized.slots[0]).toMatchObject({
      shape: "ellipse",
      width: 40,
      height: 25,
      rotation: 315,
      groupId: normalized.groups[0].id,
    });
    expect(normalized.slots[0].slotDefinitionId).toBeUndefined();
    expect("bottomHeight" in normalized.slots[0]).toBe(false);
    expect("bridgeRadius" in (normalized as unknown as Record<string, unknown>)).toBe(
      false,
    );
    expect(normalized.trayWidth).toBe(50);
    expect(normalized.trayDepth).toBe(300);
    expect(normalized.spacing).toBe(1);
    expect(normalized.smoothingRadius).toBe(25);
    expect(normalized.splitGrooveDepth).toBe(
      STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth,
    );
    expect(normalized.splitGrooveType).toBe("profile");
  });

  it("保留自定义与阶梯模式的零间距和零边界间距", () => {
    const custom = normalizeParamsForMode("custom", {
      ...CUSTOM_LAYOUT_DEFAULTS,
      spacing: 0,
      boundarySpacing: 0,
      boundarySpacingIndependent: true,
    } as CustomLayoutParams) as CustomLayoutParams;
    const stepped = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      spacing: 0,
    } as unknown as SteppedLayoutParams) as SteppedLayoutParams;

    expect(custom.spacing).toBe(0);
    expect(custom.boundarySpacing).toBe(0);
    expect(stepped.spacing).toBe(0);
  });

  it("clears stepped split part group targets during normalization", () => {
    const normalized = normalizeParamsForMode("stepped", {
      trayWidth: 260,
      trayDepth: 260,
      groups: [
        {
          id: "low",
          name: "低组",
          color: "#22c55e",
          bottomHeight: 10,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 60,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
          splitPartGroupId: "high",
        },
        {
          id: "high",
          name: "高组",
          color: "#3b82f6",
          bottomHeight: 20,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 60,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
          splitPartGroupId: "high",
        },
        {
          id: "mid",
          name: "中组",
          color: "#f97316",
          bottomHeight: 15,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 60,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
          splitPartGroupId: "missing",
        },
      ],
      activeGroupId: "low",
      slots: [
        {
          id: "slot-1",
          x: 80,
          y: 90,
          shape: "circle",
          width: 40,
          height: 40,
          rotation: 0,
          groupId: "low",
        },
      ],
      spacing: 5,
      holeDepth: 3,
      splitGrooveDepth: STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth,
      enableSplitRecess: STEPPED_LAYOUT_DEFAULTS.enableSplitRecess,
      splitGrooveType: STEPPED_LAYOUT_DEFAULTS.splitGrooveType,
      enableSplitLocators: STEPPED_LAYOUT_DEFAULTS.enableSplitLocators,
      smoothingRadius: 60,
      disconnectDistance: 0,
      enableBaseHole: false,
      baseHoleSize: "25",
    } as unknown as SteppedLayoutParams) as SteppedLayoutParams;

    expect(normalized.groups.map((group) => group.id)).toEqual([
      "low",
      "high",
      "mid",
    ]);
    expect(normalized.groups[0].splitPartGroupId).toBeUndefined();
    expect(normalized.groups[1].splitPartGroupId).toBeUndefined();
    expect(normalized.groups[2].splitPartGroupId).toBeUndefined();
    expect(normalized.slots[0]).toMatchObject({
      groupId: "low",
      slotDefinitionId: "circle-40",
      slotWidth: 40.4,
      slotHeight: 40.4,
    });
  });

  it("fills stepped base hole defaults and raises group height for magnetic holes", () => {
    const normalized = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      holeDepth: 4,
      baseHoleStructure: undefined,
      enableBaseHole: true,
      baseHoleSize: "25",
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "group-1",
          bottomHeight: 5,
        },
      ],
      activeGroupId: "group-1",
      slots: [
        {
          id: "slot-1",
          x: 100,
          y: 120,
          shape: "circle",
          width: 60,
          height: 60,
          rotation: 0,
          groupId: "group-1",
        },
      ],
    } as unknown as SteppedLayoutParams) as SteppedLayoutParams;

    expect(normalized.baseHoleSize).toBe("40");
    expect(normalized.baseHoleStructure).toBe("magnetic-base-hole");
    expect(normalized.enableBaseHole).toBeUndefined();
    expect(normalized.groups[0].bottomHeight).toBeCloseTo(
      4 + getBaseHoleMinBaseThickness("40"),
      5,
    );
  });

  it("fills and clamps stepped magnet post hole params while preserving a 1mm bottom wall", () => {
    const normalized = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      holeDepth: 3,
      baseHoleStructure: "magnet-post-hole",
      magnetPostHoleDiameter: 99,
      magnetPostHoleDepth: 4,
      groups: [{ ...STEPPED_LAYOUT_DEFAULTS.groups[0], bottomHeight: 5 }],
      slots: [{
        id: "ellipse-slot",
        x: 100,
        y: 100,
        shape: "ellipse",
        width: 40,
        height: 25,
        rotation: 0,
        groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
      }],
    } as SteppedLayoutParams) as SteppedLayoutParams;

    expect(normalized.magnetPostHoleDiameter).toBe(15);
    expect(normalized.magnetPostHoleDepth).toBe(3);
    expect(normalized.groups[0].bottomHeight).toBe(7);
  });

  it("resets stepped split groove depth to the default", () => {
    const normalized = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      splitGrooveDepth: 99,
    } as SteppedLayoutParams) as SteppedLayoutParams;

    expect(normalized.splitGrooveDepth).toBe(
      STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth,
    );

    const defaulted = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      splitGrooveDepth: undefined,
    } as unknown as SteppedLayoutParams) as SteppedLayoutParams;

    expect(defaulted.splitGrooveDepth).toBe(
      STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth,
    );
  });

  it("normalizes stepped split groove type", () => {
    const inset = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      enableSplitRecess: true,
      splitGrooveType: "inset",
    } as SteppedLayoutParams) as SteppedLayoutParams;
    const invalid = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      enableSplitRecess: true,
      splitGrooveType: "invalid",
    } as unknown as SteppedLayoutParams) as SteppedLayoutParams;

    expect(inset.splitGrooveType).toBe("inset");
    expect(invalid.splitGrooveType).toBe("profile");
  });

  it("旧自定义文件缺失 footprintStyle 时默认 rectangular 并保留显式 contoured", () => {
    const legacy = normalizeParamsForMode("custom", {
      trayWidth: 100,
      trayDepth: 100,
      slots: [],
      spacing: 5,
      boundarySpacing: 5,
      boundarySpacingIndependent: false,
      baseThickness: 3,
      holeDepth: 3,
      cornerRadius: 4,
      sideBevelWidth: 0,
    } as unknown as CustomLayoutParams) as CustomLayoutParams;
    expect(legacy.footprintStyle).toBe("rectangular");
    expect(legacy.smoothingRadius).toBe(60);
    expect(legacy.disconnectDistance).toBe(0);

    const explicitContoured = normalizeParamsForMode("custom", {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
    } as CustomLayoutParams) as CustomLayoutParams;
    expect(explicitContoured.footprintStyle).toBe("contoured");
  });

  it("旧阶梯文件缺失 footprintStyle 时默认 contoured 并补全 rectangular 专属字段", () => {
    const legacy = normalizeParamsForMode("stepped", {
      trayWidth: 100,
      trayDepth: 100,
      groups: [
        {
          id: "g1",
          name: "组 1",
          color: "#22c55e",
          bottomHeight: 10,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 60,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
        },
      ],
      slots: [],
      activeGroupId: "g1",
      spacing: 5,
      holeDepth: 3,
      smoothingRadius: 60,
      disconnectDistance: 0,
    } as unknown as SteppedLayoutParams) as SteppedLayoutParams;
    expect(legacy.footprintStyle).toBe("contoured");
    expect(legacy.boundarySpacing).toBe(5);
    expect(legacy.boundarySpacingIndependent).toBe(false);
    expect(legacy.traySizingMode).toBe("auto");
    expect(typeof legacy.cornerRadius).toBe("number");

    const explicitRect = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      footprintStyle: "rectangular",
      boundarySpacing: 8,
      boundarySpacingIndependent: true,
    } as SteppedLayoutParams) as SteppedLayoutParams;
    expect(explicitRect.footprintStyle).toBe("rectangular");
    expect(explicitRect.boundarySpacing).toBe(8);
  });

  it("阶梯未启用独立边界间距时 boundarySpacing 跟随 spacing", () => {
    const normalized = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      spacing: 7,
      boundarySpacing: 3,
      boundarySpacingIndependent: false,
    } as SteppedLayoutParams) as SteppedLayoutParams;
    expect(normalized.boundarySpacing).toBe(7);

    const independent = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      spacing: 7,
      boundarySpacing: 3,
      boundarySpacingIndependent: true,
    } as SteppedLayoutParams) as SteppedLayoutParams;
    expect(independent.boundarySpacing).toBe(3);
  });
});
