import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { browserDownloadPort } from "@/lib/download-port";

const {
  generateGridPreviewMock,
  exportGridModelFilesMock,
  toastMock,
  trayWorkerServiceMock,
} = vi.hoisted(() => ({
  generateGridPreviewMock: vi.fn(),
  exportGridModelFilesMock: vi.fn(),
  toastMock: vi.fn(),
  trayWorkerServiceMock: {
    generateGrid: vi.fn(),
    exportSTL: vi.fn(),
  },
}));

vi.mock("@/lib/grid-model-service", () => ({
  generateGridPreview: generateGridPreviewMock,
  exportGridModelFiles: exportGridModelFilesMock,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/worker/worker-service", () => ({
  trayWorkerService: trayWorkerServiceMock,
}));

import { useTrayModel } from "@/hooks/useTrayModel";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useTrayModel", () => {
  beforeEach(() => {
    generateGridPreviewMock.mockReset();
    exportGridModelFilesMock.mockReset();
    toastMock.mockReset();
    trayWorkerServiceMock.generateGrid.mockReset();
    trayWorkerServiceMock.exportSTL.mockReset();
  });

  it("复用权威 Base-hole Construction Plan 的违规集合", () => {
    const { result } = renderHook(() => useTrayModel());

    expect(result.current.baseHoleFitViolations).toBe(
      result.current.baseHolePlan.violations,
    );
  });

  it("updates params, replaces params, and resets defaults while marking previews stale", () => {
    const { result } = renderHook(() => useTrayModel());

    expect(result.current.params).toEqual(DEFAULT_TRAY_PARAMS);
    expect(result.current.isPreviewStale).toBe(false);

    act(() => {
      result.current.updateParam("spacing", 8);
    });
    expect(result.current.params.spacing).toBe(8);
    expect(result.current.params.boundarySpacing).toBe(8);
    expect(result.current.isPreviewStale).toBe(true);

    act(() => {
      result.current.replaceParams({
        ...DEFAULT_TRAY_PARAMS,
        spacing: 7,
        boundarySpacingIndependent: true,
        boundarySpacing: 11,
      });
    });
    expect(result.current.params.spacing).toBe(7);
    expect(result.current.params.boundarySpacing).toBe(11);

    act(() => {
      result.current.resetParams();
    });
    expect(result.current.params).toEqual(DEFAULT_TRAY_PARAMS);
    expect(result.current.isPreviewStale).toBe(true);
  });

  it("generates previews, disposes the old geometry, and clears stale state", async () => {
    const firstGeometry = { id: "geom-1" } as never;
    const secondGeometry = { id: "geom-2" } as never;
    const firstThreeGeometry = { dispose: vi.fn() };
    const secondThreeGeometry = { dispose: vi.fn() };
    const firstDeferred = createDeferred<{
      geometry: never;
      threeGeometry: never;
      volume: number;
    }>();
    const secondDeferred = createDeferred<{
      geometry: never;
      threeGeometry: never;
      volume: number;
    }>();

    generateGridPreviewMock
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);

    const { result } = renderHook(() => useTrayModel());

    act(() => {
      result.current.updateParam("rows", 6);
    });

    act(() => {
      void result.current.handleGenerate();
    });
    expect(result.current.isGenerating).toBe(true);

    firstDeferred.resolve({
      geometry: firstGeometry,
      threeGeometry: firstThreeGeometry as never,
      volume: 1234,
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });
    expect(result.current.threeGeometry).toBe(firstThreeGeometry);
    expect(result.current.volume).toBe(1234);
    expect(result.current.isPreviewStale).toBe(false);
    expect(generateGridPreviewMock).toHaveBeenCalledWith(
      result.current.params,
      trayWorkerServiceMock,
    );

    act(() => {
      result.current.updateParam("columns", 4);
    });
    act(() => {
      void result.current.handleGenerate();
    });

    secondDeferred.resolve({
      geometry: secondGeometry,
      threeGeometry: secondThreeGeometry as never,
      volume: 5678,
    });

    await waitFor(() => {
      expect(result.current.threeGeometry).toBe(secondThreeGeometry);
    });
    expect(firstThreeGeometry.dispose).toHaveBeenCalledTimes(1);
    expect(result.current.volume).toBe(5678);
  });

  it("surfaces generation and export failures through toast messages", async () => {
    generateGridPreviewMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useTrayModel());

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(toastMock).toHaveBeenCalledWith("error", "模型生成失败：boom");

    act(() => {
      result.current.updateParam("spacing", 9);
    });
    generateGridPreviewMock.mockRejectedValueOnce(new Error("still boom"));
    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(toastMock).toHaveBeenCalledWith(
      "error",
      "模型生成失败：still boom",
    );
  });

  it("底板孔位不适配时阻断模型生成和导出", async () => {
    const { result } = renderHook(() => useTrayModel());

    act(() => result.current.updateParam("holeDiameter", 10));
    act(() => result.current.updateParam("baseHoleStructure", "magnet-post-hole"));
    act(() => result.current.updateParam("magnetPostHoleDiameter", 15));

    expect(result.current.baseHoleFitViolations).not.toHaveLength(0);
    expect(result.current.baseHoleFitBlockingReason).toContain("底板孔位不适配");

    await act(async () => {
      await result.current.handleGenerate();
      await result.current.handleExportSTL();
    });

    expect(generateGridPreviewMock).not.toHaveBeenCalled();
    expect(exportGridModelFilesMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("磁铁桩孔直径 15mm"),
    );
  });

  it("exports generated geometry with the worker service and browser download port", async () => {
    const geometry = { id: "geom" } as never;
    const threeGeometry = { dispose: vi.fn() };
    const refreshedGeometry = { id: "geom-2" } as never;
    const refreshedThreeGeometry = { dispose: vi.fn() };
    generateGridPreviewMock.mockResolvedValueOnce({
      geometry,
      threeGeometry: threeGeometry as never,
      volume: 100,
    });
    generateGridPreviewMock.mockResolvedValueOnce({
      geometry: refreshedGeometry,
      threeGeometry: refreshedThreeGeometry as never,
      volume: 101,
    });
    exportGridModelFilesMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTrayModel());

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleExportSTL();
    });

    expect(exportGridModelFilesMock).toHaveBeenCalledWith(
      { mode: "grid", params: result.current.params },
      geometry,
      trayWorkerServiceMock,
      browserDownloadPort,
    );

    act(() => {
      result.current.updateParam("spacing", 9);
    });
    await act(async () => {
      await result.current.handleExportSTL();
    });

    expect(exportGridModelFilesMock).toHaveBeenLastCalledWith(
      { mode: "grid", params: result.current.params },
      refreshedGeometry,
      trayWorkerServiceMock,
      browserDownloadPort,
    );

    exportGridModelFilesMock.mockRejectedValueOnce(new Error("export failed"));
    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(toastMock).toHaveBeenCalledWith("error", "STL 导出失败：export failed");
  });
});
