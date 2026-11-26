import { primitives } from "@jscad/modeling";
import { describe, expect, it, vi } from "vitest";
import {
  exportStorageSteppedAllParts,
  exportStorageSteppedPart,
  getStorageSteppedParamsFilename,
  getStorageSteppedStlFilename,
} from "@/lib/storage-stepped-model-service";
import { ModelArtifactDownloadError } from "@/lib/model-artifact-bundle";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type {
  DownloadPort,
  StorageSteppedPartResult,
  StorageSteppedWorkerPort,
} from "@/lib/model-ports";
import {
  createDefaultStorageSteppedParams,
  withStorageSteppedHeightSpec,
} from "@/lib/storage-stepped-config";
import {
  buildCurrentParamArtifact,
} from "@/lib/current-param-artifact-encoder";
import { prepareParamFileObject } from "@/lib/historical-param-artifact-reader";
import { validateStorageSteppedParams } from "@/lib/storage-stepped-plan";
import { applyStorageSteppedTrayPreset } from "@/lib/storage-stepped-presets";

const { cuboid } = primitives;

function createWorker() {
  const generationCalls: Array<{ partId: string }> = [];
  const exportCalls: Array<{ filename: string; verifyClosed?: boolean }> = [];
  const worker: StorageSteppedWorkerPort = {
    generateStorageSteppedPart: vi.fn(
      async (_params, partId): Promise<StorageSteppedPartResult> => {
        generationCalls.push({ partId });
        return {
          partId,
          geometry: cuboid({ size: [10, 10, 10] }),
          volume: 1000,
          assemblyOffset: [0, 0, 0],
        };
      },
    ),
    exportSTL: vi.fn(async (_geometry, filename, verifyClosed) => {
      exportCalls.push({ filename, verifyClosed });
      return { blob: new Blob([filename]), filename };
    }),
  };
  return { worker, generationCalls, exportCalls };
}

function createDownloadPort(throwOnCall?: (index: number) => boolean) {
  const files: string[] = [];
  const port: DownloadPort = {
    downloadBlob(_blob, filename) {
      if (throwOnCall?.(files.length)) {
        throw new Error("浏览器阻止了下载");
      }
      files.push(filename);
    },
  };
  return { port, files };
}

