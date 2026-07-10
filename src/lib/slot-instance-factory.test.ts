import { describe, expect, it } from "vitest";
import {
  createFreeSlotInstance,
  createGridSlotSnapshotFromDefinition,
  createSimpleSteppedSlotInstance,
  createSteppedSlotInstance,
  normalizeFreeSlotInstanceSnapshot,
  normalizeSimpleSteppedSlotInstanceSnapshot,
} from "@/lib/slot-instance-factory";

describe("slot instance factory", () => {
  it("creates grid snapshots from shared slot definitions", () => {
    expect(createGridSlotSnapshotFromDefinition(40)).toEqual({
      slotDefinitionId: "circle-40",
      slotDiameter: 40.4,
    });
    expect(createGridSlotSnapshotFromDefinition(100)).toEqual({
      slotDefinitionId: "circle-100",
      slotDiameter: 100.4,
    });
  });

  it("creates free circle and ellipse slot instances with geometry snapshots", () => {
    expect(
      createFreeSlotInstance({
        id: "circle-1",
        x: 20,
        y: 30,
        width: 32,
      }),
    ).toMatchObject({
      id: "circle-1",
      shape: "circle",
      width: 32,
      height: 32,
      slotDefinitionId: "circle-32",
      slotWidth: 32.4,
      slotHeight: 32.4,
      rotation: 0,
    });

    const customCircle = createFreeSlotInstance({
      id: "custom-circle-1",
      x: 20,
      y: 30,
      width: 13.5,
      circleConfig: { applyTolerance: false },
    });
    expect(customCircle).toMatchObject({
      shape: "circle",
      width: 13.5,
      height: 13.5,
      slotWidth: 13.5,
      slotHeight: 13.5,
    });
    expect(customCircle.slotDefinitionId).toBeUndefined();

    expect(
      createFreeSlotInstance({
        id: "ellipse-1",
        x: 20,
        y: 30,
        width: 75,
        height: 43.2,
        ellipseConfig: {
          outerOffset: 0.6,
          profileExponent: 2.08,
        },
      }),
    ).toMatchObject({
      id: "ellipse-1",
      shape: "ellipse",
      width: 75,
      height: 43.2,
      slotDefinitionId: "ellipse-75x43.2",
      outerOffset: 0.6,
      profileExponent: 2.08,
      rotation: 0,
    });
  });

  it("creates stepped and simple stepped slot instances with mode metadata", () => {
    expect(
      createSteppedSlotInstance({
        id: "stepped-1",
        x: 10,
        y: 20,
        width: 25,
        groupId: "group-1",
      }),
    ).toMatchObject({
      id: "stepped-1",
      shape: "circle",
      width: 25,
      height: 25,
      groupId: "group-1",
      slotDefinitionId: "circle-25",
      slotWidth: 25.2,
      slotHeight: 25.2,
    });

    expect(
      createSimpleSteppedSlotInstance({
        id: "simple-1",
        rowId: "row-1",
        diameter: 25,
        x: 5,
      }),
    ).toEqual({
      id: "simple-1",
      rowId: "row-1",
      shape: "circle",
      diameter: 25,
      slotDefinitionId: "circle-25",
      effectiveDiameter: 25.2,
      x: 5,
      y: 0,
    });
  });

  it("normalizes legacy slot snapshots conservatively", () => {
    expect(
      normalizeFreeSlotInstanceSnapshot({
        id: "legacy-circle",
        x: 0,
        y: 0,
        shape: "circle",
        width: 40,
        height: 40,
        rotation: -90,
      }),
    ).toMatchObject({
      slotDefinitionId: "circle-40",
      slotWidth: 40.4,
      slotHeight: 40.4,
      rotation: 270,
    });

    expect(
      normalizeFreeSlotInstanceSnapshot({
        id: "custom-circle",
        x: 0,
        y: 0,
        shape: "circle",
        width: 13.5,
        height: 13.5,
        slotWidth: 13.5,
        slotHeight: 13.5,
        rotation: 0,
      }),
    ).toMatchObject({
      slotWidth: 13.5,
      slotHeight: 13.5,
    });

    expect(
      normalizeSimpleSteppedSlotInstanceSnapshot({
        id: "legacy-simple",
        rowId: "row-1",
        shape: "circle",
        diameter: 32,
        x: 0,
        y: Number.NaN,
      }),
    ).toMatchObject({
      slotDefinitionId: "circle-32",
      effectiveDiameter: 32.4,
      y: 0,
    });
  });
});
