import { act, renderHook } from "@testing-library/react";
import { primitives } from "@jscad/modeling";
import { describe, expect, it, vi } from "vitest";
import { useStorageStepped } from "@/hooks/useStorageStepped";
import { loadThreeGeometry } from "@/lib/three-geometry-loader";
import { BufferGeometry } from "three";
import type {
  DownloadPort,
  StorageSteppedPartResult,
  StorageSteppedWorkerPort,
} from "@/lib/model-ports";
import type { StorageSteppedParams } from "@/types/storage-stepped";

const { cuboid } = primitives;

vi.mock("@/lib/three-geometry-loader", { spy: true });

function createFakeWorker() {
  const generationCalls: Array<{ partId: string; params: StorageSteppedParams }> = [];
  const exportCalls: Array<{ filename: string; geometry: unknown }> = [];
  const worker: StorageSteppedWorkerPort = {
    generateStorageSteppedPart: vi.fn(
      async (params, partId): Promise<StorageSteppedPartResult> => {
        generationCalls.push({ partId, params: structuredClone(params) });
        return {
          partId,
          geometry: cuboid({ size: [10, 10, 10] }),
          volume: 1000,
          assemblyOffset: [0, 0, 0],
        };
      },
    ),
    exportSTL: vi.fn(async (geometry, filename) => {
      exportCalls.push({ filename, geometry });
      return { blob: new Blob([filename]), filename };
    }),
  };
  return { worker, generationCalls, exportCalls };
}

function createDownloadRecorder() {
  const files: Array<{ filename: string; blob: Blob }> = [];
  const port: DownloadPort = {
    downloadBlob(blob, filename) {
      files.push({ filename, blob });
    },
  };
  return { port, files };
}

async function generate(result: { current: ReturnType<typeof useStorageStepped> }) {
  await act(async () => {
    await result.current.handleGenerate();
  });
}

