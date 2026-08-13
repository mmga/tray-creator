import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/worker/worker-service", () => ({
  trayWorkerService: null,
}));

import { useBaseConverter } from "@/hooks/useBaseConverter";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";

describe("useBaseConverter", () => {
  it("records discrete parameter changes as undoable edit transactions", () => {
    const { result } = renderHook(() => useBaseConverter());

    act(() => result.current.updateParam("floorThickness", 2));
    expect(result.current.params.floorThickness).toBe(2);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.params.floorThickness)
      .toBe(BASE_CONVERTER_DEFAULTS.floorThickness);
  });

  it("uses working parameters for continuous 2D feedback and commits one undo step", () => {
    const { result } = renderHook(() => useBaseConverter());

    act(() => {
      expect(result.current.beginContinuousEdit()).toBe(true);
      result.current.previewParam("conversionClearance", 0.3);
      result.current.previewParam("conversionClearance", 0.4);
    });
    expect(result.current.params.conversionClearance).toBe(0.2);
    expect(result.current.viewParams.conversionClearance).toBe(0.4);
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.commitContinuousEdit());
    expect(result.current.params.conversionClearance).toBe(0.4);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.params.conversionClearance).toBe(0.2);
  });

  it("previews nested push-fit offsets and commits the whole drag as one undo step", () => {
    const { result } = renderHook(() => useBaseConverter());

    act(() => {
      result.current.beginContinuousEdit();
      result.current.previewParams((params) => ({
        ...params,
        pushFitHexHole: { ...params.pushFitHexHole, offsetX: 2, offsetY: -1 },
      }));
      result.current.previewParams((params) => ({
        ...params,
        pushFitHexHole: { ...params.pushFitHexHole, offsetX: 3, offsetY: -2 },
      }));
    });

    expect(result.current.params.pushFitHexHole).toMatchObject({ offsetX: 7, offsetY: 5 });
    expect(result.current.viewParams.pushFitHexHole).toMatchObject({ offsetX: 3, offsetY: -2 });
    act(() => result.current.commitContinuousEdit());
    act(() => result.current.undo());
    expect(result.current.params.pushFitHexHole).toMatchObject({ offsetX: 7, offsetY: 5 });
  });

  it("clears undo history when a replacement session is loaded", () => {
    const { result } = renderHook(() => useBaseConverter());

    act(() => result.current.updateParam("recessDepth", 3));
    expect(result.current.canUndo).toBe(true);
    act(() =>
      result.current.replaceParams({
        ...BASE_CONVERTER_DEFAULTS,
        floorThickness: 2,
      }),
    );

    expect(result.current.canUndo).toBe(false);
    expect(result.current.params.floorThickness).toBe(2);
  });
});
