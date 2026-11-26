import { describe, expect, it } from "vitest";
import {
  applyStorageSteppedTrayPreset,
  createStorageSteppedPresetSlots,
  getStorageSteppedPresetFitReport,
  getStorageSteppedPresetLayoutContext,
  STORAGE_STEPPED_TRAY_PRESETS,
} from "@/lib/storage-stepped-presets";
import {
  addStorageSteppedTraySlot,
  applyStorageSteppedTraySlotUpdates,
  duplicateStorageSteppedTraySlots,
  insertStorageSteppedTraySlots,
  removeStorageSteppedTraySlots,
  updateStorageSteppedTrayHoleDepth,
} from "@/lib/storage-stepped-layout";
import { prepareStorageSteppedLayoutImport, applyStorageSteppedLayoutImport } from "@/lib/storage-stepped-layout-import";
import { createDefaultStorageSteppedParams } from "@/lib/storage-stepped-config";
import { validateStorageSteppedParams } from "@/lib/storage-stepped-plan";
import { createFreeSlotInstance } from "@/lib/slot-instance-factory";
import { CIRCLE_SLOT_DEFINITIONS } from "@/lib/slot-definitions";
import type { StorageSteppedParams } from "@/types/storage-stepped";

function idFactory() {
  let counter = 0;
  return { createId: () => `id-${++counter}` };
}

function slotDefinition(id: string) {
  const definition = CIRCLE_SLOT_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) throw new Error(`missing ${id}`);
  return definition;
}

describe("Storage Stepped 托盘预设", () => {
  it("默认托盘按排列方式排满 0/14/12/12/6/5 个槽", () => {
    const params = createDefaultStorageSteppedParams();
    const context = getStorageSteppedPresetLayoutContext(params);
    const expected = [0, 14, 12, 12, 6, 5];
    STORAGE_STEPPED_TRAY_PRESETS.forEach((preset, index) => {
      const slots = createStorageSteppedPresetSlots(preset, {
        ...context,
        idFactory: idFactory(),
      });
      expect(slots, preset.id).toHaveLength(expected[index]);
    });
  });

  it("浅阶 32 mm 单排可放六槽，间距增至 8 mm 时可放五槽", () => {
    const params = createDefaultStorageSteppedParams();
    params.interface.moduleDepth = 60;
    const context = getStorageSteppedPresetLayoutContext(params);
    const single = STORAGE_STEPPED_TRAY_PRESETS.find((entry) => entry.id === "circle-32-five")!;
    const double = STORAGE_STEPPED_TRAY_PRESETS.find((entry) => entry.id === "circle-32-ten-staggered")!;
    const generated = applyStorageSteppedTrayPreset(params, 0, single.id, idFactory());
    expect(generated.trays[0].slots).toHaveLength(6);
    expect(validateStorageSteppedParams(generated).isValid).toBe(true);
    expect(getStorageSteppedPresetFitReport(single, { ...context, spacing: 8 }).slotCount).toBe(5);
    expect(getStorageSteppedPresetFitReport(double, context).fits).toBe(false);
    expect(applyStorageSteppedTrayPreset(generated, 0, double.id, idFactory())).toBe(generated);
  });

  it("预设使用项目槽位定义的成品槽径，不重复叠加公差", () => {
    const params = createDefaultStorageSteppedParams();
    const context = getStorageSteppedPresetLayoutContext(params);
    for (const preset of STORAGE_STEPPED_TRAY_PRESETS) {
      if (preset.layout.kind === "flat") continue;
      const definition = slotDefinition(preset.layout.slotDefinitionId);
      const slots = createStorageSteppedPresetSlots(preset, {
        ...context,
        idFactory: idFactory(),
      });
      expect(slots[0].width).toBeCloseTo(definition.baseDiameter, 6);
      expect(slots[0].slotWidth).toBeCloseTo(definition.slotDiameter, 6);
      expect(slots[0].slotDefinitionId).toBe(definition.id);
    }
  });

  it("全部预设落在 235.4 × 75.4 托盘的 3mm 边距内，且槽间距不小于 5mm", () => {
    const params = createDefaultStorageSteppedParams();
    const context = getStorageSteppedPresetLayoutContext(params);
    for (const preset of STORAGE_STEPPED_TRAY_PRESETS) {
      const report = getStorageSteppedPresetFitReport(preset, context);
      expect(report.fits, preset.id).toBe(true);
      if (report.slotCount > 1) {
        expect(report.minimumSpacing, preset.id).toBeGreaterThanOrEqual(5 - 1e-6);
      }
    }
  });

  it("32mm 交错布局优先放满两排，托盘变浅时改为六槽加五槽", () => {
    const params = createDefaultStorageSteppedParams();
    const context = getStorageSteppedPresetLayoutContext(params);
    const preset = STORAGE_STEPPED_TRAY_PRESETS.find(
      (entry) => entry.id === "circle-32-ten-staggered",
    )!;
    const report = getStorageSteppedPresetFitReport(preset, context);
    const pitch = 32.4 + 5;
    const shift = 10;
    expect(report.slotCount).toBe(12);
    expect(report.layoutWidth).toBeCloseTo(5 * pitch + 32.4 + shift, 6);
    expect(report.layoutDepth).toBeCloseTo(32.4 + Math.sqrt(pitch ** 2 - shift ** 2), 6);
    expect(report.minimumSpacing).toBeCloseTo(5, 6);
    expect(preset.source).toBe("derived");
    expect(getStorageSteppedPresetFitReport(preset, { ...context, trayDepth: 72 }).slotCount).toBe(11);

    const slots = createStorageSteppedPresetSlots(preset, {
      ...context,
      idFactory: idFactory(),
    });
    // 第二排使用横向剩余空间，保留两个完整的六槽排。
    const firstRow = slots.slice(0, 6).map((slot) => slot.x);
    const secondRow = slots.slice(6).map((slot) => slot.x);
    expect(secondRow[0] - firstRow[0]).toBeCloseTo(shift, 6);
  });

  it("应用预设只替换目标阶槽位，保留槽深与底孔配置", () => {
    let params = createDefaultStorageSteppedParams();
    params = updateStorageSteppedTrayHoleDepth(params, 1, 2.5);
    const beforeOthers = params.trays.map((tray) =>
      tray.stepIndex === 1 ? null : structuredClone(tray),
    );

    const next = applyStorageSteppedTrayPreset(
      params,
      1,
      "circle-32-ten-staggered",
      idFactory(),
    );
    const target = next.trays.find((tray) => tray.stepIndex === 1)!;
    expect(target.slots).toHaveLength(12);
    expect(target.holeDepth).toBe(2.5);
    expect(target.presetId).toBe("circle-32-ten-staggered");
    next.trays.forEach((tray, index) => {
      if (tray.stepIndex === 1) return;
      expect(tray).toEqual(beforeOthers[index]);
    });
    expect(params.trays.find((tray) => tray.stepIndex === 1)!.slots).toHaveLength(0);
  });

  it("未知预设被拒绝", () => {
    expect(() =>
      applyStorageSteppedTrayPreset(
        createDefaultStorageSteppedParams(),
        0,
        "unknown",
        idFactory(),
      ),
    ).toThrow(/未知托盘预设/);
  });
});

