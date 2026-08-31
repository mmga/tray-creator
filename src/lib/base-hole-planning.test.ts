import { describe, expect, it } from "vitest";
import {
  applyFlatTrayBaseHoleSupportingThickness,
  createCustomBaseHoleConstructionPlan,
  createGridBaseHoleConstructionPlan,
  createSteppedBaseHoleConstructionPlan,
} from "@/lib/base-hole-planning";
import { getRequiredBaseHoleSupportingThickness } from "@/lib/base-hole-construction-plan";
import { resolveMagneticBaseHolePreset } from "@/lib/base-hole-config";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { customContouredStateForTest } from "@/test/contoured-state";
import type { CustomLayoutParams, SteppedLayoutParams } from "@/types/custom-tray";

describe("Base-hole Construction Plan Interface", () => {
  it("按圆形直径或非圆形短边匹配磁吸孔", () => {
    expect(resolveMagneticBaseHolePreset("circle", 25, 25)).toBe("20");
    expect(resolveMagneticBaseHolePreset("circle", 25, 25, "25")).toBe("25");
    expect(resolveMagneticBaseHolePreset("rectangle", 25, 50)).toBe("20");
    expect(resolveMagneticBaseHolePreset("rectangle", 25, 50, "25")).toBe("25");
    expect(resolveMagneticBaseHolePreset("circle", 32, 32)).toBe("25");
    expect(resolveMagneticBaseHolePreset("circle", 59, 59)).toBe("25");
    expect(resolveMagneticBaseHolePreset("circle", 60, 60)).toBe("40");
    expect(resolveMagneticBaseHolePreset("ellipse", 60, 35)).toBe("25");
    expect(resolveMagneticBaseHolePreset("ellipse", 75, 42)).toBe("40");
    expect(resolveMagneticBaseHolePreset("rectangle", 40, 100)).toBe("25");
    expect(resolveMagneticBaseHolePreset("rectangle", 50, 75)).toBe("40");
  });

  it("返回同一托盘逐槽位匹配后的混合磁吸孔规格", () => {
    expect(createCustomBaseHoleConstructionPlan({
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseHoleStructure: "magnetic-base-hole",
      slots: [
        { id: "small", x: 30, y: 30, shape: "circle", width: 25, height: 25, rotation: 0 },
        { id: "large", x: 90, y: 30, shape: "ellipse", width: 75, height: 42, rotation: 0 },
      ],
    }).resolvedMagneticPresets).toEqual(["20", "40"]);

    expect(createCustomBaseHoleConstructionPlan({
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseHoleStructure: "magnetic-base-hole",
      smallBaseHoleSize: "25",
      slots: [
        { id: "small", x: 30, y: 30, shape: "circle", width: 25, height: 25, rotation: 0 },
      ],
    }).instructions).toMatchObject([{ preset: "25", diameter: 25.2 }]);
  });

  it("计算两种孔位结构的最小承载厚度", () => {
    expect(getRequiredBaseHoleSupportingThickness({
      baseHoleStructure: "magnetic-base-hole",
      magnetPostHoleDepth: 2,
    })).toBe(2.4);
    expect(getRequiredBaseHoleSupportingThickness({
      baseHoleStructure: "magnet-post-hole",
      magnetPostHoleDepth: 3,
    })).toBe(4);
  });

  it("未启用底孔时在进入 Mode 槽位 Adapter 前返回", () => {
    let slotsReadCount = 0;
    const params = new Proxy(
      {
        ...STEPPED_LAYOUT_DEFAULTS,
        baseHoleStructure: "none" as const,
      },
      {
        get(target, property, receiver) {
          if (property === "slots") {
            slotsReadCount += 1;
            throw new Error("无底孔校验不应读取槽位");
          }
          return Reflect.get(target, property, receiver);
        },
      },
    ) as SteppedLayoutParams;

    expect(createSteppedBaseHoleConstructionPlan(params).violations).toEqual([]);
    expect(slotsReadCount).toBe(0);
  });

  it("按孔位结构自动提高平底和简易阶梯承载厚度", () => {
    expect(applyFlatTrayBaseHoleSupportingThickness({
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseThickness: 1,
      baseHoleStructure: "magnet-post-hole",
      magnetPostHoleDepth: 3,
    }).baseThickness).toBe(4);
  });

  it("报告磁铁桩孔大于槽位最短成品尺寸", () => {
    const smallParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      baseHoleStructure: "magnet-post-hole",
      magnetPostHoleDiameter: 15,
      slots: [{
        id: "small-slot",
        x: 50,
        y: 50,
        shape: "ellipse",
        width: 20,
        height: 10,
        slotWidth: 20.4,
        slotHeight: 10.4,
        rotation: 0,
      }],
    };
    const violations = createCustomBaseHoleConstructionPlan(
      smallParams as CustomLayoutParams,
    ).violations;
    expect(violations).toMatchObject([
      { kind: "magnet-post-hole-fit", slotIds: ["small-slot"] },
    ]);
  });

  it("报告贴近外壁和间距不足的磁吸孔", () => {
    const edge = createCustomBaseHoleConstructionPlan({
      ...CUSTOM_LAYOUT_DEFAULTS,
      traySizingMode: "fixed",
      trayWidth: 40,
      trayDepth: 40,
      baseHoleStructure: "magnetic-base-hole",
      slots: [{ id: "edge", x: 10, y: 20, shape: "circle", width: 25, height: 25, rotation: 0 }],
    }).violations;
    expect(edge.some((item) => item.slotIds.includes("edge"))).toBe(true);

    const adjacent = createGridBaseHoleConstructionPlan({
      ...DEFAULT_TRAY_PARAMS,
      rows: 1,
      columns: 2,
      holeDiameter: 20,
      slotDiameter: 20.4,
      spacing: 5,
      spacingX: 5,
      spacingY: 5,
      boundarySpacing: 13,
      boundarySpacingIndependent: true,
      baseHoleStructure: "magnetic-base-hole",
    }).violations;
    expect(adjacent.some((item) => item.slotIds.length === 2)).toBe(true);
  });

  it("contoured footprint 按各自外缘评估磁吸孔边缘", () => {
    // 一个远离其它槽的槽位：contoured footprint 会在它周围形成独立的小实体，
    // 磁吸孔半径加 0.6mm 侧壁要求，对小槽位应触发不适配
    const contouredSmallParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
      baseHoleStructure: "magnetic-base-hole",
      slots: [
        { id: "small", x: 0, y: 0, shape: "circle", width: 10, height: 10, rotation: 0 },
      ],
    } satisfies CustomLayoutParams;
    const violations = createCustomBaseHoleConstructionPlan(
      contouredSmallParams,
      { contouredState: customContouredStateForTest(contouredSmallParams) },
    ).violations;
    expect(violations.some((item) => item.slotIds.includes("small"))).toBe(true);

    // 较大槽位在 contoured 下应能容纳对应磁吸孔
    const largeParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
      baseHoleStructure: "magnetic-base-hole",
      slots: [
        { id: "large", x: 0, y: 0, shape: "circle", width: 40, height: 40, rotation: 0 },
      ],
    } satisfies CustomLayoutParams;
    const ok = createCustomBaseHoleConstructionPlan(
      largeParams,
      { contouredState: customContouredStateForTest(largeParams) },
    ).violations;
    expect(ok.some((item) => item.slotIds.includes("large"))).toBe(false);
  });
});
