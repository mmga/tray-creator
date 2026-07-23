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
    expect(exportModel).toHaveBeenCalledWith({ rows: 2 }, secondGeometry);
  });

  it("Snapshot 校验失败时同时阻断生成和导出", async () => {
    const generatePreview = vi.fn();
    const exportModel = vi.fn();
    const { result } = renderHook(() =>
      usePreviewLifecycle({
        getParams: () => ({ rows: 1 }),
        captureSnapshot: (current) => current,
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
});