describe("useStorageStepped", () => {
  it("整阶复制可以撤销和重做，撤销后的新编辑会清除重做", () => {
    let id = 0;
    const { result } = renderHook(() =>
      useStorageStepped({ idFactory: { createId: () => `slot-${++id}` } }),
    );
    act(() => result.current.addSlot(32));
    act(() => result.current.copyTrayToStep(1));
    const copied = result.current.persistedParams.trays[1];
    expect(copied.slots).toHaveLength(1);

    act(() => result.current.undo());
    expect(result.current.persistedParams.trays[1].slots).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.persistedParams.trays[1]).toEqual(copied);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    act(() => result.current.setHeightSpec("storage"));
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.redo());
    expect(result.current.persistedParams.trays[1].slots).toHaveLength(0);
    expect(result.current.persistedParams.heightSpecId).toBe("storage");
  });

  it("首次生成按主体与三块托盘分别请求，并缓存为独立零件", async () => {
    const { worker, generationCalls } = createFakeWorker();
    const { port } = createDownloadRecorder();
    const { result } = renderHook(() =>
      useStorageStepped({ workerPort: worker, downloadPort: port }),
    );

    expect(result.current.parts).toHaveLength(0);
    expect(result.current.isPreviewStale).toBe(true);

    await generate(result);

    expect(generationCalls.map((call) => call.partId)).toEqual([
      "body",
      "tray-1",
      "tray-2",
      "tray-3",
    ]);
    expect(result.current.parts).toHaveLength(4);
    expect(result.current.isPreviewStale).toBe(false);
    expect(result.current.volume).toBeGreaterThan(0);
  });

  it("切换主体高度只重建主体并更新三块托盘的装配位置", async () => {
    const { worker, generationCalls } = createFakeWorker();
    const { port } = createDownloadRecorder();
    const { result } = renderHook(() =>
      useStorageStepped({ workerPort: worker, downloadPort: port }),
    );
    await generate(result);
    const trayGeometry = result.current.parts[1].threeGeometry;
    expect(result.current.parts.map((part) => part.assemblyOffset[2])).toEqual([0, 24, 64, 104]);
    generationCalls.length = 0;

    act(() => result.current.setHeightSpec("storage"));
    await generate(result);

    expect(generationCalls.map((call) => call.partId)).toEqual(["body"]);
    expect(result.current.params.heightSpecId).toBe("storage");
    expect(result.current.parts.map((part) => part.assemblyOffset[2])).toEqual([0, 34, 74, 114]);
    expect(result.current.parts[1].threeGeometry).toBe(trayGeometry);
    expect(result.current.isPreviewStale).toBe(false);
  });

  it("修改某一阶槽位只重建该托盘", async () => {
    const { worker, generationCalls } = createFakeWorker();
    const { port } = createDownloadRecorder();
    const { result } = renderHook(() =>
      useStorageStepped({ workerPort: worker, downloadPort: port }),
    );
    await generate(result);
    generationCalls.length = 0;

    act(() => {
      result.current.setCurrentStepIndex(1);
      result.current.addSlot(32);
    });
    await generate(result);

    expect(generationCalls.map((call) => call.partId)).toEqual(["tray-2"]);
    expect(result.current.params.trays[1].slots).toHaveLength(1);
  });

  it("接口变化使全部零件重建", async () => {
    const { worker, generationCalls } = createFakeWorker();
    const { port } = createDownloadRecorder();
    const { result } = renderHook(() =>
      useStorageStepped({ workerPort: worker, downloadPort: port }),
    );
    await generate(result);
    generationCalls.length = 0;

    act(() => result.current.updateInterface("assemblyClearance", 0.4));
    await generate(result);

    expect(generationCalls.map((call) => call.partId)).toEqual([
      "body",
      "tray-1",
      "tray-2",
      "tray-3",
    ]);
  });

  it("复制托盘可撤销，其他阶保持独立", async () => {
    const { worker } = createFakeWorker();
    const { port } = createDownloadRecorder();
    let counter = 0;
    const { result } = renderHook(() =>
      useStorageStepped({
        workerPort: worker,
        downloadPort: port,
        idFactory: { createId: () => `slot-${++counter}` },
      }),
    );

    act(() => {
      result.current.setCurrentStepIndex(0);
      result.current.addSlot(32);
    });
    expect(result.current.params.trays[0].slots).toHaveLength(1);

    act(() => result.current.copyTrayToStep(1));
    expect(result.current.params.trays[1].slots).toHaveLength(1);
    expect(result.current.params.trays[0].slots[0].id).not.toBe(
      result.current.params.trays[1].slots[0].id,
    );

    act(() => result.current.undo());
    expect(result.current.params.trays[1].slots).toHaveLength(0);
    expect(result.current.params.trays[0].slots).toHaveLength(1);
  });

  it("一次拖动只产生一次撤销记录", () => {
    const { worker } = createFakeWorker();
    const { port } = createDownloadRecorder();
    const { result } = renderHook(() =>
      useStorageStepped({ workerPort: worker, downloadPort: port }),
    );

    act(() => result.current.addSlot(32));
    const slot = result.current.params.trays[0].slots[0];
    const originalX = slot.x;

    act(() => {
      result.current.beginContinuousEdit();
      result.current.updateMultipleSlotsLive([{ id: slot.id, x: 50, y: 30 }]);
      result.current.updateMultipleSlotsLive([{ id: slot.id, x: 55, y: 32 }]);
      result.current.commitContinuousEdit();
    });

    expect(result.current.params.trays[0].slots[0]).toMatchObject({ x: 55, y: 32 });
    act(() => result.current.undo());
    expect(result.current.params.trays[0].slots[0].x).toBeCloseTo(originalX, 6);
  });

  it("非法托盘只阻断自身导出，主体仍可导出", async () => {
    const { worker, exportCalls } = createFakeWorker();
    const { port, files } = createDownloadRecorder();
    const { result } = renderHook(() =>
      useStorageStepped({ workerPort: worker, downloadPort: port }),
    );

    act(() =>
      result.current.updateBaseHole({
        baseHoleStructure: "magnet-post-hole",
        magnetPostHoleDepth: 3,
      }),
    );
    expect(
      result.current.getPartBlockingReason("tray-1"),
    ).not.toBeNull();
    expect(result.current.getPartBlockingReason("body")).toBeNull();

    await act(async () => {
      await result.current.handleExportBody();
    });
    expect(exportCalls).toHaveLength(1);
    expect(files).toHaveLength(2);

    await act(async () => {
      await result.current.handleExportCurrentTray();
    });
    expect(exportCalls).toHaveLength(1);
    expect(files).toHaveLength(2);
  });

  it("整套导出准备四件 STL 与一份 JSON 后才触发下载", async () => {
    const { worker, exportCalls } = createFakeWorker();
    const { port, files } = createDownloadRecorder();
    const { result } = renderHook(() =>
      useStorageStepped({ workerPort: worker, downloadPort: port }),
    );

    await act(async () => {
      await result.current.handleExportAll();
    });

    expect(exportCalls).toHaveLength(4);
    expect(files.map((file) => file.filename)).toEqual([
      "storage_stepped_standard_body_ssi1.stl",
      "storage_stepped_standard_tray-step1_ssi1.stl",
      "storage_stepped_standard_tray-step2_ssi1.stl",
      "storage_stepped_standard_tray-step3_ssi1.stl",
      "storage_stepped_standard_params_ssi1.json",
    ]);
  });

  it("过期生成结果不覆盖新参数对应的缓存", async () => {
    const resolvers: Array<(value: StorageSteppedPartResult) => void> = [];
    const worker: StorageSteppedWorkerPort = {
      generateStorageSteppedPart: vi.fn(
        (_params, partId) =>
          new Promise<StorageSteppedPartResult>((resolve) => {
            resolvers.push(resolve);
            void partId;
          }),
      ),
      exportSTL: vi.fn(async (_geometry, filename) => ({
        blob: new Blob([filename]),
        filename,
      })),
    };
    const { port } = createDownloadRecorder();
    let counter = 0;
    const { result } = renderHook(() =>
      useStorageStepped({
        workerPort: worker,
        downloadPort: port,
        idFactory: { createId: () => `slot-${++counter}` },
      }),
    );

    let generatePromise: Promise<void> | null = null;
    act(() => {
      generatePromise = result.current.handleGenerate();
    });
    expect(resolvers).toHaveLength(4);

    // 参数变化让在途请求过期
    act(() => result.current.setHeightSpec("storage"));

    await act(async () => {
      for (const resolve of resolvers) {
        resolve({
          partId: "body",
          geometry: cuboid({ size: [1, 1, 1] }),
          volume: 1,
          assemblyOffset: [0, 0, 0],
        });
      }
      await generatePromise;
    });

    expect(result.current.parts).toHaveLength(0);
    expect(result.current.isGenerating).toBe(false);
  });
});

