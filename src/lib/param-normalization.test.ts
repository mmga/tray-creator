import { describe, expect, it } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { getBaseHoleMinBaseThickness, MAX_BUILD_SIZE } from "@/lib/config";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
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
    } as CustomLayoutParams) as CustomLayoutParams;
    const simpleStepped = normalizeParamsForMode("simple-stepped", {
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
          groupId: STEPPED_LAYOUT_DEFAULTS.activeGroupId,
        },
      ],
    } as SteppedLayoutParams) as SteppedLayoutParams;

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

  it("normalizes grid params without requiring a param file wrapper", () => {
    const normalized = normalizeParamsForMode("grid", {
      ...DEFAULT_TRAY_PARAMS,
      rows: 2,
      columns: 2,
      holeDiameter: 32,
      slotDiameter: undefined,
      halfCircleSlots: true,
      basePlateOnly: undefined,
      enableBaseHole: undefined,
    } as unknown as TrayParams) as TrayParams;

    expect(normalized.halfCircleSlots).toBe(false);
    expect(normalized.basePlateOnly).toBe(false);
    expect(normalized.enableBaseHole).toBe(true);
    expect(normalized.slotDefinitionId).toBe("circle-32");
    expect(normalized.slotDiameter).toBeCloseTo(32.4, 5);
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
    expect(migrated.activeGroupId).toBe(migrated.groups[0].id);
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
    expect(migrated.enableBaseHole).toBe(customParams.enableBaseHole);
    expect(migrated.baseHoleSize).toBe("25");
  });

  it("normalizes simple stepped legacy rows before slot snapshots and derived size", () => {
    const normalized = normalizeParamsForMode("simple-stepped", {
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
    const normalized = normalizeParamsForMode("simple-stepped", {
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
    expect(normalized.activeGroupId).toBe(normalized.groups[0].id);
    expect(normalized.groups[0]).toMatchObject({
      bottomHeight: 8,
      groupSmoothingRadius: 25,
    });
    expect(normalized.groups[0].splitPartGroupId).toBeUndefined();
    expect(normalized.slots[0]).toMatchObject({
      shape: "circle",
      width: 40,
      height: 40,
      rotation: 315,
      groupId: normalized.groups[0].id,
      slotDefinitionId: "circle-40",
      slotWidth: 40.4,
      slotHeight: 40.4,
    });
    expect("bottomHeight" in normalized.slots[0]).toBe(false);
    expect("bridgeRadius" in (normalized as unknown as Record<string, unknown>)).toBe(
      false,
    );
    expect(normalized.trayWidth).toBe(50);
    expect(normalized.trayDepth).toBe(300);
    expect(normalized.spacing).toBe(2);
    expect(normalized.smoothingRadius).toBe(25);
    expect(normalized.splitGrooveDepth).toBe(
      STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth,
    );
    expect(normalized.splitGrooveType).toBe("profile");
  });

  it("clears stepped split part group targets during normalization", () => {
    const normalized = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      groups: [
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "low",
          name: "低组",
          bottomHeight: 10,
          splitPartGroupId: "high",
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "high",
          name: "高组",
          bottomHeight: 20,
          splitPartGroupId: "high",
        },
        {
          ...STEPPED_LAYOUT_DEFAULTS.groups[0],
          id: "mid",
          name: "中组",
          bottomHeight: 15,
          splitPartGroupId: "missing",
        },
      ],
      activeGroupId: "low",
    } as SteppedLayoutParams) as SteppedLayoutParams;

    expect(normalized.groups[0].splitPartGroupId).toBeUndefined();
    expect(normalized.groups[1].splitPartGroupId).toBeUndefined();
    expect(normalized.groups[2].splitPartGroupId).toBeUndefined();
  });

  it("fills stepped base hole defaults and raises group height for magnetic holes", () => {
    const normalized = normalizeParamsForMode("stepped", {
      ...STEPPED_LAYOUT_DEFAULTS,
      holeDepth: 4,
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
    } as SteppedLayoutParams) as SteppedLayoutParams;

    expect(normalized.baseHoleSize).toBe("40");
    expect(normalized.groups[0].bottomHeight).toBeCloseTo(
      4 + getBaseHoleMinBaseThickness("40"),
      5,
    );
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
});
