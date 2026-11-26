import { describe, expect, it } from "vitest";
import {
  copyStorageSteppedTrayConfig,
  createDefaultStorageSteppedParams,
  getStorageSteppedTray,
  withStorageSteppedHeightSpec,
} from "@/lib/storage-stepped-config";
import {
  deriveStorageSteppedPlan,
  deriveStorageSteppedTraySize,
  getStorageSteppedPartBlockingReason,
  validateStorageSteppedParams,
} from "@/lib/storage-stepped-plan";
import type { StorageSteppedParams } from "@/types/storage-stepped";
import { createFreeSlotInstance } from "@/lib/slot-instance-factory";

function withMagnetPostHole(
  params: StorageSteppedParams,
  stepIndex: number,
  depth: number,
): StorageSteppedParams {
  return {
    ...params,
    trays: params.trays.map((tray) =>
      tray.stepIndex === stepIndex
        ? { ...tray, baseHoleStructure: "magnet-post-hole", magnetPostHoleDepth: depth }
        : tray,
    ),
  };
}

describe("Storage Stepped 尺寸推导", () => {
  it("标准高度 30/70/110 的全部派生尺寸符合规格", () => {
    const params = createDefaultStorageSteppedParams("standard");
    const plan = deriveStorageSteppedPlan(params);

    expect(plan.bodyWidth).toBe(240);
    expect(plan.bodyDepth).toBe(240);
    expect(plan.totalHeight).toBe(110);
    expect(plan.trayWidth).toBeCloseTo(235.4, 10);
    expect(plan.trayDepth).toBeCloseTo(75.4, 10);
    expect(plan.trayThickness).toBe(6);
    expect(plan.supportLedgeWidth).toBe(2);
    expect(plan.supportContactCentered).toBeCloseTo(1.7, 10);
    expect(plan.supportContactShifted).toBeCloseTo(1.4, 10);
    expect(plan.fingerPullRadius).toBe(16);

    expect(plan.steps.map((step) => step.deckHeight)).toEqual([30, 70, 110]);
    expect(plan.steps.map((step) => step.clearHeight)).toEqual([21.6, 61.6, 101.6]);
    expect(plan.steps.map((step) => step.dividerWallToNext)).toEqual([8, 8, 0]);

    const [first] = plan.steps;
    expect(first.cavity.minX).toBe(4);
    expect(first.cavity.maxX).toBe(236);
    expect(first.cavity.minY).toBe(4);
    expect(first.cavity.maxY).toBe(76);
    expect(first.cavity.minZ).toBeCloseTo(2.4, 10);
    expect(first.cavity.maxZ).toBe(24);
    expect(first.opening.minX).toBe(2);
    expect(first.opening.maxX).toBe(238);
    expect(first.opening.minY).toBe(2);
    expect(first.opening.maxY).toBe(78);
    expect(first.opening.minZ).toBe(24);
    expect(first.opening.maxZ).toBe(30);
    expect(first.supportZ).toBe(24);
    expect(first.trayAssembly.minX).toBeCloseTo(2.3, 10);
    expect(first.trayAssembly.maxX).toBeCloseTo(237.7, 10);
    expect(first.trayAssembly.minY).toBeCloseTo(2.3, 10);
    expect(first.trayAssembly.maxY).toBeCloseTo(77.7, 10);
    expect(first.capacity).toBeCloseTo(360806.4, 6);

    // 232 × 72 × (21.6 + 61.6 + 101.6) = 3.0868992 L
    expect(plan.theoreticalCapacity).toBeCloseTo(3_086_899.2, 6);
  });

  it("收纳高度 40/80/120 的仓净高与理论容积符合规格", () => {
    const params = withStorageSteppedHeightSpec(
      createDefaultStorageSteppedParams("standard"),
      "storage",
    );
    const plan = deriveStorageSteppedPlan(params);

    expect(plan.totalHeight).toBe(120);
    expect(plan.steps.map((step) => step.deckHeight)).toEqual([40, 80, 120]);
    expect(plan.steps.map((step) => step.clearHeight)).toEqual([31.6, 71.6, 111.6]);
    // 232 × 72 × 214.8 = 3.5880192 L
    expect(plan.theoreticalCapacity).toBeCloseTo(3_588_019.2, 6);
  });

  it("切换主体高度不改变托盘外形与槽位", () => {
    const base = createDefaultStorageSteppedParams("standard");
    const withSlots: StorageSteppedParams = {
      ...base,
      trays: base.trays.map((tray) => ({
        ...tray,
        slots: [
          createFreeSlotInstance({ id: `slot-${tray.stepIndex}`, x: 40, y: 37.7, width: 32 }),
        ],
      })),
    };
    const storage = withStorageSteppedHeightSpec(withSlots, "storage");
    const planStandard = deriveStorageSteppedPlan(withSlots);
    const planStorage = deriveStorageSteppedPlan(storage);

    expect(planStorage.trayWidth).toBe(planStandard.trayWidth);
    expect(planStorage.trayDepth).toBe(planStandard.trayDepth);
    expect(planStorage.trays.map((tray) => tray.slots)).toEqual(
      planStandard.trays.map((tray) => tray.slots),
    );
    expect(planStorage.trays.map((tray) => tray.partId)).toEqual([
      "tray-1",
      "tray-2",
      "tray-3",
    ]);
  });

  it("托盘尺寸由接口参数统一推导", () => {
    const params = createDefaultStorageSteppedParams();
    params.interface.assemblyClearance = 0.5;
    params.interface.rimThickness = 3;
    expect(deriveStorageSteppedTraySize(params.interface)).toEqual({
      width: 240 - 6 - 1,
      depth: 80 - 6 - 1,
    });
  });
});