describe("Storage Stepped 槽位编辑", () => {
  it("增删移动只影响当前阶，且标记为自定义布局", () => {
    const base = createDefaultStorageSteppedParams();
    const slot = createFreeSlotInstance({
      id: "slot-a",
      x: 40,
      y: 37.7,
      width: 32,
    });
    let params = addStorageSteppedTraySlot(base, 0, slot);
    expect(params.trays[0].presetId).toBe("custom");
    expect(params.trays[0].slots).toHaveLength(1);
    expect(params.trays[1]).toEqual(base.trays[1]);

    params = applyStorageSteppedTraySlotUpdates(params, 0, [
      { id: "slot-a", x: 60, y: 40, rotation: 30 },
    ]);
    expect(params.trays[0].slots[0]).toMatchObject({ x: 60, y: 40, rotation: 30 });
    // 深拷贝：基准参数不被修改
    expect(base.trays[0].slots).toHaveLength(0);

    params = removeStorageSteppedTraySlots(params, 0, ["slot-a"]);
    expect(params.trays[0].slots).toHaveLength(0);
  });

  it("复制槽位生成新标识并偏移，不改变原槽位", () => {
    const base = createDefaultStorageSteppedParams();
    const withSlot = addStorageSteppedTraySlot(
      base,
      0,
      createFreeSlotInstance({ id: "slot-a", x: 60, y: 37.7, width: 32 }),
    );
    const { params, newIds } = duplicateStorageSteppedTraySlots(
      withSlot,
      0,
      ["slot-a"],
      idFactory(),
    );
    expect(newIds).toHaveLength(1);
    expect(params.trays[0].slots).toHaveLength(2);
    const copy = params.trays[0].slots.find((slot) => slot.id === newIds[0])!;
    expect(copy.x).toBe(70);
    expect(copy.y).toBeCloseTo(27.7, 10);
    expect(withSlot.trays[0].slots).toHaveLength(1);
  });

  it("对称插入保留来源槽形快照", () => {
    const base = createDefaultStorageSteppedParams();
    const source = createFreeSlotInstance({
      id: "original",
      x: 60,
      y: 37.7,
      width: 32,
    });
    const { id: _ignored, ...sourceWithoutId } = source;
    void _ignored;
    const params = insertStorageSteppedTraySlots(
      base,
      0,
      [sourceWithoutId],
      idFactory(),
    );
    const inserted = params.trays[0].slots[0];
    expect(inserted.width).toBe(32);
    expect(inserted.slotWidth).toBeCloseTo(32.4, 6);
    expect(inserted.id).toBe("id-1");
  });
});