describe("Storage Stepped 导出", () => {
  it("整套导出同一快照的四件 STL 与完整 JSON", async () => {
    const params = withStorageSteppedHeightSpec(
      createDefaultStorageSteppedParams(),
      "storage",
    );
    const snapshot = captureModeParamSnapshot("storage-stepped", params);
    const { worker, generationCalls, exportCalls } = createWorker();
    const { port, files } = createDownloadPort();

    await exportStorageSteppedAllParts(snapshot, worker, port);

    expect(generationCalls.map((call) => call.partId)).toEqual([
      "body",
      "tray-1",
      "tray-2",
      "tray-3",
    ]);
    expect(exportCalls.every((call) => call.verifyClosed === true)).toBe(true);
    expect(files).toEqual([
      "storage_stepped_storage_body_ssi1.stl",
      "storage_stepped_storage_tray-step1_ssi1.stl",
      "storage_stepped_storage_tray-step2_ssi1.stl",
      "storage_stepped_storage_tray-step3_ssi1.stl",
      "storage_stepped_storage_params_ssi1.json",
    ]);
  });

  it("两种高度与各阶托盘文件名互不覆盖", () => {
    const standard = createDefaultStorageSteppedParams("standard");
    const storage = withStorageSteppedHeightSpec(standard, "storage");
    const standardNames = new Set([
      getStorageSteppedStlFilename(standard, "body"),
      getStorageSteppedStlFilename(standard, "tray-1"),
      getStorageSteppedStlFilename(standard, "tray-2"),
      getStorageSteppedStlFilename(standard, "tray-3"),
    ]);
    expect(standardNames.size).toBe(4);
    expect(getStorageSteppedStlFilename(storage, "body")).not.toBe(
      getStorageSteppedStlFilename(standard, "body"),
    );
    expect(getStorageSteppedStlFilename(standard, "tray-2")).toContain(
      "tray-step2",
    );
    expect(getStorageSteppedParamsFilename(standard)).toBe(
      "storage_stepped_standard_params_ssi1.json",
    );
  });

  it("无关托盘非法时仍可导出有效主体", async () => {
    const base = createDefaultStorageSteppedParams();
    const params = {
      ...base,
      trays: base.trays.map((tray) =>
        tray.stepIndex === 0
          ? {
              ...tray,
              baseHoleStructure: "magnet-post-hole" as const,
              magnetPostHoleDepth: 3,
            }
          : tray,
      ),
    };
    const snapshot = captureModeParamSnapshot("storage-stepped", params);
    const { worker, exportCalls } = createWorker();
    const { port, files } = createDownloadPort();

    await exportStorageSteppedPart(snapshot, "body", worker, port);
    expect(exportCalls).toHaveLength(1);
    expect(files).toHaveLength(2);

    await expect(
      exportStorageSteppedPart(snapshot, "tray-1", worker, port),
    ).rejects.toThrow(/槽底/);
    expect(exportCalls).toHaveLength(1);
  });

  it("任一零件准备失败时不触发任何下载", async () => {
    const snapshot = captureModeParamSnapshot(
      "storage-stepped",
      createDefaultStorageSteppedParams(),
    );
    const worker: StorageSteppedWorkerPort = {
      generateStorageSteppedPart: vi.fn(async (_params, partId) => {
        if (partId === "tray-3") throw new Error("几何生成失败");
        return {
          partId,
          geometry: cuboid({ size: [1, 1, 1] }),
          volume: 1,
          assemblyOffset: [0, 0, 0] as [number, number, number],
        };
      }),
      exportSTL: vi.fn(async (_geometry, filename) => ({
        blob: new Blob([filename]),
        filename,
      })),
    };
    const { port, files } = createDownloadPort();

    await expect(
      exportStorageSteppedAllParts(snapshot, worker, port),
    ).rejects.toThrow("几何生成失败");
    expect(files).toHaveLength(0);
  });

  it("浏览器未触发下载时报告失败数量", async () => {
    const snapshot = captureModeParamSnapshot(
      "storage-stepped",
      createDefaultStorageSteppedParams(),
    );
    const { worker } = createWorker();
    const { port, files } = createDownloadPort(() => true);

    await expect(
      exportStorageSteppedAllParts(snapshot, worker, port),
    ).rejects.toBeInstanceOf(ModelArtifactDownloadError);
    expect(files).toHaveLength(0);
    try {
      await exportStorageSteppedAllParts(snapshot, worker, port);
    } catch (error) {
      expect(error).toBeInstanceOf(ModelArtifactDownloadError);
      expect((error as ModelArtifactDownloadError).failures).toHaveLength(5);
    }
  });

  it("参数 JSON 导出再导入保持接口、槽位与尺寸", () => {
    const base = createDefaultStorageSteppedParams();
    const withPreset = applyStorageSteppedTrayPreset(
      base,
      0,
      "circle-32-ten-staggered",
      { createId: (() => {
        let index = 0;
        return () => `slot-${++index}`;
      })() },
    );
    const snapshot = captureModeParamSnapshot("storage-stepped", withPreset);
    const artifact = buildCurrentParamArtifact(snapshot);
    const preparation = prepareParamFileObject(
      JSON.parse(JSON.stringify(artifact)),
    );
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    if (preparation.candidate.mode !== "storage-stepped") return;
    const imported = preparation.candidate.snapshot.params;

    expect(imported.interfaceVersion).toBe(base.interfaceVersion);
    expect(imported.heightSpecId).toBe(base.heightSpecId);
    expect(imported.interface).toEqual(base.interface);
    expect(imported.trays[0].slots).toHaveLength(10);
    withPreset.trays[0].slots.forEach((slot, index) => {
      const roundTripped = imported.trays[0].slots[index];
      expect(roundTripped.x).toBeCloseTo(slot.x, 3);
      expect(roundTripped.y).toBeCloseTo(slot.y, 3);
      expect(roundTripped.slotWidth).toBe(slot.slotWidth);
    });
    expect(validateStorageSteppedParams(imported).isValid).toBe(true);
  });
});
