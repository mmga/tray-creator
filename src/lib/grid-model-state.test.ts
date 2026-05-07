import { describe, expect, it } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import {
  normalizeGridParams,
  replaceGridParams,
  resetGridParams,
  updateGridParam,
} from "@/lib/grid-model-state";

describe("grid model state", () => {
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

    expect(resetGridParams()).toEqual({
      ...DEFAULT_TRAY_PARAMS,
      boundarySpacing: DEFAULT_TRAY_PARAMS.spacing,
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
});