const CUSTOM_PARAMS = {
  version: 1,
  mode: "custom",
  params: {
    trayWidth: 120,
    trayDepth: 80,
    spacing: 5,
    boundarySpacing: 5,
    baseThickness: 2,
    holeDepth: 3,
    cornerRadius: 2,
    sideBevelWidth: 0,
    slots: [
      { id: "a", x: 30, y: 40, shape: "circle", width: 25, height: 25, rotation: 0 },
      { id: "b", x: 90, y: 40, shape: "circle", width: 25, height: 25, rotation: 0 },
    ],
  },
};

function importInto(
  data: unknown,
  params: StorageSteppedParams = createDefaultStorageSteppedParams(),
) {
  return prepareStorageSteppedLayoutImport(data, {
    params,
    stepIndex: 0,
    idFactory: idFactory(),
  });
}

describe("Storage Stepped 布局导入", () => {
  it("自定义托盘槽位整体平移后保留相对位置，槽径不缩放", () => {
    const report = importInto(CUSTOM_PARAMS);
    expect(report.status).toBe("ready");
    expect(report.slotCount).toBe(2);
    expect(report.conflicts).toEqual([]);
    const [a, b] = report.slots;
    expect(b.x - a.x).toBeCloseTo(60, 6);
    expect(b.y - a.y).toBeCloseTo(0, 6);
    expect(a.width).toBe(25);
    expect(a.slotWidth).toBeCloseTo(25.4, 6);
    // 平移后布局中心落在托盘中心
    expect((a.x + b.x) / 2).toBeCloseTo(235.4 / 2, 6);
    expect(a.y).toBeCloseTo(75.4 / 2, 6);
    expect(report.translation.x).not.toBe(0);
    expect(report.notes.join()).toContain("不缩放");
  });

  it("提交导入只替换目标阶槽位并保留槽深", () => {
    let params = createDefaultStorageSteppedParams();
    params = updateStorageSteppedTrayHoleDepth(params, 0, 2.5);
    const report = importInto(CUSTOM_PARAMS, params);
    const next = applyStorageSteppedLayoutImport(params, 0, report);
    expect(next.trays[0].slots).toHaveLength(2);
    expect(next.trays[0].holeDepth).toBe(2.5);
    expect(next.trays[0].presetId).toBe("custom");
    expect(params.trays[0].slots).toHaveLength(0);
  });

  it("拒绝阶梯分组、网格与收纳模式参数", () => {
    expect(importInto({ groups: [], slots: [] }).status).toBe("blocked");
    expect(importInto({ rows: 2, columns: 3 }).status).toBe("blocked");
    expect(importInto({ version: 1, mode: "stepped", params: { groups: [], slots: [] } }).conflicts[0].message)
      .toContain("自定义阶梯底座");
    expect(importInto({ version: 1, mode: "storage-stepped", params: {} }).status).toBe("blocked");
  });

  it("空槽位列表被拒绝并提示改用平板", () => {
    const report = importInto({ ...CUSTOM_PARAMS, params: { ...CUSTOM_PARAMS.params, slots: [] } });
    expect(report.status).toBe("blocked");
    expect(report.conflicts[0].message).toContain("平板");
  });

  it("超界布局报告冲突且不裁剪槽位", () => {
    const large = {
      ...CUSTOM_PARAMS,
      params: {
        ...CUSTOM_PARAMS.params,
        slots: [
          { id: "a", x: 10, y: 10, shape: "circle", width: 40, height: 40, rotation: 0 },
          { id: "b", x: 300, y: 40, shape: "circle", width: 40, height: 40, rotation: 0 },
        ],
      },
    };
    const report = importInto(large);
    expect(report.status).toBe("blocked");
    expect(report.conflicts.some((entry) => entry.message.includes("越界"))).toBe(true);
    expect(report.slots).toHaveLength(2);
    expect(report.notes.join()).toContain("未做裁剪");
    expect(() =>
      applyStorageSteppedLayoutImport(createDefaultStorageSteppedParams(), 0, report),
    ).toThrow(/冲突/);
  });

  it("非法槽位数据给出具体位置", () => {
    const bad = {
      ...CUSTOM_PARAMS,
      params: {
        ...CUSTOM_PARAMS.params,
        slots: [{ id: "a", x: "bad", y: 40, shape: "circle", width: 25, height: 25, rotation: 0 }],
      },
    };
    const report = importInto(bad);
    expect(report.status).toBe("blocked");
    expect(report.conflicts[0].path).toBe("slots[0].x");
  });
});
