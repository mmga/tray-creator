import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAY_PARAMS,
  OLD_WORLD_RECTANGULAR_PRESETS,
  createOldWorldGridSlotSnapshot,
} from "@/lib/grid-config";
import {
  normalizeGridParams,
  replaceGridParams,
  resetGridParams,
  selectGridSlotDefinition,
  updateGridParam,
} from "@/lib/grid-model-state";

describe("grid model state", () => {
  it("exposes all official Old World rectangular base presets with 0.2mm clearance per side", () => {
    expect(
      OLD_WORLD_RECTANGULAR_PRESETS.map(({ width, height }) =>
        `${width}x${height}`,
      ),
    ).toEqual([
      "25x25",
      "25x50",
      "30x30",
      "30x60",
      "40x40",
      "40x60",
      "50x50",
      "50x75",
      "50x100",
      "60x100",
      "100x150",
    ]);

    for (const preset of OLD_WORLD_RECTANGULAR_PRESETS) {
      expect(createOldWorldGridSlotSnapshot(preset)).toMatchObject({
        slotWidth: preset.width + 0.4,
        slotHeight: preset.height + 0.4,
      });
    }
  });

  it("normalizes boundary spacing when it follows spacing", () => {
    expect(
      normalizeGridParams({
        ...DEFAULT_TRAY_PARAMS,
        spacing: 8,
        boundarySpacing: 2,
        boundarySpacingIndependent: false,
      }),
    ).toMatchObject({
      spacing: 8,
      boundarySpacing: 8,
    });
  });

  it("preserves independent boundary spacing", () => {
    expect(
      replaceGridParams({
        ...DEFAULT_TRAY_PARAMS,
        spacing: 8,
        boundarySpacing: 12,
        boundarySpacingIndependent: true,
      }),
    ).toMatchObject({
      spacing: 8,
      boundarySpacing: 12,
    });
  });

  it("updates params and resets to normalized defaults", () => {
    expect(
      updateGridParam(DEFAULT_TRAY_PARAMS, "spacing", 7),
    ).toMatchObject({
      spacing: 7,
      boundarySpacing: 7,
    });

    expect(resetGridParams()).toMatchObject({
      ...DEFAULT_TRAY_PARAMS,
      boundarySpacing: DEFAULT_TRAY_PARAMS.spacing,
    });
    expect(resetGridParams().enableBaseHole).toBeUndefined();
  });

  it("selects Old World rectangular presets without resetting grid parameters", () => {
    const selected = selectGridSlotDefinition(
      {
        ...DEFAULT_TRAY_PARAMS,
        rows: 3,
        columns: 4,
        spacing: 7,
        boundarySpacingIndependent: true,
        boundarySpacing: 9,
        halfCircleSlots: true,
      },
      "old-world-30x60",
    );

    expect(selected).toMatchObject({
      rows: 3,
      columns: 4,
      spacing: 7,
      boundarySpacing: 9,
      slotShape: "rectangle",
      slotDefinitionId: "old-world-30x60",
      slotBaseWidth: 30,
      slotBaseHeight: 60,
      slotWidth: 30.4,
      slotHeight: 60.4,
      holeDiameter: 30,
      halfCircleSlots: false,
      baseHoleSize: "25",
    });

    expect(
      selectGridSlotDefinition(DEFAULT_TRAY_PARAMS, "old-world-50x75")
        .baseHoleSize,
    ).toBe("40");
    expect(
      selectGridSlotDefinition(DEFAULT_TRAY_PARAMS, "old-world-25x50")
        .baseHoleSize,
    ).toBe("20");
  });

  it("keeps legacy grid params circular when no rectangular shape is specified", () => {
    const normalized = normalizeGridParams({
      ...DEFAULT_TRAY_PARAMS,
      slotShape: undefined,
      slotDefinitionId: undefined,
      holeDiameter: 32,
      slotDiameter: undefined,
    });

    expect(normalized).toMatchObject({
      slotShape: "circle",
      slotDefinitionId: "circle-32",
      slotDiameter: 32.4,
    });
  });

  it("only preserves half-circle slots for single-axis grids", () => {
    expect(
      normalizeGridParams({
        ...DEFAULT_TRAY_PARAMS,
        rows: 1,
        halfCircleSlots: true,
      }),
    ).toMatchObject({
      rows: 1,
      halfCircleSlots: true,
    });

    expect(
      normalizeGridParams({
        ...DEFAULT_TRAY_PARAMS,
        rows: 3,
        columns: 1,
        halfCircleSlots: true,
      }),
    ).toMatchObject({
      rows: 3,
      columns: 1,
      halfCircleSlots: true,
    });

    expect(
      normalizeGridParams({
        ...DEFAULT_TRAY_PARAMS,
        rows: 2,
        columns: 2,
        halfCircleSlots: true,
      }),
    ).toMatchObject({
      rows: 2,
      columns: 2,
      halfCircleSlots: false,
    });

    expect(updateGridParam(DEFAULT_TRAY_PARAMS, "rows", 2)).toMatchObject({
      rows: 2,
      halfCircleSlots: false,
    });
  });

  it("keeps structure modes mutually exclusive and forces base holes for base plates", () => {
    expect(
      normalizeGridParams({
        ...DEFAULT_TRAY_PARAMS,
        basePlateOnly: true,
        halfCircleSlots: true,
        enableBaseHole: false,
      }),
    ).toMatchObject({
      basePlateOnly: true,
      halfCircleSlots: false,
      baseHoleStructure: "magnetic-base-hole",
    });

    expect(
      updateGridParam(
        {
          ...DEFAULT_TRAY_PARAMS,
          rows: 1,
          basePlateOnly: true,
          halfCircleSlots: false,
        },
        "halfCircleSlots",
        true,
      ),
    ).toMatchObject({
      basePlateOnly: false,
      halfCircleSlots: true,
    });

    expect(
      updateGridParam(
        {
          ...DEFAULT_TRAY_PARAMS,
          rows: 1,
          basePlateOnly: false,
          halfCircleSlots: true,
          enableBaseHole: false,
        },
        "basePlateOnly",
        true,
      ),
    ).toMatchObject({
      basePlateOnly: true,
      halfCircleSlots: false,
      baseHoleStructure: "magnetic-base-hole",
    });
  });
});
