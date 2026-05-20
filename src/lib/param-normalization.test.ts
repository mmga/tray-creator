import { describe, expect, it } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import {
  migrateCustomParamsToStepped,
  normalizeParamsForMode,
} from "@/lib/param-normalization";
import type { CustomLayoutParams, SteppedLayoutParams } from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";

describe("param normalization", () => {
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
  });
});
