import { describe, expect, it } from "vitest";
import {
  STACKABLE_BOX_DEFAULTS,
  STACKABLE_BOX_LIMITS,
  STACKABLE_BOX_SPECS,
  calculateBoxGrooveWidth,
  calculateBoxHeightProjection,
  calculateBoxRequiredOuterSize,
  calculateBoxUsableArea,
  calculateBoxUsableOpening,
  createDefaultStackableBoxParams,
  isPointWithinRoundedRectangle,
  isPolygonWithinRoundedRectangle,
  resolveStackableBoxParams,
  roundBoxDimensionUp,
  validateBoxBaseGeometry,
} from "@/lib/stackable-box";

function enabledBox(overrides: Partial<Parameters<typeof resolveStackableBoxParams>[0] & object> = {}) {
  return resolveStackableBoxParams({
    ...STACKABLE_BOX_DEFAULTS,
    enabled: true,
    ...overrides,
  });
}

describe("stackable-box resolver", () => {
  it("returns defaults for a missing snapshot", () => {
    expect(resolveStackableBoxParams(undefined)).toEqual({
      enabled: false,
      outerWidth: 100,
      outerDepth: 100,
      outerHeight: 50,
      minimumWallClearance: 2,
      xyFitClearance: 0.25,
      lidThickness: 2.4,
    });
  });

  it("preserves an enabled flag and clamps out-of-range numeric fields", () => {
    const resolved = resolveStackableBoxParams({
      enabled: true,
      outerWidth: 5,
      outerDepth: 99999,
      outerHeight: -10,
      minimumWallClearance: 500,
      xyFitClearance: 0,
      lidThickness: 99,
    });

    expect(resolved.enabled).toBe(true);
    expect(resolved.outerWidth).toBe(STACKABLE_BOX_LIMITS.outerWidth.min);
    expect(resolved.outerDepth).toBe(STACKABLE_BOX_LIMITS.outerDepth.max);
    expect(resolved.outerHeight).toBe(STACKABLE_BOX_LIMITS.outerHeight.min);
    expect(resolved.minimumWallClearance).toBe(
      STACKABLE_BOX_LIMITS.minimumWallClearance.max,
    );
    expect(resolved.xyFitClearance).toBe(STACKABLE_BOX_LIMITS.xyFitClearance.min);
    expect(resolved.lidThickness).toBe(STACKABLE_BOX_LIMITS.lidThickness.max);
  });

  it("fills missing numeric fields with defaults even when disabled", () => {
    const resolved = resolveStackableBoxParams({
      enabled: false,
      outerWidth: undefined as unknown as number,
      outerDepth: undefined as unknown as number,
      outerHeight: undefined as unknown as number,
      minimumWallClearance: undefined as unknown as number,
      xyFitClearance: undefined as unknown as number,
      lidThickness: undefined as unknown as number,
    });
    expect(resolved).toEqual(STACKABLE_BOX_DEFAULTS);
  });

  it("creates an independent default copy", () => {
    const first = createDefaultStackableBoxParams();
    first.outerHeight = 123;
    expect(createDefaultStackableBoxParams().outerHeight).toBe(
      STACKABLE_BOX_DEFAULTS.outerHeight,
    );
  });
});

describe("stackable-box usable opening", () => {
  it("derives the usable opening from the top rim and wall clearance", () => {
    const opening = calculateBoxUsableOpening(enabledBox());
    expect(opening.usableInset).toBe(
      STACKABLE_BOX_SPECS.topRimWidth + STACKABLE_BOX_DEFAULTS.minimumWallClearance,
    );
    expect(opening.usableWidth).toBe(100 - 2 * 8);
    expect(opening.usableDepth).toBe(100 - 2 * 8);
    expect(opening.usableCornerRadius).toBe(0);
  });

  it("keeps a positive corner radius when the outer corner exceeds the inset", () => {
    const box = enabledBox({ minimumWallClearance: 0 });
    const opening = calculateBoxUsableOpening(box);
    expect(opening.usableInset).toBe(STACKABLE_BOX_SPECS.topRimWidth);
    expect(opening.usableCornerRadius).toBe(
      STACKABLE_BOX_SPECS.outerCornerRadius - STACKABLE_BOX_SPECS.topRimWidth,
    );
  });

  it("returns the usable area in box coordinates", () => {
    const area = calculateBoxUsableArea(enabledBox());
    expect(area).toEqual({ x: 8, y: 8, width: 84, depth: 84, cornerRadius: 0 });
  });
});

