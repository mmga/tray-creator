import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";

const createTrayModel = vi.fn();
const createCustomTrayModel = vi.fn();
const createBaseConverterModel = vi.fn();
const createSteppedCadTrayModel = vi.fn();
const createSteppedCadSplitParts = vi.fn();
const buildSteppedOutlinePreview = vi.fn();
const serialize = vi.fn();
const measureVolume = vi.fn();
const createStackableBoxLid = vi.fn();
const composeBoxAndLidPreview = vi.fn();
const createBoxSideBySidePreviewSpacing = vi.fn();

vi.mock("../tray-model", () => ({
  createTrayModel,
}));

vi.mock("../custom-tray-model", () => ({
  createCustomTrayModel,
}));

vi.mock("../base-converter-model", () => ({
  createBaseConverterModel,
}));

vi.mock("../stepped-cad-construction", () => ({
  createSteppedCadSplitParts,
  createSteppedCadTrayModel,
}));

vi.mock("../stepped-outline-preview", () => ({
  buildSteppedOutlinePreview,
}));

vi.mock("../stackable-box-model", () => ({
  createStackableBoxLid,
  composeBoxAndLidPreview,
  createBoxSideBySidePreviewSpacing,
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
  it("自定义直边请求在 Worker 内构造真实轮廓", async () => {
    const workerSelf = await loadWorkerModule();
    const params = { ...CUSTOM_LAYOUT_DEFAULTS, footprintStyle: "polygonal",
      slots: [{ id: "a", x: 20, y: 20, shape: "circle", width: 25, height: 25, rotation: 0 }] };
    createCustomTrayModel.mockReturnValue({ id: "polygon" });
    await workerSelf.onmessage?.({ data: { type: "GENERATE_CUSTOM", requestId: "polygon", params } } as MessageEvent);
    expect(createCustomTrayModel).toHaveBeenCalledWith(params, expect.objectContaining({
      status: "ready", value: expect.objectContaining({ bodyCount: 1 }),
    }));
  });

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

  it("returns a combined preview and split volumes for an enabled box", async () => {
    const workerSelf = await loadWorkerModule();
    const geometry = { id: "grid-geom" };
    const lid = { id: "lid-geom" };
    const preview = { id: "preview-geom" };
    createTrayModel.mockReturnValue(geometry);
    createStackableBoxLid.mockReturnValue(lid);
    createBoxSideBySidePreviewSpacing.mockReturnValue(60);
    composeBoxAndLidPreview.mockReturnValue(preview);
    measureVolume.mockReturnValueOnce(100).mockReturnValueOnce(20);

    const boxParams = {
      ...DEFAULT_TRAY_PARAMS,
      stackableBox: {
        ...DEFAULT_TRAY_PARAMS.stackableBox!,
        enabled: true,
        outerWidth: 200,
        outerDepth: 150,
        outerHeight: 50,
      },
    };

    await workerSelf.onmessage?.({
      data: { type: "GENERATE_GRID", requestId: "req-box", params: boxParams },
    } as MessageEvent);

    expect(createStackableBoxLid).toHaveBeenCalled();
    expect(composeBoxAndLidPreview).toHaveBeenCalledWith(geometry, lid, 60);
    expect(workerSelf.postMessage).toHaveBeenCalledWith({
      type: "GENERATION_SUCCESS",
      requestId: "req-box",
      geometry: preview,
      volumeInfo: 120,
      bodyVolume: 100,
      lidVolume: 20,
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

  it("posts stepped generation success without debug logging", async () => {
    const workerSelf = await loadWorkerModule();
    const geometry = { id: "stepped-geom" };
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    createSteppedCadTrayModel.mockReturnValue(geometry);
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

    expect(createSteppedCadTrayModel).toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(workerSelf.postMessage).toHaveBeenCalledWith({
      type: "GENERATION_SUCCESS",
      requestId: "req-stepped",
      geometry,
      volumeInfo: 88,
    });
  });

  it("uses the CAD height-band backend for stepped requests", async () => {
    const workerSelf = await loadWorkerModule();
    const geometry = { id: "stepped-cad-geom" };
    createSteppedCadTrayModel.mockReturnValue(geometry);
    measureVolume.mockReturnValue(66);

    await workerSelf.onmessage?.({
      data: {
        type: "GENERATE_STEPPED",
        requestId: "req-stepped-cad",
        params: STEPPED_LAYOUT_DEFAULTS,
      },
    } as MessageEvent);

    expect(createSteppedCadTrayModel).toHaveBeenCalledWith(
      STEPPED_LAYOUT_DEFAULTS,
      expect.objectContaining({ status: "ready" }),
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
      expect.objectContaining({ status: "ready" }),
    );
    expect(workerSelf.postMessage).toHaveBeenCalledWith({
      type: "STEPPED_OUTLINE_PREVIEW_SUCCESS",
      requestId: "req-preview",
      outlinePreview: preview,
      durationMs: 7.5,
    });
  });

  it("posts stepped split parts for split preview requests", async () => {
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
        type: "GENERATE_STEPPED_SPLIT_PARTS",
        requestId: "req-cad-split",
        params: STEPPED_LAYOUT_DEFAULTS,
      },
    } as MessageEvent);

    expect(createSteppedCadSplitParts).toHaveBeenCalledWith(
      STEPPED_LAYOUT_DEFAULTS,
      expect.objectContaining({ status: "ready" }),
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
