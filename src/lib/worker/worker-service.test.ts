import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerResponse } from "@/lib/worker/tray.worker";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<WorkerResponse>) => unknown) | null = null;
  onerror: ((event: ErrorEvent) => unknown) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor(url: URL, options: WorkerOptions) {
    void url;
    void options;
    FakeWorker.instances.push(this);
  }

  emit(data: WorkerResponse) {
    this.onmessage?.({ data } as MessageEvent<WorkerResponse>);
  }
}

describe("worker service", () => {
  beforeEach(() => {
    vi.resetModules();
    FakeWorker.instances = [];
    vi.stubGlobal("Worker", FakeWorker as unknown as typeof Worker);
  });

  it("posts generation requests and resolves successful responses", async () => {
    const { trayWorkerService } = await import("@/lib/worker/worker-service");
    const service = trayWorkerService;
    expect(service).not.toBeNull();

    const worker = FakeWorker.instances[0];
    const geometry = { id: "grid-geom" } as never;
    const promise = service!.generateGrid(DEFAULT_TRAY_PARAMS);
    const request = worker.postMessage.mock.calls[0]?.[0] as {
      type: string;
      requestId: string;
      params: unknown;
    };

    expect(request.type).toBe("GENERATE_GRID");
    expect(request.params).toEqual(DEFAULT_TRAY_PARAMS);

    worker.emit({
      type: "GENERATION_SUCCESS",
      requestId: request.requestId,
      geometry,
      volumeInfo: 321,
    });

    await expect(promise).resolves.toEqual({ geometry, volume: 321 });
  });

  it("routes base converter generation requests", async () => {
    const { trayWorkerService } = await import("@/lib/worker/worker-service");
    const worker = FakeWorker.instances[0];
    const promise = trayWorkerService!.generateBaseConverter(
      BASE_CONVERTER_DEFAULTS,
    );
    const request = worker.postMessage.mock.calls[0]?.[0] as {
      type: string;
      requestId: string;
      params: unknown;
    };
    expect(request).toMatchObject({
      type: "GENERATE_BASE_CONVERTER",
      params: BASE_CONVERTER_DEFAULTS,
    });
    worker.emit({
      type: "GENERATION_SUCCESS",
      requestId: request.requestId,
      geometry: { id: "base-converter-geom" } as never,
      volumeInfo: 42,
    });
    await expect(promise).resolves.toEqual({
      geometry: { id: "base-converter-geom" },
      volume: 42,
    });
  });

  it("routes custom, stepped, split, and outline preview requests to their response shapes", async () => {
    const { trayWorkerService } = await import("@/lib/worker/worker-service");
    const service = trayWorkerService!;
    const worker = FakeWorker.instances[0];

    const customPromise = service.generateCustom(CUSTOM_LAYOUT_DEFAULTS);
    const customRequest = worker.postMessage.mock.calls[0]?.[0] as {
      requestId: string;
      type: string;
    };
    worker.emit({
      type: "GENERATION_SUCCESS",
      requestId: customRequest.requestId,
      geometry: { id: "custom-geom" } as never,
      volumeInfo: 111,
    });
    await expect(customPromise).resolves.toEqual({
      geometry: { id: "custom-geom" },
      volume: 111,
    });

    const steppedPromise = service.generateStepped(STEPPED_LAYOUT_DEFAULTS);
    const steppedGenerationRequest = worker.postMessage.mock.calls[1]?.[0] as {
      requestId: string;
      type: string;
    };
    expect(steppedGenerationRequest.type).toBe("GENERATE_STEPPED");
    worker.emit({
      type: "GENERATION_SUCCESS",
      requestId: steppedGenerationRequest.requestId,
      geometry: { id: "stepped-geom" } as never,
      volumeInfo: 222,
    });
    await expect(steppedPromise).resolves.toEqual({
      geometry: { id: "stepped-geom" },
      volume: 222,
    });

    const steppedSplitPromise = service.generateSteppedSplitParts(
      STEPPED_LAYOUT_DEFAULTS,
    );
    const steppedSplitRequest = worker.postMessage.mock.calls[2]?.[0] as {
      requestId: string;
      type: string;
    };
    expect(steppedSplitRequest.type).toBe("GENERATE_STEPPED_SPLIT_PARTS");
    worker.emit({
      type: "STEPPED_SPLIT_PARTS_SUCCESS",
      requestId: steppedSplitRequest.requestId,
      parts: [
        {
          index: 0,
          filenameLabel: "part_01_cad_low",
          label: "低组",
          fromHeight: 0,
          toHeight: 10,
          geometry: { id: "cad-split-geom" } as never,
        },
      ],
    });
    await expect(steppedSplitPromise).resolves.toEqual({
      parts: [
        {
          index: 0,
          filenameLabel: "part_01_cad_low",
          label: "低组",
          fromHeight: 0,
          toHeight: 10,
          geometry: { id: "cad-split-geom" },
        },
      ],
    });

    const previewPromise =
      service.generateSteppedOutlinePreview(STEPPED_LAYOUT_DEFAULTS);
    const previewRequest = worker.postMessage.mock.calls[3]?.[0] as {
      requestId: string;
      type: string;
    };
    expect(previewRequest.type).toBe("GENERATE_STEPPED_OUTLINE_PREVIEW");
    worker.emit({
      type: "STEPPED_OUTLINE_PREVIEW_SUCCESS",
      requestId: previewRequest.requestId,
      outlinePreview: null,
      durationMs: 9,
    });
    await expect(previewPromise).resolves.toEqual({
      outlinePreview: null,
      durationMs: 9,
    });
  });

  it("exports STL blobs and rejects worker errors", async () => {
    const { trayWorkerService } = await import("@/lib/worker/worker-service");
    const service = trayWorkerService!;
    const worker = FakeWorker.instances[0];

    const exportPromise = service.exportSTL(
      { id: "geom" } as never,
      "model.stl",
    );
    const exportRequest = worker.postMessage.mock.calls[0]?.[0] as {
      requestId: string;
      type: string;
    };
    expect(exportRequest.type).toBe("EXPORT_STL");
    const blob = new Blob(["stl"], { type: "application/sla" });
    worker.emit({
      type: "EXPORT_SUCCESS",
      requestId: exportRequest.requestId,
      blob,
      filename: "model.stl",
    });
    await expect(exportPromise).resolves.toEqual({
      blob,
      filename: "model.stl",
    });

    const errorPromise = service.generateGrid(DEFAULT_TRAY_PARAMS);
    const errorRequest = worker.postMessage.mock.calls[1]?.[0] as {
      requestId: string;
    };
    worker.emit({
      type: "ERROR",
      requestId: errorRequest.requestId,
      message: "boom",
    });
    await expect(errorPromise).rejects.toThrow("boom");
  });

  it("rejects unexpected response types and terminates the worker", async () => {
    const { trayWorkerService } = await import("@/lib/worker/worker-service");
    const service = trayWorkerService!;
    const worker = FakeWorker.instances[0];

    const promise = service.exportSTL({ id: "geom" } as never, "model.stl");
    const request = worker.postMessage.mock.calls[0]?.[0] as {
      requestId: string;
    };
    worker.emit({
      type: "GENERATION_SUCCESS",
      requestId: request.requestId,
      geometry: { id: "unexpected" } as never,
      volumeInfo: 1,
    });
    await expect(promise).rejects.toThrow(
      "Unexpected worker response: GENERATION_SUCCESS",
    );

    service.terminate();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
