import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { browserDownloadPort } from "@/lib/download-port";

const {
  generateCustomPreviewMock,
  exportCustomModelFilesMock,
  toastMock,
  trayWorkerServiceMock,
  randomIdFactoryMock,
} = vi.hoisted(() => ({
  generateCustomPreviewMock: vi.fn(),
  exportCustomModelFilesMock: vi.fn(),
  toastMock: vi.fn(),
  trayWorkerServiceMock: {
    generateCustom: vi.fn(),
    exportSTL: vi.fn(),
  },
  randomIdFactoryMock: {
    createId: vi.fn(),
  },
}));

vi.mock("@/lib/custom-layout-service", () => ({
  generateCustomPreview: generateCustomPreviewMock,
  exportCustomModelFiles: exportCustomModelFilesMock,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/worker/worker-service", () => ({
  trayWorkerService: trayWorkerServiceMock,
}));

vi.mock("@/lib/id-factory", () => ({
  randomIdFactory: randomIdFactoryMock,
}));

import { useCustomLayout } from "@/hooks/useCustomLayout";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useCustomLayout", () => {
  beforeEach(() => {
    generateCustomPreviewMock.mockReset();
    exportCustomModelFilesMock.mockReset();
    toastMock.mockReset();
    trayWorkerServiceMock.generateCustom.mockReset();
    trayWorkerServiceMock.exportSTL.mockReset();
    randomIdFactoryMock.createId.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates params, keeps spacing-linked fields in sync, and computes extents", () => {
    const { result } = renderHook(() => useCustomLayout());

    expect(result.current.params).toEqual(CUSTOM_LAYOUT_DEFAULTS);
    expect(result.current.effectiveDimensions.width).toBe(0);
    expect(result.current.isPreviewStale).toBe(false);

    act(() => {
      result.current.updateParam("spacing", 8);
    });

    expect(result.current.params.spacing).toBe(8);
    expect(result.current.params.boundarySpacing).toBe(8);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.isPreviewStale).toBe(true);
  });

  it("adds, inserts, duplicates, trims, and removes slots", () => {
    randomIdFactoryMock.createId
      .mockReturnValueOnce("slot-1")
      .mockReturnValueOnce("slot-2")
      .mockReturnValueOnce("copy-1");

    const { result } = renderHook(() => useCustomLayout());

    act(() => {
      result.current.addSlot(25);
    });
    expect(result.current.params.slots[0]).toMatchObject({
      id: "slot-1",
      x: 130,
      y: 130,
      shape: "circle",
    });

    act(() => {
      result.current.insertSlots([
        {
          x: 60,
          y: 80,
          shape: "ellipse",
          width: 30,
          height: 20,
          rotation: 15,
        },
      ]);
    });
    expect(result.current.params.slots[1]).toMatchObject({
      id: "slot-2",
      shape: "ellipse",
    });

    let duplicatedIds: string[] = [];
    act(() => {
      duplicatedIds = result.current.duplicateSlots(["slot-1"]);
    });
    expect(duplicatedIds).toEqual(["copy-1"]);
    expect(result.current.params.slots.at(-1)).toMatchObject({
      id: "copy-1",
      x: 140,
      y: 120,
    });

    act(() => {
      result.current.trimBaseplate();
    });
    expect(result.current.params.trayWidth).toBeGreaterThan(0);
    expect(result.current.params.trayDepth).toBeGreaterThan(0);

    act(() => {
      result.current.removeSlot("slot-2");
    });
    expect(result.current.params.slots.map((slot) => slot.id)).not.toContain(
      "slot-2",
    );
  });

  it("supports snapshots, live updates, and undo", () => {
    vi.useFakeTimers();
    randomIdFactoryMock.createId.mockReturnValue("slot-1");
    const { result } = renderHook(() => useCustomLayout());

    act(() => {
      result.current.addSlot(25);
    });

    act(() => {
      vi.advanceTimersByTime(600);
      result.current.saveSnapshot();
      result.current.updateSlotPosition("slot-1", 50, 60);
    });
    expect(result.current.params.slots[0]).toMatchObject({ x: 50, y: 60 });

    act(() => {
      result.current.undo();
    });
    expect(result.current.params.slots[0]).toMatchObject({ x: 130, y: 130 });

    act(() => {
      result.current.updateMultipleSlots([{ id: "slot-1", x: 70, y: 90, rotation: 45 }]);
    });
    expect(result.current.params.slots[0]).toMatchObject({
      x: 70,
      y: 90,
      rotation: 45,
    });

    act(() => {
      result.current.undo();
    });
    expect(result.current.params.slots[0]).toMatchObject({
      x: 130,
      y: 130,
      rotation: 0,
    });

    act(() => {
      result.current.updateMultipleSlotsLive([
        { id: "slot-1", x: 90, y: 95, rotation: 30 },
      ]);
    });
    expect(result.current.params.slots[0]).toMatchObject({
      x: 90,
      y: 95,
      rotation: 30,
    });
  });

  it("generates previews and exports the current custom layout", async () => {
    randomIdFactoryMock.createId.mockReturnValue("slot-1");
    const geometry = { id: "geom-1" } as never;
    const threeGeometry = { dispose: vi.fn() };
    const refreshedGeometry = { id: "geom-2" } as never;
    const secondThreeGeometry = { dispose: vi.fn() };
    const deferred = createDeferred<{
      geometry: never;
      threeGeometry: never;
      volume: number;
    }>();

    generateCustomPreviewMock
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce({
        geometry: { id: "geom-2" } as never,
        threeGeometry: secondThreeGeometry as never,
        volume: 40,
      });
    exportCustomModelFilesMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCustomLayout());

    act(() => {
      result.current.addSlot(25);
    });

    act(() => {
      void result.current.handleGenerate();
    });
    expect(result.current.isGenerating).toBe(true);

    deferred.resolve({
      geometry,
      threeGeometry: threeGeometry as never,
      volume: 25,
    });
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });

    expect(result.current.threeGeometry).toBe(threeGeometry as never);
    expect(result.current.volume).toBe(25);
    expect(result.current.isPreviewStale).toBe(false);

    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(exportCustomModelFilesMock).toHaveBeenCalledWith(
      result.current.params,
      result.current.effectiveDimensions,
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

    expect(exportCustomModelFilesMock).toHaveBeenLastCalledWith(
      result.current.params,
      result.current.effectiveDimensions,
      refreshedGeometry,
      trayWorkerServiceMock,
      browserDownloadPort,
    );
    expect(threeGeometry.dispose).toHaveBeenCalledTimes(1);
  });

  it("surfaces generation and export failures through toast messages", async () => {
    randomIdFactoryMock.createId.mockReturnValue("slot-1");
    generateCustomPreviewMock.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useCustomLayout());

    act(() => {
      result.current.addSlot(25);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(toastMock).toHaveBeenCalledWith("error", "模型生成失败：boom");

    const geometry = { id: "geom" } as never;
    generateCustomPreviewMock.mockResolvedValueOnce({
      geometry,
      threeGeometry: { dispose: vi.fn() } as never,
      volume: 10,
    });
    exportCustomModelFilesMock.mockRejectedValueOnce(new Error("export failed"));

    await act(async () => {
      await result.current.handleGenerate();
    });
    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(toastMock).toHaveBeenCalledWith("error", "STL 导出失败：export failed");

    act(() => {
      result.current.updateParam("spacing", 9);
    });
    generateCustomPreviewMock.mockRejectedValueOnce(new Error("still boom"));
    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(toastMock).toHaveBeenCalledWith("error", "模型生成失败：still boom");
  });
});
