import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import type { WorkerRequest, WorkerResponse } from "@/lib/worker/tray.worker";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  postMessage = vi.fn<(request: WorkerRequest) => void>();
  terminate = vi.fn();

  constructor() {
    FakeWorker.instances.push(this);
  }

  complete(requestIndex: number, volume: number) {
    const request = this.postMessage.mock.calls[requestIndex][0];
    this.onmessage?.(new MessageEvent<WorkerResponse>("message", {
      data: {
        type: "GENERATION_SUCCESS",
        requestId: request.requestId,
        geometry: { polygons: [], transforms: [] } as never,
        volumeInfo: volume,
      },
    }));
  }
}

beforeEach(() => {
  vi.resetModules();
  FakeWorker.instances = [];
  vi.stubGlobal("window", {});
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

it("开发环境连续锻造加载新的 Worker，避免热更新后仍执行旧算法", async () => {
  const { trayWorkerService: service } = await import("@/lib/worker/worker-service");
  const first = service!.generateCustom(CUSTOM_LAYOUT_DEFAULTS);
  const oldWorker = FakeWorker.instances.at(-1)!;
  oldWorker.complete(0, 10);
  await expect(first).resolves.toMatchObject({ volume: 10 });

  const second = service!.generateCustom({
    ...CUSTOM_LAYOUT_DEFAULTS,
    footprintStyle: "polygonal",
    polygonCornerStyle: "tangent",
  });
  const newWorker = FakeWorker.instances.at(-1)!;
  expect(newWorker).not.toBe(oldWorker);
  expect(oldWorker.terminate).toHaveBeenCalledTimes(1);
  expect(newWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
    params: expect.objectContaining({ polygonCornerStyle: "tangent" }),
  }));
  newWorker.complete(0, 20);
  await expect(second).resolves.toMatchObject({ volume: 20 });
  service!.terminate();
});

it("开发环境并发请求不重建繁忙 Worker，显式终止后不自动复活", async () => {
  const { trayWorkerService: service } = await import("@/lib/worker/worker-service");
  const first = service!.generateCustom(CUSTOM_LAYOUT_DEFAULTS);
  const worker = FakeWorker.instances.at(-1)!;
  const second = service!.generateCustom(CUSTOM_LAYOUT_DEFAULTS);
  expect(FakeWorker.instances.at(-1)).toBe(worker);
  expect(worker.terminate).not.toHaveBeenCalled();
  worker.complete(1, 20);
  worker.complete(0, 10);
  await expect(first).resolves.toMatchObject({ volume: 10 });
  await expect(second).resolves.toMatchObject({ volume: 20 });

  service!.terminate();
  const count = FakeWorker.instances.length;
  await expect(service!.generateCustom(CUSTOM_LAYOUT_DEFAULTS)).rejects.toThrow("后台建模 Worker 已终止");
  expect(FakeWorker.instances).toHaveLength(count);
});
