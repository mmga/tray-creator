import { describe, expect, it } from "vitest";
import { MAX_BUILD_SIZE } from "@/lib/config";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import {
  mapSimpleSteppedCanvasUpdatesToLocal,
  normalizeSimpleSteppedParams,
  resolveSimpleSteppedSlotMoveScope,
} from "@/lib/simple-stepped-projection";
import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";

function createParams(): SimpleSteppedLayoutParams {
  return {
    ...SIMPLE_STEPPED_LAYOUT_DEFAULTS,
    trayWidth: 100,
    trayDepth: 100,
    rowGap: 5,
    spacing: 5,
    outerMarginIndependent: false,
    outerMargin: 5,
    rows: [
      { id: "row-1", name: "前排", slotIds: ["slot-1", "slot-2"] },
      { id: "row-2", name: "后排", slotIds: ["slot-3"] },
    ],
    slots: [
      {
        id: "slot-1",
        rowId: "row-1",
        shape: "circle",
        diameter: 25,
        effectiveDiameter: 25.2,
        x: -15,
        y: 0,
      },
      {
        id: "slot-2",
        rowId: "row-1",
        shape: "circle",
        diameter: 25,
        effectiveDiameter: 25.2,
        x: 15,
        y: 0,
      },
      {
        id: "slot-3",
        rowId: "row-2",
        shape: "circle",
        diameter: 32,
        effectiveDiameter: 32.4,
        x: 0,
        y: 0,
      },
    ],
  };
}

describe("simple stepped projection", () => {
  it("maps canvas updates back to row-local slot updates", () => {
    const updates = mapSimpleSteppedCanvasUpdatesToLocal(createParams(), [
      { id: "slot-1", x: 40, y: 17.6 },
      { id: "slot-3", x: 50, y: 61.4 },
      { id: "missing", x: 1, y: 2 },
    ]);

    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ id: "slot-1", x: -10 });
    expect(updates[0]?.y).toBeCloseTo(0, 5);
    expect(updates[1]).toMatchObject({ id: "slot-3", x: 0 });
    expect(updates[1]?.y).toBeCloseTo(0, 5);
  });

  it("restricts drag scope to the dragging slot row", () => {
    const params = createParams();

    expect(
      resolveSimpleSteppedSlotMoveScope(params, "slot-1", [
        "slot-1",
        "slot-2",
        "slot-3",
      ]),
    ).toEqual(["slot-1", "slot-2"]);
    expect(resolveSimpleSteppedSlotMoveScope(params, "slot-1", ["slot-3"]))
      .toEqual(["slot-1"]);
    expect(resolveSimpleSteppedSlotMoveScope(params, "missing", ["slot-1"]))
      .toEqual([]);
  });

  it("normalizes row membership, outer margin, and slot snapshots", () => {
    const normalized = normalizeSimpleSteppedParams({
      ...createParams(),
      spacing: 7,
      outerMarginIndependent: false,
      outerMargin: 99,
      rows: [
        { id: "row-1", name: "前排", slotIds: ["stale"] },
        { id: "row-2", name: "后排", slotIds: [] },
      ],
      slots: [
        {
          id: "slot-1",
          rowId: "row-1",
          shape: "circle",
          diameter: 40,
          x: -15,
          y: Number.NaN,
        },
        {
          id: "slot-2",
          rowId: "row-2",
          shape: "circle",
          diameter: 100,
          slotDefinitionId: undefined,
          effectiveDiameter: undefined,
          x: 15,
          y: 2,
        },
      ],
    } as SimpleSteppedLayoutParams);

    expect(normalized.outerMargin).toBe(7);
    expect(normalized.rows[0].slotIds).toEqual(["slot-1"]);
    expect(normalized.rows[1].slotIds).toEqual(["slot-2"]);
    expect(normalized.slots[0]).toMatchObject({
      y: 0,
      slotDefinitionId: "circle-40",
      effectiveDiameter: 40.4,
    });
    expect(normalized.slots[1]).toMatchObject({
      slotDefinitionId: "circle-100",
      effectiveDiameter: 100.4,
    });
  });

  it("preserves independent outer margin while normalizing slots", () => {
    const normalized = normalizeSimpleSteppedParams({
      ...createParams(),
      spacing: 7,
      outerMarginIndependent: true,
      outerMargin: 12,
    });

    expect(normalized.outerMarginIndependent).toBe(true);
    expect(normalized.outerMargin).toBe(12);
  });

  it("allows content-required tray dimensions to exceed the build warning threshold", () => {
    const normalized = normalizeSimpleSteppedParams({
      ...createParams(),
      trayWidth: 100,
      trayDepth: 100,
      rows: [
        { id: "row-1", name: "超宽行", slotIds: ["slot-1", "slot-2"] },
      ],
      slots: [
        {
          id: "slot-1",
          rowId: "row-1",
          shape: "circle",
          diameter: 100,
          x: -MAX_BUILD_SIZE,
          y: 0,
        },
        {
          id: "slot-2",
          rowId: "row-1",
          shape: "circle",
          diameter: 100,
          x: MAX_BUILD_SIZE,
          y: 0,
        },
      ],
    } as SimpleSteppedLayoutParams);

    expect(normalized.trayWidth).toBeGreaterThan(MAX_BUILD_SIZE);
  });
});
