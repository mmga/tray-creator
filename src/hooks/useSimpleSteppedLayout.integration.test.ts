import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BUILD_SIZE } from "@/lib/config";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";

const {
  toastMock,
  trayWorkerServiceMock,
  downloadParamFileMock,
  jscadToThreeGeometryMock,
} = vi.hoisted(() => ({
  toastMock: vi.fn(),
  trayWorkerServiceMock: {
    generateSimpleStepped: vi.fn().mockResolvedValue(null),
    exportSTL: vi.fn(),
  },
  downloadParamFileMock: vi.fn(),
  jscadToThreeGeometryMock: vi.fn(),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/worker/worker-service", () => ({
  trayWorkerService: trayWorkerServiceMock,
}));

vi.mock("@/lib/param-download", async () => {
  const actual = await vi.importActual<typeof import("@/lib/param-download")>(
    "@/lib/param-download",
  );
  return {
    ...actual,
    downloadParamFile: downloadParamFileMock,
  };
});

vi.mock("@/lib/jscad-to-three", () => ({
  jscadToThreeGeometry: jscadToThreeGeometryMock,
}));

import { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useSimpleSteppedLayout", () => {
  beforeEach(() => {
    toastMock.mockReset();
    trayWorkerServiceMock.generateSimpleStepped.mockReset();
    trayWorkerServiceMock.exportSTL.mockReset();
    trayWorkerServiceMock.generateSimpleStepped.mockResolvedValue({
      geometry: { id: "default-geom" } as never,
      volume: 0,
    });
    trayWorkerServiceMock.exportSTL.mockResolvedValue({
      blob: new Blob(["stl"]),
      filename: "default.stl",
    });
    downloadParamFileMock.mockReset();
    jscadToThreeGeometryMock.mockReset();
    jscadToThreeGeometryMock.mockReturnValue({ dispose: vi.fn() } as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("manages rows and slots while keeping outer margin in sync with spacing", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("row-1")
      .mockReturnValueOnce("slot-1");

    const { result } = renderHook(() => useSimpleSteppedLayout());

    expect(result.current.params).toEqual(SIMPLE_STEPPED_LAYOUT_DEFAULTS);
    expect(result.current.derivedLayout.activeRows).toEqual([]);
    expect(result.current.isPreviewStale).toBe(false);

    act(() => {
      result.current.addRow();
    });
    expect(result.current.activeRowId).toBe("row-1");
    expect(result.current.params.rows[0]).toMatchObject({
      id: "row-1",
      name: "行 1",
      slotIds: [],
    });
    expect(result.current.isPreviewStale).toBe(true);

    act(() => {
      result.current.addSlotToRow("row-1", 25);
    });
    expect(result.current.params.slots[0]).toMatchObject({
      id: "slot-1",
      rowId: "row-1",
      diameter: 25,
      x: 0,
      y: 0,
    });
    expect(result.current.params.rows[0]?.slotIds).toEqual(["slot-1"]);

    act(() => {
      result.current.updateParam("spacing", 8);
    });
    expect(result.current.params.spacing).toBe(8);
    expect(result.current.params.outerMargin).toBe(8);

    act(() => {
      result.current.updateParam("outerMarginIndependent", true);
      result.current.updateParam("outerMargin", 12);
      result.current.updateParam("spacing", 9);
    });
    expect(result.current.params.outerMarginIndependent).toBe(true);
    expect(result.current.params.outerMargin).toBe(12);
    expect(result.current.canvasParams.boundarySpacing).toBe(12);
    expect(result.current.canvasParams.boundarySpacingIndependent).toBe(true);
    expect(result.current.derivedLayout.activeRows).toHaveLength(1);
    expect(result.current.effectiveDimensions.height).toBe(
      result.current.params.firstRowHeight,
    );
  });

  it("supports row reordering, slot duplication, tray trimming, and undo", () => {
    vi.useFakeTimers();
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("row-1")
      .mockReturnValueOnce("row-2")
      .mockReturnValueOnce("slot-1")
      .mockReturnValueOnce("slot-2")
      .mockReturnValueOnce("copy-1");

    const { result } = renderHook(() => useSimpleSteppedLayout());

    act(() => {
      result.current.addRow();
      result.current.addRow();
      result.current.addSlotToRow("row-1", 25);
      result.current.addSlotToRow("row-2", 40);
    });
    expect(result.current.params.rows.map((row) => row.id)).toEqual([
      "row-1",
      "row-2",
    ]);

    act(() => {
      result.current.reorderRows(1, 0);
    });
    expect(result.current.params.rows.map((row) => row.id)).toEqual([
      "row-2",
      "row-1",
    ]);

    let duplicatedIds: string[] = [];
    act(() => {
      duplicatedIds = result.current.duplicateSlots(["slot-1"]);
    });
    expect(duplicatedIds).toEqual(["copy-1"]);
    expect(result.current.params.slots.find((slot) => slot.id === "copy-1"))
      .toMatchObject({
        rowId: "row-1",
        diameter: 25,
        x: 30.2,
      });

    act(() => {
      result.current.resizeTray(200, 180);
    });
    expect(result.current.params.trayWidth).toBe(200);
    expect(result.current.params.trayDepth).toBe(180);

    act(() => {
      result.current.trimTray();
    });
    expect(result.current.params.trayWidth).toBeLessThan(200);
    expect(result.current.params.trayDepth).toBeLessThan(180);

    act(() => {
      vi.advanceTimersByTime(600);
      result.current.removeRow("row-2");
    });
    expect(result.current.params.rows.map((row) => row.id)).toEqual(["row-1"]);
    expect(result.current.params.slots.map((slot) => slot.id)).not.toContain(
      "slot-2",
    );

    act(() => {
      result.current.undo();
    });
    expect(result.current.params.rows.map((row) => row.id)).toContain("row-2");
    expect(result.current.params.slots.map((slot) => slot.id)).toContain(
      "slot-2",
    );
  });

  it("keeps content-required tray size above the build warning threshold during runtime edits", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("row-1")
      .mockReturnValueOnce("slot-1")
      .mockReturnValueOnce("slot-2");

    const { result } = renderHook(() => useSimpleSteppedLayout());

    act(() => {
      result.current.addRow();
    });
    act(() => {
      result.current.addSlotToRow("row-1", 100);
    });
    act(() => {
      result.current.addSlotToRow("row-1", 100);
    });
    act(() => {
      result.current.setParams((prev) => ({
        ...prev,
        slots: prev.slots.map((slot) =>
          slot.id === "slot-1"
            ? { ...slot, x: -MAX_BUILD_SIZE }
            : slot.id === "slot-2"
              ? { ...slot, x: MAX_BUILD_SIZE }
              : slot,
        ),
      }));
    });

    expect(result.current.params.trayWidth).toBeGreaterThan(MAX_BUILD_SIZE);
    expect(result.current.isPreviewStale).toBe(true);
  });

  it("generates previews and exports the current simple stepped layout", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("row-1")
      .mockReturnValueOnce("slot-1");
    const anchor = document.createElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => {});
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(anchor);

    const geometry = { id: "geom-1" } as never;
    const deferred = createDeferred<{ geometry: never; volume: number }>();
    const firstThreeGeometry = { dispose: vi.fn() };
    const secondThreeGeometry = { dispose: vi.fn() };

    trayWorkerServiceMock.generateSimpleStepped
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce({
        geometry: { id: "geom-2" } as never,
        volume: 40,
      });
    trayWorkerServiceMock.exportSTL.mockResolvedValue({
      blob: new Blob(["stl"]),
      filename: "ignored.stl",
    });
    jscadToThreeGeometryMock
      .mockReturnValueOnce(firstThreeGeometry as never)
      .mockReturnValueOnce(secondThreeGeometry as never);

    const { result } = renderHook(() => useSimpleSteppedLayout());

    act(() => {
      result.current.addRow();
      result.current.addSlotToRow("row-1", 25);
    });

    act(() => {
      void result.current.handleGenerate();
    });
    expect(result.current.isGenerating).toBe(true);

    deferred.resolve({
      geometry,
      volume: 25,
    });
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });

    expect(result.current.threeGeometry).toBe(firstThreeGeometry as never);
    expect(result.current.volume).toBe(25);
    expect(result.current.isPreviewStale).toBe(false);

    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(trayWorkerServiceMock.exportSTL).toHaveBeenCalledWith(
      geometry,
      expect.stringMatching(/^tray_simple_stepped_.*\.stl$/),
    );
    expect(downloadParamFileMock).toHaveBeenCalledWith(
      {
        mode: "simple-stepped",
        params: result.current.params,
      },
      expect.stringMatching(/^tray_simple_stepped_.*\.json$/),
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.updateParam("spacing", 9);
    });
    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(firstThreeGeometry.dispose).toHaveBeenCalledTimes(1);
    expect(result.current.threeGeometry).toBe(secondThreeGeometry as never);

    createElementSpy.mockRestore();
  });

  it("surfaces generation and export failures through toast messages", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("row-1")
      .mockReturnValueOnce("slot-1");

    const { result } = renderHook(() => useSimpleSteppedLayout());
    const fresh = renderHook(() => useSimpleSteppedLayout());

    await act(async () => {
      await fresh.result.current.handleExportSTL();
    });
    expect(toastMock).not.toHaveBeenCalled();

    act(() => {
      result.current.addRow();
      result.current.addSlotToRow("row-1", 25);
    });

    trayWorkerServiceMock.generateSimpleStepped.mockRejectedValueOnce(
      new Error("boom"),
    );
    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(toastMock).toHaveBeenCalledWith("error", "模型生成失败：boom");
    toastMock.mockClear();

    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(toastMock).not.toHaveBeenCalled();

    trayWorkerServiceMock.generateSimpleStepped.mockResolvedValueOnce({
      geometry: { id: "geom-1" } as never,
      volume: 12,
    });
    jscadToThreeGeometryMock.mockReturnValueOnce({ dispose: vi.fn() } as never);
    trayWorkerServiceMock.exportSTL.mockRejectedValueOnce(new Error("export failed"));
    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(toastMock).toHaveBeenCalledWith(
      "error",
      "STL 导出失败：export failed",
    );
  });
});
