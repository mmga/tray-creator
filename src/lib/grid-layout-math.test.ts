import { describe, expect, it } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import {
  calculateGridBoxRequiredOuterSize,
  getGridBoxContentSize,
  validateGridBox,
} from "@/lib/grid-layout-math";

function boxParams() {
  return {
    ...DEFAULT_TRAY_PARAMS,
    rows: 2,
    columns: 3,
    spacing: 5,
    stackableBox: {
      ...DEFAULT_TRAY_PARAMS.stackableBox!,
      enabled: true,
      minimumWallClearance: 2,
    },
  };
}

describe("grid box layout math", () => {
  it("computes content size from final slot extents and pitch", () => {
    const params = boxParams();
    const { contentWidth, contentDepth } = getGridBoxContentSize(params);
    const slotWidth = params.slotDiameter!;
    const pitch = slotWidth + params.spacing;

    expect(contentWidth).toBeCloseTo(slotWidth + 2 * pitch, 5);
    expect(contentDepth).toBeCloseTo(slotWidth + 1 * pitch, 5);
  });

  it("computes the minimum outer size required to contain the grid", () => {
    const params = boxParams();
    const { contentWidth, contentDepth } = getGridBoxContentSize(params);
    const required = calculateGridBoxRequiredOuterSize(params);
    // usableInset = 4.0（承重边）+ 2.0（内壁间距）
    const usableInset = 6;
    const expectedWidth = Math.ceil((contentWidth + 2 * usableInset) * 10) / 10;
    const expectedDepth = Math.ceil((contentDepth + 2 * usableInset) * 10) / 10;

    expect(required.outerWidth).toBeCloseTo(expectedWidth, 5);
    expect(required.outerDepth).toBeCloseTo(expectedDepth, 5);
  });

  it("keeps rows and columns unchanged when sizing the box", () => {
    const params = boxParams();
    const required = calculateGridBoxRequiredOuterSize(params);
    expect(params.rows).toBe(2);
    expect(params.columns).toBe(3);
    expect(required.outerWidth).toBeGreaterThan(0);
    expect(required.outerDepth).toBeGreaterThan(0);
  });

  it("blocks the box when a grid slot enters the safety boundary", () => {
    const params = {
      ...boxParams(),
      stackableBox: {
        ...DEFAULT_TRAY_PARAMS.stackableBox!,
        enabled: true,
        outerWidth: 60,
        outerDepth: 60,
        minimumWallClearance: 2,
      },
    };
    const result = validateGridBox(params);
    expect(result.valid).toBe(false);
    expect(result.blockingReasons).toContainEqual(
      expect.objectContaining({ code: "slot-in-safety-boundary" }),
    );
  });

  it("passes the box when disabled", () => {
    expect(validateGridBox(DEFAULT_TRAY_PARAMS).valid).toBe(true);
  });

  it("blocks legacy half-circle slots when a box is enabled", () => {
    const result = validateGridBox({
      ...DEFAULT_TRAY_PARAMS,
      rows: 1,
      halfCircleSlots: true,
      stackableBox: {
        ...DEFAULT_TRAY_PARAMS.stackableBox!,
        enabled: true,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.blockingReasons).toContainEqual(
      expect.objectContaining({ code: "grid-half-circle-with-box" }),
    );
  });
});