describe("stackable-box height projection", () => {
  it("computes heights for a regular tray", () => {
    const projection = calculateBoxHeightProjection(enabledBox(), 3, 3);
    expect(projection).toEqual({
      slotFloorZ: 3,
      trayTopZ: 6,
      minimumOuterHeight: 8.4,
      lidClearHeight: 47,
      stackClearHeight: 45.8,
      closedOuterHeight: 52.4,
    });
  });

  it("computes heights for a base-plate-only tray", () => {
    const projection = calculateBoxHeightProjection(enabledBox(), 3, 3, true);
    expect(projection.trayTopZ).toBe(3);
    expect(projection.minimumOuterHeight).toBe(
      3 + STACKABLE_BOX_SPECS.minWallRise,
    );
  });
});

describe("stackable-box required outer size", () => {
  it("rounds up to 0.1 mm and applies both insets", () => {
    expect(roundBoxDimensionUp(12.31)).toBe(12.4);
    expect(roundBoxDimensionUp(12.3)).toBe(12.3);

    const required = calculateBoxRequiredOuterSize(50, 50, enabledBox());
    expect(required).toEqual({ outerWidth: 66, outerDepth: 66 });
  });
});

describe("stackable-box rounded rectangle containment", () => {
  const area = { x: 0, y: 0, width: 20, depth: 20, cornerRadius: 0 };

  it("accepts points inside and rejects points outside", () => {
    expect(isPointWithinRoundedRectangle(10, 10, area)).toBe(true);
    expect(isPointWithinRoundedRectangle(0, 0, area)).toBe(true);
    expect(isPointWithinRoundedRectangle(21, 10, area)).toBe(false);
    expect(isPointWithinRoundedRectangle(10, -1, area)).toBe(false);
  });

  it("rejects corners outside a rounded area", () => {
    const rounded = { x: 0, y: 0, width: 20, depth: 20, cornerRadius: 5 };
    expect(isPointWithinRoundedRectangle(0, 0, rounded)).toBe(false);
    expect(isPointWithinRoundedRectangle(10, 10, rounded)).toBe(true);
  });

  it("checks every polygon point", () => {
    expect(
      isPolygonWithinRoundedRectangle(
        [
          { x: 5, y: 5 },
          { x: 15, y: 5 },
        ],
        area,
      ),
    ).toBe(true);
    expect(
      isPolygonWithinRoundedRectangle(
        [
          { x: 5, y: 5 },
          { x: 25, y: 5 },
        ],
        area,
      ),
    ).toBe(false);
  });
});

describe("stackable-box base geometry validation", () => {
  it("accepts a default enabled box with no warnings", () => {
    const result = validateBoxBaseGeometry(enabledBox(), 3, 3);
    expect(result.valid).toBe(true);
    expect(result.blockingReasons).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("blocks outer dimensions that cannot fit the fixed corner and rim", () => {
    const result = validateBoxBaseGeometry(
      enabledBox({ outerWidth: 30, minimumWallClearance: 20 }),
      3,
      3,
    );
    expect(result.valid).toBe(false);
    expect(result.blockingReasons).toContainEqual(
      expect.objectContaining({ code: "outer-dimensions-insufficient" }),
    );
  });

  it("blocks an outer height below the dynamic structural floor", () => {
    const result = validateBoxBaseGeometry(enabledBox({ outerHeight: 8 }), 3, 3);
    expect(result.valid).toBe(false);
    expect(result.blockingReasons).toContainEqual(
      expect.objectContaining({ code: "outer-height-below-minimum" }),
    );
  });

  it("warns on a shallow box and oversized axes without blocking", () => {
    const shallow = validateBoxBaseGeometry(enabledBox({ outerHeight: 8.5 }), 3, 3);
    expect(shallow.warnings).toContainEqual(
      expect.objectContaining({ code: "shallow-box" }),
    );

    const oversized = validateBoxBaseGeometry(
      enabledBox({ outerWidth: 300 }),
      3,
      3,
    );
    expect(oversized.valid).toBe(true);
    expect(oversized.warnings).toContainEqual(
      expect.objectContaining({ code: "oversized-axis" }),
    );
  });
});

describe("stackable-box groove width", () => {
  it("is flange width plus two fit clearances", () => {
    expect(calculateBoxGrooveWidth(enabledBox())).toBe(1.2 + 2 * 0.25);
  });
});
