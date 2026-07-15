import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";

const createTrayModel = vi.fn();
const createCustomTrayModel = vi.fn();
const createBaseConverterModel = vi.fn();
const createSimpleSteppedTrayModel = vi.fn();
const createSteppedTrayModel = vi.fn();
const createSteppedCadTrayModel = vi.fn();
const createSteppedCadSplitParts = vi.fn();
const buildSteppedOutlinePreview = vi.fn();
const serialize = vi.fn();
const measureVolume = vi.fn();

vi.mock("../tray-model", () => ({
  createTrayModel,
}));

vi.mock("../custom-tray-model", () => ({
  createCustomTrayModel,
}));

vi.mock("../base-converter-model", () => ({
  createBaseConverterModel,
}));

vi.mock("../simple-stepped-tray-model", () => ({
  createSimpleSteppedTrayModel,
}));

vi.mock("../stepped-cad-tray-model", () => ({
  createSteppedCadSplitParts,
  createSteppedCadTrayModel,
}));

vi.mock("../stepped-tray-model", () => ({
  createSteppedTrayModel,
}));

vi.mock("../stepped-outline-preview", () => ({
  buildSteppedOutlinePreview,
}));

vi.mock("@jscad/stl-serializer", () => ({
  default: {
    serialize,
  },
}));

vi.mock("@jscad/modeling/src/measurements", () => ({
  measureVolume,
}));

function createWorkerSelf() {
  return {
    onmessage: null as ((event: MessageEvent) => Promise<void>) | null,
    postMessage: vi.fn(),
  };
}

async function loadWorkerModule() {
  vi.resetModules();
  const workerSelf = createWorkerSelf();
  vi.stubGlobal("self", workerSelf);
  await import("./tray.worker");
  return workerSelf;
}

