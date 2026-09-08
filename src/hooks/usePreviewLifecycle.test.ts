import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreviewLifecycle } from "@/hooks/usePreviewLifecycle";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

describe("usePreviewLifecycle", () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it("当前 Snapshot 指纹变化时重新生成几何后再导出", async () => {
    let params = { rows: 1 };
    const firstGeometry = { id: "first" } as never;
    const secondGeometry = { id: "second" } as never;
    const generatePreview = vi
      .fn()
      .mockResolvedValueOnce({
        geometry: firstGeometry,
        threeGeometry: { dispose: vi.fn() },
        volume: 1,
      })
      .mockResolvedValueOnce({
        geometry: secondGeometry,
        threeGeometry: { dispose: vi.fn() },
        volume: 2,
      });
    const exportModel = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      usePreviewLifecycle({
        getParams: () => params,
        captureSnapshot: (current) => structuredClone(current),
        captureExportContext: () => undefined,
        fingerprintSnapshot: (snapshot) => JSON.stringify(snapshot),
        generatePreview,
        exportModel,
      }),
    );

    await act(async () => {
      await result.current.handleGenerate();
    });

    params = { rows: 2 };
    await act(async () => {
      await result.current.handleExportSTL();
    });

    expect(generatePreview).toHaveBeenCalledTimes(2);
    expect(generatePreview).toHaveBeenLastCalledWith({ rows: 2 });
    expect(exportModel).toHaveBeenCalledWith(
      { rows: 2 },
      secondGeometry,
      undefined,
    );
  });

  it("导出开始时原子捕获上下文，并在 Snapshot 失效后继续导出旧几何", async () => {
    let params = { rows: 1 };
    const deferred = createDeferred<{
      geometry: never;
      threeGeometry: { dispose: () => void };
      volume: number;
    }>();
    const geometry = { id: "exported" } as never;
    const threeGeometry = { dispose: vi.fn() };
    const exportModel = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePreviewLifecycle({
        getParams: () => params,
        captureSnapshot: (current: { rows: number }) =>
          structuredClone(current),
        captureExportContext: (snapshot) => ({
          rowsAtExportStart: snapshot.rows,
        }),
        fingerprintSnapshot: JSON.stringify,
        generatePreview: vi.fn().mockReturnValue(deferred.promise),
        exportModel,
      }),
    );
    let exportPromise: Promise<void> | undefined;

    act(() => {
      exportPromise = result.current.handleExportSTL();
    });
    params = { rows: 2 };
    act(() => {
      result.current.invalidatePreview();
    });
    deferred.resolve({ geometry, threeGeometry, volume: 1 });
    await act(async () => {
      await exportPromise;
    });

    expect(exportModel).toHaveBeenCalledWith(
      { rows: 1 },
      geometry,
      { rowsAtExportStart: 1 },
    );
    expect(threeGeometry.dispose).toHaveBeenCalledTimes(1);
    expect(result.current.threeGeometry).toBeNull();
    expect(result.current.isPreviewStale).toBe(true);
  });

  it("Snapshot 校验失败时同时阻断生成和导出", async () => {
    const generatePreview = vi.fn();
    const exportModel = vi.fn();
    const { result } = renderHook(() =>
      usePreviewLifecycle({
        getParams: () => ({ rows: 1 }),
        captureSnapshot: (current) => current,
        captureExportContext: () => undefined,
        fingerprintSnapshot: JSON.stringify,
        generatePreview,
        exportModel,
        validateSnapshot: () => "底板孔位不适配",
      }),
    );

    await act(async () => {
      await result.current.handleGenerate();
      await result.current.handleExportSTL();
    });

    expect(generatePreview).not.toHaveBeenCalled();
    expect(exportModel).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith("error", "底板孔位不适配");
  });

  it("旧请求结束时不会清除新请求的 loading", async () => {
    const first = createDeferred<{
      geometry: never;
      threeGeometry: { dispose: () => void };
      volume: number;
    }>();
    const second = createDeferred<{
      geometry: never;
      threeGeometry: { dispose: () => void };
      volume: number;
    }>();
    const firstGeometry = { dispose: vi.fn() };
    const secondGeometry = { dispose: vi.fn() };
    const generatePreview = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() =>
      usePreviewLifecycle({
        getParams: () => ({ rows: 1 }),
        captureSnapshot: (current) => current,
        captureExportContext: () => undefined,
        fingerprintSnapshot: JSON.stringify,
        generatePreview,
        exportModel: vi.fn(),
      }),
    );

    act(() => { void result.current.handleGenerate(); });
    act(() => { void result.current.handleGenerate(); });
    first.resolve({ geometry: {} as never, threeGeometry: firstGeometry, volume: 1 });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.isGenerating).toBe(true);

    second.resolve({ geometry: {} as never, threeGeometry: secondGeometry, volume: 2 });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.isGenerating).toBe(false);
    expect(firstGeometry.dispose).toHaveBeenCalledTimes(1);
  });

  it("卸载时释放当前预览几何体", async () => {
    const threeGeometry = { dispose: vi.fn() };
    const { result, unmount } = renderHook(() =>
      usePreviewLifecycle({
        getParams: () => ({ rows: 1 }),
        captureSnapshot: (current) => current,
        captureExportContext: () => undefined,
        fingerprintSnapshot: JSON.stringify,
        generatePreview: vi.fn().mockResolvedValue({
          geometry: {} as never,
          threeGeometry,
          volume: 1,
        }),
        exportModel: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleGenerate();
    });
    unmount();

    expect(threeGeometry.dispose).toHaveBeenCalledTimes(1);
  });

  it("卸载后释放迟到请求的几何体而不接纳结果", async () => {
    const deferred = createDeferred<{
      geometry: never;
      threeGeometry: { dispose: () => void };
      volume: number;
    }>();
    const threeGeometry = { dispose: vi.fn() };
    const { result, unmount } = renderHook(() =>
      usePreviewLifecycle({
        getParams: () => ({ rows: 1 }),
        captureSnapshot: (current) => current,
        captureExportContext: () => undefined,
        fingerprintSnapshot: JSON.stringify,
        generatePreview: vi.fn().mockReturnValue(deferred.promise),
        exportModel: vi.fn(),
      }),
    );

    act(() => {
      void result.current.handleGenerate();
    });
    unmount();
    deferred.resolve({
      geometry: {} as never,
      threeGeometry,
      volume: 1,
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(threeGeometry.dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps box volume breakdowns and clears them on invalidate", async () => {
    const geometry = { id: "box" } as never;
    const threeGeometry = { dispose: vi.fn() };
    const generatePreview = vi.fn().mockResolvedValue({
      geometry,
      threeGeometry,
      volume: 120,
      bodyVolume: 100,
      lidVolume: 20,
    });
    const { result } = renderHook(() =>
      usePreviewLifecycle({
        getParams: () => ({ rows: 1 }),
        captureSnapshot: (current: { rows: number }) =>
          structuredClone(current),
        captureExportContext: () => undefined,
        fingerprintSnapshot: JSON.stringify,
        generatePreview,
        exportModel: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.volume).toBe(120);
    expect(result.current.bodyVolume).toBe(100);
    expect(result.current.lidVolume).toBe(20);

    act(() => {
      result.current.invalidatePreview();
    });

    expect(result.current.volume).toBe(0);
    expect(result.current.bodyVolume).toBeUndefined();
    expect(result.current.lidVolume).toBeUndefined();
  });
});