describe("Storage Stepped 参数校验", () => {
  it("默认参数没有阻断错误", () => {
    const validation = validateStorageSteppedParams(
      createDefaultStorageSteppedParams(),
    );
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
  });

  it("未知接口版本被拒绝", () => {
    const params = createDefaultStorageSteppedParams();
    params.interfaceVersion = 2;
    const validation = validateStorageSteppedParams(params);
    expect(validation.isValid).toBe(false);
    expect(validation.errors[0].path).toBe("interfaceVersion");
  });

  it("高度规格与实际台面高度必须一致", () => {
    const params = createDefaultStorageSteppedParams();
    params.firstStepHeight = 40;
    const validation = validateStorageSteppedParams(params);
    expect(validation.errors.some((entry) => entry.path === "firstStepHeight")).toBe(true);
  });

  it("拒绝非有限数、负间隙与上沿不小于下壁", () => {
    const nonFinite = createDefaultStorageSteppedParams();
    nonFinite.interface.bodyWidth = Number.NaN;
    expect(
      validateStorageSteppedParams(nonFinite).errors.some(
        (entry) => entry.path === "interface.bodyWidth",
      ),
    ).toBe(true);

    const negativeClearance = createDefaultStorageSteppedParams();
    negativeClearance.interface.assemblyClearance = -0.1;
    expect(
      validateStorageSteppedParams(negativeClearance).errors.some(
        (entry) => entry.path === "interface.assemblyClearance",
      ),
    ).toBe(true);

    const thickRim = createDefaultStorageSteppedParams();
    thickRim.interface.rimThickness = 4;
    expect(
      validateStorageSteppedParams(thickRim).errors.some(
        (entry) => entry.path === "interface.rimThickness",
      ),
    ).toBe(true);
  });

  it("拒绝非正仓净高", () => {
    const highBase = createDefaultStorageSteppedParams();
    highBase.interface.baseThickness = 30;
    expect(
      validateStorageSteppedParams(highBase).errors.some((entry) =>
        entry.message.includes("仓室净高"),
      ),
    ).toBe(true);

  });

  it.each([
    [2.2, -0.1, -0.4],
    [2.4, 0.1, -0.2],
  ])("壁厚 %s mm 时阻止缺少承托的配置", (wall, centered, shifted) => {
    const params = createDefaultStorageSteppedParams();
    params.interface.lowerWallThickness = wall;
    const plan = deriveStorageSteppedPlan(params);

    expect(plan.supportContactCentered).toBeCloseTo(centered);
    expect(plan.supportContactShifted).toBeCloseTo(shifted);
    expect(validateStorageSteppedParams(params).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringMatching(/没有平底承托面/) })]),
    );
  });

  it("磁吸底孔与 3mm 槽底组合可以成立", () => {
    const params = createDefaultStorageSteppedParams();
    params.trays[0] = {
      ...params.trays[0],
      baseHoleStructure: "magnetic-base-hole",
      slots: [createFreeSlotInstance({ id: "a", x: 117.7, y: 37.7, width: 32 })],
    };
    expect(validateStorageSteppedParams(params).isValid).toBe(true);
  });

  it("接口偏离默认值只提示、不阻断", () => {
    const params = createDefaultStorageSteppedParams();
    params.interface.bodyWidth = 260;
    const validation = validateStorageSteppedParams(params);
    expect(validation.isValid).toBe(true);
    expect(validation.warnings.some((entry) => entry.message.includes("偏离打样默认值"))).toBe(true);
  });

  it("固定 6mm 总厚度不能被参数改写", () => {
    const params = createDefaultStorageSteppedParams();
    params.interface.trayThickness = 7;
    const validation = validateStorageSteppedParams(params);
    expect(validation.isValid).toBe(false);
    expect(
      validation.errors.some((entry) => entry.path === "interface.trayThickness"),
    ).toBe(true);
  });

  it("底孔不满足剩余底壁时阻断，且不自动加厚托盘", () => {
    const params = withMagnetPostHole(createDefaultStorageSteppedParams(), 0, 3);
    const validation = validateStorageSteppedParams(params);
    expect(validation.isValid).toBe(false);
    expect(
      validation.errors.some((entry) =>
        entry.message.includes("无法容纳需要 4.0mm 底壁"),
      ),
    ).toBe(true);
    expect(params.interface.trayThickness).toBe(6);
  });

  it("合法的磁铁桩孔组合通过（3mm 槽深 + 2mm 孔深 + 1mm 底壁）", () => {
    const params = withMagnetPostHole(createDefaultStorageSteppedParams(), 0, 2);
    const validation = validateStorageSteppedParams(params);
    expect(validation.isValid).toBe(true);
  });

  it("槽位越界与间距不足分别报告到所属托盘", () => {
    const outOfBounds = createDefaultStorageSteppedParams();
    outOfBounds.trays[0] = {
      ...outOfBounds.trays[0],
      slots: [createFreeSlotInstance({ id: "a", x: 1, y: 37.7, width: 32 })],
    };
    const oobValidation = validateStorageSteppedParams(outOfBounds);
    expect(oobValidation.isValid).toBe(false);
    expect(oobValidation.errors[0].partId).toBe("tray-1");

    const colliding = createDefaultStorageSteppedParams();
    colliding.trays[1] = {
      ...colliding.trays[1],
      slots: [
        createFreeSlotInstance({ id: "a", x: 60, y: 37.7, width: 32 }),
        createFreeSlotInstance({ id: "b", x: 90, y: 37.7, width: 32 }),
      ],
    };
    const collisionValidation = validateStorageSteppedParams(colliding);
    expect(collisionValidation.isValid).toBe(false);
    expect(
      collisionValidation.errors.some((entry) => entry.message.includes("间距不足")),
    ).toBe(true);
    // 无关托盘仍然可以单独判定为可导出
    expect(getStorageSteppedPartBlockingReason(collisionValidation, "tray-3")).toBeNull();
    expect(getStorageSteppedPartBlockingReason(collisionValidation, "body")).toBeNull();
    expect(getStorageSteppedPartBlockingReason(collisionValidation, "tray-2")).not.toBeNull();
  });

  it("托盘数量与阶索引必须匹配", () => {
    const missing = createDefaultStorageSteppedParams();
    missing.trays = missing.trays.slice(0, 2);
    expect(validateStorageSteppedParams(missing).isValid).toBe(false);

    const duplicate = createDefaultStorageSteppedParams();
    duplicate.trays[2] = { ...duplicate.trays[2], stepIndex: 1 };
    const validation = validateStorageSteppedParams(duplicate);
    expect(validation.isValid).toBe(false);
    expect(
      validation.errors.some((entry) => entry.message.includes("重复托盘配置")),
    ).toBe(true);
  });
});