describe("tray worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts generation success for grid requests", async () => {
    const workerSelf = await loadWorkerModule();
    const geometry = { id: "grid-geom" };
    createTrayModel.mockReturnValue(geometry);
    measureVolume.mockReturnValue(123.4);

    await workerSelf.onmessage?.({
      data: {
        type: "GENERATE_GRID",
        requestId: "req-grid",
        params: DEFAULT_TRAY_PARAMS,
      },
    } as MessageEvent);

    expect(createTrayModel).toHaveBeenCalledWith(DEFAULT_TRAY_PARAMS);
    expect(measureVolume).toHaveBeenCalledWith(geometry);
    expect(workerSelf.postMessage).toHaveBeenCalledWith({
      type: "GENERATION_SUCCESS",
      requestId: "req-grid",
      geometry,
      volumeInfo: 123.4,
    });
  });

  it("posts generation success for base converter requests", async () => {
    const workerSelf = await loadWorkerModule();
    const geometry = { id: "base-converter-geom" };
    createBaseConverterModel.mockReturnValue(geometry);
    measureVolume.mockReturnValue(45.6);

    await workerSelf.onmessage?.({
      data: {
        type: "GENERATE_BASE_CONVERTER",
        requestId: "req-base-converter",
        params: BASE_CONVERTER_DEFAULTS,
      },
    } as MessageEvent);

    expect(createBaseConverterModel).toHaveBeenCalledWith(
      BASE_CONVERTER_DEFAULTS,
    );
    expect(workerSelf.postMessage).toHaveBeenCalledWith({
      type: "GENERATION_SUCCESS",
      requestId: "req-base-converter",
      geometry,
      volumeInfo: 45.6,
    });
  });

  it("logs stepped debug info and posts generation success when debugging is enabled", async () => {
    const workerSelf = await loadWorkerModule();
    const geometry = { id: "stepped-geom" };
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    createSteppedTrayModel.mockReturnValue(geometry);
    measureVolume.mockReturnValue(88);

    await workerSelf.onmessage?.({
      data: {
        type: "GENERATE_STEPPED",
        requestId: "req-stepped",
        params: {
          ...STEPPED_LAYOUT_DEFAULTS,
          debugOrientation: true,
        },
      },
    } as MessageEvent);

    expect(createSteppedTrayModel).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenNthCalledWith(
      1,
      "[STEPPED_ORIENT]",
      "worker_request",
      expect.objectContaining({
        requestId: "req-stepped",
        spacing: STEPPED_LAYOUT_DEFAULTS.spacing,
        smoothingRadius: STEPPED_LAYOUT_DEFAULTS.smoothingRadius,
      }),
    );
    expect(infoSpy).toHaveBeenNthCalledWith(
      2,
      "[STEPPED_ORIENT]",
      "worker_result",
      { requestId: "req-stepped", volume: 88 },
    );
    expect(workerSelf.postMessage).toHaveBeenCalledWith({
      type: "GENERATION_SUCCESS",
      requestId: "req-stepped",
      geometry,
      volumeInfo: 88,
    });
  });

  it("posts generation success for stepped cad requests", async () => {
    const workerSelf = await loadWorkerModule();
    const geometry = { id: "stepped-cad-geom" };
    createSteppedCadTrayModel.mockReturnValue(geometry);
    measureVolume.mockReturnValue(66);

    await workerSelf.onmessage?.({
      data: {
        type: "GENERATE_STEPPED_CAD",
        requestId: "req-stepped-cad",
        params: STEPPED_LAYOUT_DEFAULTS,
      },
    } as MessageEvent);

    expect(createSteppedCadTrayModel).toHaveBeenCalledWith(
      STEPPED_LAYOUT_DEFAULTS,
    );
    expect(workerSelf.postMessage).toHaveBeenCalledWith({
      type: "GENERATION_SUCCESS",
      requestId: "req-stepped-cad",
      geometry,
      volumeInfo: 66,
    });
  });

  it("posts outline preview timing for stepped preview requests", async () => {
    const workerSelf = await loadWorkerModule();
    const preview = [{ key: "group-a", points: [] }];
    buildSteppedOutlinePreview.mockReturnValue(preview);
    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValueOnce(10).mockReturnValueOnce(17.5);

    await workerSelf.onmessage?.({
      data: {
        type: "GENERATE_STEPPED_OUTLINE_PREVIEW",
        requestId: "req-preview",
        params: STEPPED_LAYOUT_DEFAULTS,
      },
    } as MessageEvent);

    expect(buildSteppedOutlinePreview).toHaveBeenCalledWith(
      STEPPED_LAYOUT_DEFAULTS,
    );
    expect(workerSelf.postMessage).toHaveBeenCalledWith({
      type: "STEPPED_OUTLINE_PREVIEW_SUCCESS",
      requestId: "req-preview",
      outlinePreview: preview,
      durationMs: 7.5,
    });
  });

  it("posts stepped cad split parts for split preview requests", async () => {
    const workerSelf = await loadWorkerModule();
    const parts = [
      {
        index: 0,
        filenameLabel: "part_01_cad_low",
        label: "低组",
        fromHeight: 0,
        toHeight: 10,
        geometry: { id: "cad-split-geom" },
      },
    ];
    createSteppedCadSplitParts.mockReturnValue(parts);

    await workerSelf.onmessage?.({
      data: {
        type: "GENERATE_STEPPED_CAD_SPLIT_PARTS",
        requestId: "req-cad-split",
        params: STEPPED_LAYOUT_DEFAULTS,
      },
    } as MessageEvent);

    expect(createSteppedCadSplitParts).toHaveBeenCalledWith(
      STEPPED_LAYOUT_DEFAULTS,
    );
    expect(workerSelf.postMessage).toHaveBeenCalledWith({
      type: "STEPPED_SPLIT_PARTS_SUCCESS",
      requestId: "req-cad-split",
      parts,
    });
  });

  it("serializes STL exports into a blob response", async () => {
    const workerSelf = await loadWorkerModule();
    serialize.mockReturnValue([new Uint8Array([1, 2, 3])]);

    await workerSelf.onmessage?.({
      data: {
        type: "EXPORT_STL",
        requestId: "req-export",
        geometry: { id: "geom" },
        filename: "tray.stl",
      },
    } as MessageEvent);

    expect(serialize).toHaveBeenCalledWith(
      { binary: true },
      { id: "geom" },
    );
    expect(workerSelf.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "EXPORT_SUCCESS",
        requestId: "req-export",
        filename: "tray.stl",
        blob: expect.any(Blob),
      }),
    );
  });

  it("posts structured errors for thrown failures", async () => {
    const workerSelf = await loadWorkerModule();
    createCustomTrayModel.mockImplementation(() => {
      throw new Error("custom failed");
    });

    await workerSelf.onmessage?.({
      data: {
        type: "GENERATE_CUSTOM",
        requestId: "req-custom",
        params: CUSTOM_LAYOUT_DEFAULTS,
      },
    } as MessageEvent);

    expect(workerSelf.postMessage).toHaveBeenCalledWith({
      type: "ERROR",
      requestId: "req-custom",
      message: "custom failed",
    });
  });
});
