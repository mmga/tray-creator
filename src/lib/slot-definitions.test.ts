import { describe, expect, it } from "vitest";
import {
  CIRCLE_SLOT_DEFINITIONS,
  ELLIPSE_SLOT_DEFINITIONS,
  createCircleSlotSnapshot,
  findCircleSlotDefinitionByBaseDiameter,
  findEllipseSlotDefinitionByGeometry,
} from "@/lib/slot-definitions";

describe("slot definitions", () => {
  it("stores circular final slot sizes in the shared definitions", () => {
    expect(findCircleSlotDefinitionByBaseDiameter(10)).toMatchObject({
      id: "circle-10",
      baseDiameter: 10,
      slotDiameter: 10.4,
      tolerance: 0.4,
    });
    expect(findCircleSlotDefinitionByBaseDiameter(25)).toMatchObject({
      id: "circle-25",
      baseDiameter: 25,
      slotDiameter: 25.4,
      tolerance: 0.4,
    });
    expect(findCircleSlotDefinitionByBaseDiameter(40)).toMatchObject({
      id: "circle-40",
      baseDiameter: 40,
      slotDiameter: 40.4,
      tolerance: 0.4,
    });
    expect(findCircleSlotDefinitionByBaseDiameter(100)).toMatchObject({
      id: "circle-100",
      name: "100mm 圆形",
      baseDiameter: 100,
      slotDiameter: 100.4,
      tolerance: 0.4,
    });
    expect(CIRCLE_SLOT_DEFINITIONS.map((definition) => definition.baseDiameter))
      .toEqual([10, 25, 28.5, 32, 40, 50, 60, 65, 90, 100]);
  });

  it("creates circular snapshots from shared definitions", () => {
    expect(createCircleSlotSnapshot(10)).toEqual({
      slotDefinitionId: "circle-10",
      slotWidth: 10.4,
      slotHeight: 10.4,
    });
    expect(createCircleSlotSnapshot(32)).toEqual({
      slotDefinitionId: "circle-32",
      slotWidth: 32.4,
      slotHeight: 32.4,
    });
    expect(createCircleSlotSnapshot(100)).toEqual({
      slotDefinitionId: "circle-100",
      slotWidth: 100.4,
      slotHeight: 100.4,
    });
  });

  it("stores ellipse naming and shape parameters in the shared definitions", () => {
    expect(ELLIPSE_SLOT_DEFINITIONS[1]).toMatchObject({
      id: "ellipse-75x42",
      name: "75x42mm",
      width: 75,
      height: 43.2,
      outerOffset: 0.6,
      profileExponent: 2.08,
    });
    expect(
      findEllipseSlotDefinitionByGeometry({
        width: 75,
        height: 43.2,
        outerOffset: 0.6,
        profileExponent: 2.08,
      })?.id,
    ).toBe("ellipse-75x42");
  });
});