describe("Storage Stepped 配置复制", () => {
  it("复制到其他阶使用深拷贝并生成新槽位标识", () => {
    const base = createDefaultStorageSteppedParams();
    const source = createFreeSlotInstance({
      id: "original-slot",
      x: 60,
      y: 37.7,
      width: 32,
    });
    const params: StorageSteppedParams = {
      ...base,
      trays: base.trays.map((tray) =>
        tray.stepIndex === 0
          ? { ...tray, presetId: "circle-32-ten-staggered", slots: [source] }
          : tray,
      ),
    };

    let nextId = 0;
    const copied = copyStorageSteppedTrayConfig(
      params,
      0,
      2,
      { createId: () => `copy-${++nextId}` },
    );

    const sourceTray = getStorageSteppedTray(params, 0)!;
    const copiedTray = getStorageSteppedTray(copied, 2)!;
    expect(copiedTray.slots).toHaveLength(1);
    expect(copiedTray.slots[0].id).toBe("copy-1");
    expect(copiedTray.slots[0].x).toBe(sourceTray.slots[0].x);
    expect(copiedTray.presetId).toBe("circle-32-ten-staggered");

    copiedTray.slots[0].x = 10;
    expect(sourceTray.slots[0].x).toBe(60);
    expect(copiedTray.slots).not.toBe(sourceTray.slots);
  });
});

