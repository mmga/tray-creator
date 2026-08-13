import { describe, expect, it } from "vitest";
import {
  createBaseHoleConstructionPlan,
  getRequiredBaseHoleSupportingThickness,
  type BaseHoleProjectedSlot,
} from "@/lib/base-hole-construction-plan";
import type { BaseHoleParams } from "@/types/tray";

function params(overrides: Partial<BaseHoleParams> = {}): BaseHoleParams {
  return {
    baseHoleStructure: "magnetic-base-hole",
    baseHoleSize: "25",
    magnetPostHoleDiameter: 5,
    magnetPostHoleDepth: 2,
    ...overrides,
  };
}

function slot(overrides: Partial<BaseHoleProjectedSlot> = {}): BaseHoleProjectedSlot {
  return {
    id: "slot-1",
    shape: "circle",
    nominalWidth: 32,
    nominalHeight: 32,
    finalWidth: 32.4,
    finalHeight: 32.4,
    x: 10,
    y: 20,
    floorHeight: 3,
    containsExpandedHole: () => true,
    ...overrides,
  };
}

describe("Base-hole Construction Plan", () => {
  it("为每个投影槽位生成不可变语义的磁吸孔切割指令", () => {
    const plan = createBaseHoleConstructionPlan(params(), [
      slot(),
      slot({ id: "slot-2", nominalWidth: 60, nominalHeight: 60, x: 60 }),
    ]);

    expect(plan).toMatchObject({
      structure: "magnetic-base-hole",
      supportingThickness: 2.4,
      resolvedMagneticPresets: ["25", "40"],
      blocked: false,
    });
    expect(plan.instructions).toMatchObject([
      { kind: "magnetic-base-hole", slotId: "slot-1", preset: "25", top: 2.4, bottom: 1.2 },
      { kind: "magnetic-base-hole", slotId: "slot-2", preset: "40", top: 2.4, bottom: 1 },
    ]);
  });

  it("保留全部违规和切割指令，但把计划标记为阻断", () => {
    const plan = createBaseHoleConstructionPlan(params(), [
      slot({ containsExpandedHole: () => false }),
      slot({ id: "slot-2", x: 20, containsExpandedHole: () => false }),
    ]);

    expect(plan.instructions).toHaveLength(2);
    expect(plan.violations.map((violation) => violation.slotIds)).toEqual([
      ["slot-1"],
      ["slot-2"],
      ["slot-1", "slot-2"],
    ]);
    expect(plan.blocked).toBe(true);
  });

  it("磁铁桩孔使用显式尺寸并从 Slot Floor 向下延伸", () => {
    const plan = createBaseHoleConstructionPlan(params({
      baseHoleStructure: "magnet-post-hole",
      magnetPostHoleDiameter: 6,
      magnetPostHoleDepth: 2.5,
    }), [slot({ floorHeight: 4 })]);

    expect(plan.supportingThickness).toBe(3.5);
    expect(plan.instructions).toEqual([{
      kind: "magnet-post-hole",
      slotId: "slot-1",
      x: 10,
      y: 20,
      floorHeight: 4,
      diameter: 6,
      depth: 2.5,
      bottom: 1.5,
      top: 4,
    }]);
  });

  it("无孔结构不生成指令，并由 Module 统一给出支撑厚度", () => {
    expect(createBaseHoleConstructionPlan(params({ baseHoleStructure: "none" }), [slot()]))
      .toMatchObject({ instructions: [], violations: [], blocked: false });
    expect(getRequiredBaseHoleSupportingThickness(params({
      baseHoleStructure: "magnet-post-hole",
      magnetPostHoleDepth: 3,
    }))).toBe(4);
  });
});
