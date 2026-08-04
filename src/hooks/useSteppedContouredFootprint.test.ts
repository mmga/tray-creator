import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const constructOutcomeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stepped-contoured-footprint", () => ({
  constructSteppedContouredFootprintsOutcome: constructOutcomeMock,
  projectSteppedContouredFootprintInput: (params: SteppedLayoutParams) => params,
}));

import { useSteppedContouredFootprint } from "@/hooks/useSteppedContouredFootprint";

const footprint = {
  groups: [],
  bounds: null,
  diagnostics: [],
};

describe("useSteppedContouredFootprint", () => {
  beforeEach(() => {
    constructOutcomeMock.mockReset();
    constructOutcomeMock.mockReturnValue({ ok: true, value: footprint });
  });

  it("为同一已提交快照只构造一次，并跨 Rectangular 休眠复用", async () => {
    const contoured: SteppedLayoutParams = {
      ...STEPPED_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
    };
    const { result, rerender } = renderHook(
      ({ persistedParams, workingParams }) => useSteppedContouredFootprint({
        persistedParams,
        workingParams,
        sessionEpoch: 0,
        workingEnabled: true,
      }),
      { initialProps: { persistedParams: contoured, workingParams: null } },
    );

    await waitFor(() => expect(constructOutcomeMock).toHaveBeenCalledTimes(1));
    const committed = result.current.committed;

    rerender({ persistedParams: { ...contoured }, workingParams: null });
    expect(constructOutcomeMock).toHaveBeenCalledTimes(1);
    expect(result.current.committed).toBe(committed);

    rerender({
      persistedParams: { ...contoured, footprintStyle: "rectangular", trayWidth: 180 },
      workingParams: null,
    });
    expect(result.current.committed).toEqual({ status: "inactive" });

    rerender({ persistedParams: contoured, workingParams: null });
    expect(constructOutcomeMock).toHaveBeenCalledTimes(1);
    expect(result.current.committed).toBe(committed);
  });

  it("复用同一失败快照，并将工作结果与已提交结果隔离", async () => {
    constructOutcomeMock
      .mockReturnValueOnce({
        ok: false,
        error: { code: "invalid-contour-parameters", message: "轮廓参数无效" },
      })
      .mockReturnValue({ ok: true, value: footprint });
    const persistedParams: SteppedLayoutParams = {
      ...STEPPED_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
    };
    const workingParams = {
      ...persistedParams,
      slots: persistedParams.slots.map((slot, index) => index === 0
        ? { ...slot, x: slot.x + 1 }
        : slot),
    };
    const { result, rerender } = renderHook(
      ({ working }) => useSteppedContouredFootprint({
        persistedParams,
        workingParams: working,
        sessionEpoch: 0,
        workingEnabled: true,
      }),
      { initialProps: { working: null as SteppedLayoutParams | null } },
    );

    await waitFor(() => expect(result.current.committed).toMatchObject({
      status: "failed",
      error: { message: "轮廓参数无效" },
    }));
    rerender({ working: null });
    expect(constructOutcomeMock).toHaveBeenCalledTimes(1);

    rerender({ working: workingParams });
    await waitFor(() => expect(result.current.working).toEqual({
      status: "ready",
      value: footprint,
    }));
    expect(result.current.committed).toMatchObject({
      status: "failed",
      error: { message: "轮廓参数无效" },
    });
    expect(constructOutcomeMock).toHaveBeenCalledTimes(2);
  });
});
