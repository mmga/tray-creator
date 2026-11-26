import { describe, expect, it } from "vitest";
import { normalizeStorageSteppedParams } from "@/lib/storage-stepped-normalization";
import { createDefaultStorageSteppedParams } from "@/lib/storage-stepped-config";
import { createImportNormalizationRecorder } from "@/lib/param-import-report";
import type { StorageSteppedParams } from "@/types/storage-stepped";

function rawParams(): StorageSteppedParams {
  return structuredClone(createDefaultStorageSteppedParams());
}

describe("Storage Stepped 参数归一化", () => {
  it("默认参数往返不改变数值", () => {
    const params = createDefaultStorageSteppedParams();
    expect(normalizeStorageSteppedParams(structuredClone(params))).toEqual(params);
  });

  it("缺失的高度字段按规格补齐并记录默认值", () => {
    const params = rawParams() as Partial<StorageSteppedParams>;
    delete params.firstStepHeight;
    delete params.stepRise;
    const { recorder, adjustments } = createImportNormalizationRecorder();
    const normalized = normalizeStorageSteppedParams(
      params as StorageSteppedParams,
      recorder,
    );
    expect(normalized.firstStepHeight).toBe(30);
    expect(normalized.stepRise).toBe(40);
    expect(adjustments.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["firstStepHeight", "stepRise"]),
    );
  });

  it("缺失的底孔配置按关闭处理并补默认磁铁桩孔尺寸", () => {
    const params = rawParams();
    const tray = params.trays[0] as unknown as Record<string, unknown>;
    delete tray.baseHoleStructure;
    delete tray.magnetPostHoleDepth;
    const { recorder, adjustments } = createImportNormalizationRecorder();
    const normalized = normalizeStorageSteppedParams(params, recorder);
    expect(normalized.trays[0].baseHoleStructure).toBe("none");
    expect(normalized.trays[0].magnetPostHoleDepth).toBe(2);
    expect(adjustments.some((entry) => entry.path === "trays[0].baseHoleStructure"))
      .toBe(true);
  });

  it("未知接口版本被拒绝", () => {
    const params = rawParams();
    params.interfaceVersion = 99;
    expect(() => normalizeStorageSteppedParams(params)).toThrow(/interfaceVersion/);
  });

  it("非有限接口数值报出具体参数位置", () => {
    const params = rawParams();
    params.interface.bodyWidth = Number.NaN;
    expect(() => normalizeStorageSteppedParams(params)).toThrow(
      /interface\.bodyWidth/,
    );
  });

  it("固定 6mm 托盘总厚度不能被改写", () => {
    const params = rawParams();
    params.interface.trayThickness = 7;
    expect(() => normalizeStorageSteppedParams(params)).toThrow(
      /interface\.trayThickness/,
    );
  });

  it("托盘阶索引与数组位置不一致时拒绝", () => {
    const params = rawParams();
    params.trays[1] = { ...params.trays[1], stepIndex: 2 };
    expect(() => normalizeStorageSteppedParams(params)).toThrow(/stepIndex/);
  });

  it.each([0.5, 5.995, 6])("槽深 %s mm 超出面板范围时拒绝", (holeDepth) => {
    const params = rawParams();
    params.trays[0].holeDepth = holeDepth;
    expect(() => normalizeStorageSteppedParams(params)).toThrow(/holeDepth/);
  });

  it("非法槽位形状报出槽位位置", () => {
    const params = rawParams();
    params.trays[0].slots = [{
      id: "bad",
      x: 10,
      y: 10,
      shape: "rectangle" as never,
      width: 32,
      height: 32,
      rotation: 0,
    }];
    expect(() => normalizeStorageSteppedParams(params)).toThrow(
      /trays\[0\]\.slots\[0\]\.shape/,
    );
  });

  it("超出滑块范围的接口数值保留原值而不是静默钳位", () => {
    const params = rawParams();
    params.interface.bodyWidth = 999;
    const normalized = normalizeStorageSteppedParams(params);
    expect(normalized.interface.bodyWidth).toBe(999);
  });
});