describe("Storage Stepped 零件指纹", () => {
  it("高度变化只影响主体指纹", async () => {
    const { getStorageSteppedPartFingerprint } = await import(
      "@/lib/storage-stepped-plan"
    );
    const standard = createDefaultStorageSteppedParams("standard");
    const storage = withStorageSteppedHeightSpec(standard, "storage");
    expect(getStorageSteppedPartFingerprint(standard, "body")).not.toBe(
      getStorageSteppedPartFingerprint(storage, "body"),
    );
    for (const partId of ["tray-1", "tray-2", "tray-3"]) {
      expect(getStorageSteppedPartFingerprint(standard, partId)).toBe(
        getStorageSteppedPartFingerprint(storage, partId),
      );
    }
  });

  it("某阶槽位变化只影响该托盘指纹", async () => {
    const { getStorageSteppedPartFingerprint } = await import(
      "@/lib/storage-stepped-plan"
    );
    const base = createDefaultStorageSteppedParams();
    const changed: StorageSteppedParams = {
      ...base,
      trays: base.trays.map((tray) =>
        tray.stepIndex === 1
          ? {
              ...tray,
              slots: [
                createFreeSlotInstance({ id: "a", x: 60, y: 37.7, width: 32 }),
              ],
            }
          : tray,
      ),
    };
    expect(getStorageSteppedPartFingerprint(base, "tray-2")).not.toBe(
      getStorageSteppedPartFingerprint(changed, "tray-2"),
    );
    expect(getStorageSteppedPartFingerprint(base, "tray-1")).toBe(
      getStorageSteppedPartFingerprint(changed, "tray-1"),
    );
    expect(getStorageSteppedPartFingerprint(base, "body")).toBe(
      getStorageSteppedPartFingerprint(changed, "body"),
    );
  });

  it("接口变化使全部零件指纹失效", async () => {
    const { getStorageSteppedPartFingerprint } = await import(
      "@/lib/storage-stepped-plan"
    );
    const base = createDefaultStorageSteppedParams();
    const changed: StorageSteppedParams = {
      ...base,
      interface: { ...base.interface, assemblyClearance: 0.4 },
    };
    for (const partId of ["body", "tray-1", "tray-2", "tray-3"]) {
      expect(getStorageSteppedPartFingerprint(base, partId)).not.toBe(
        getStorageSteppedPartFingerprint(changed, partId),
      );
    }
  });
});