describe("useStorageStepped 资源释放", () => {
  it("网格转换期间参数变化时释放过期结果并允许重新生成", async () => {
    const { worker } = createFakeWorker();
    const { result } = renderHook(() => useStorageStepped({ workerPort: worker }));
    const { promise: converting, resolve: markConverting } = Promise.withResolvers<void>();
    const { promise: conversion, resolve: completeConversion } = Promise.withResolvers<BufferGeometry>();
    vi.mocked(loadThreeGeometry).mockImplementationOnce(() => {
      markConverting();
      return conversion;
    });
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.handleGenerate();
      await converting;
    });
    act(() => result.current.setHeightSpec("storage"));
    const obsoleteGeometry = new BufferGeometry();
    const dispose = vi.spyOn(obsoleteGeometry, "dispose");
    await act(async () => {
      completeConversion(obsoleteGeometry);
      await pending;
    });
    expect(dispose).toHaveBeenCalledOnce();
    expect(result.current.parts).toHaveLength(0);
    expect(result.current.isGenerating).toBe(false);
    await generate(result);
    expect(result.current.parts).toHaveLength(4);
    expect(result.current.isPreviewStale).toBe(false);
  });

  it("卸载时释放缓存的 Three.js 几何", async () => {
    const { worker } = createFakeWorker();
    const { port } = createDownloadRecorder();
    const { result, unmount } = renderHook(() =>
      useStorageStepped({ workerPort: worker, downloadPort: port }),
    );
    await generate(result);
    const geometries = result.current.parts.map((part) => part.threeGeometry);
    const spies = geometries.map((geometry) => vi.spyOn(geometry, "dispose"));
    unmount();
    for (const spy of spies) {
      expect(spy).toHaveBeenCalled();
    }
  });
});

describe("useStorageStepped 失败与重试", () => {
  it("单件生成失败会记录错误，重试成功后清除", async () => {
    let failTray = true;
    const worker: StorageSteppedWorkerPort = {
      generateStorageSteppedPart: vi.fn(async (_params, partId): Promise<StorageSteppedPartResult> => {
        if (partId === "tray-2" && failTray) {
          throw new Error("模拟几何失败");
        }
        return {
          partId,
          geometry: cuboid({ size: [2, 2, 2] }),
          volume: 8,
          assemblyOffset: [0, 0, 0],
        };
      }),
      exportSTL: vi.fn(async (_geometry, filename) => ({
        blob: new Blob([filename]),
        filename,
      })),
    };
    const { port } = createDownloadRecorder();
    const { result } = renderHook(() =>
      useStorageStepped({ workerPort: worker, downloadPort: port }),
    );

    await generate(result);
    expect(result.current.parts.map((part) => part.partId)).toEqual([
      "body",
      "tray-1",
      "tray-3",
    ]);
    expect(result.current.workerErrors["tray-2"]).toContain("模拟几何失败");
    expect(result.current.isPreviewStale).toBe(true);

    failTray = false;
    await generate(result);
    expect(result.current.parts.map((part) => part.partId)).toEqual([
      "body",
      "tray-1",
      "tray-2",
      "tray-3",
    ]);
    expect(result.current.workerErrors["tray-2"]).toBeUndefined();
    expect(result.current.isPreviewStale).toBe(false);
  });
});
