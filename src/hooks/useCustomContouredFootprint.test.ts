import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import type { CustomLayoutParams } from "@/types/custom-tray";

const constructOutcomeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/custom-contoured-footprint", () => ({
  constructCustomContouredFootprintOutcome: constructOutcomeMock,
  projectCustomContouredFootprintInput: (params: CustomLayoutParams) => ({
    plan: { requests: [{ key: "custom-baseplate", footprintStyle: params.footprintStyle }] },
  }),
}));

import { useCustomContouredFootprint } from "@/hooks/useCustomContouredFootprint";

describe("useCustomContouredFootprint", () => {
  beforeEach(() => {
    constructOutcomeMock.mockReset();
    constructOutcomeMock.mockReturnValue({
      ok: true,
      value: {
        key: "custom-baseplate",
        bodies: [],
        bodyCount: 0,
        bounds: null,
        area: 0,
        diagnostics: [],
        containsExpandedCircle: () => false,
      },
    });
  });

  it("为同一已提交快照只构造一次，并跨 Rectangular 休眠复用", async () => {
    const contoured: CustomLayoutParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
    };
    const { result, rerender } = renderHook(
      ({ persistedParams, workingParams }) => useCustomContouredFootprint({
        persistedParams,
        workingParams,
        sessionEpoch: 0,
        workingEnabled: true,
      }),
      { initialProps: { persistedParams: contoured, workingParams: null } },
    );

    await waitFor(() => {
      expect(constructOutcomeMock).toHaveBeenCalledTimes(1);
    });
    const committed = result.current.committed;

    rerender({ persistedParams: { ...contoured }, workingParams: null });
    expect(constructOutcomeMock).toHaveBeenCalledTimes(1);
    expect(result.current.committed).toBe(committed);

    rerender({
      persistedParams: {
        ...contoured,
        footprintStyle: "rectangular",
        trayWidth: 180,
      },
      workingParams: null,
    });
    expect(result.current.committed).toEqual({ status: "inactive" });

    rerender({ persistedParams: contoured, workingParams: null });
    expect(constructOutcomeMock).toHaveBeenCalledTimes(1);
    expect(result.current.committed).toBe(committed);
  });

  it("复用同一已提交快照的结构化失败而不重试", async () => {
    constructOutcomeMock.mockReturnValue({
      ok: false,
      error: {
        code: "invalid-contour-parameters",
        message: "轮廓参数无效",
      },
    });
    const params: CustomLayoutParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
    };
    const { result, rerender } = renderHook(
      ({ persistedParams }) => useCustomContouredFootprint({
        persistedParams,
        workingParams: null,
        sessionEpoch: 0,
        workingEnabled: true,
      }),
      { initialProps: { persistedParams: params } },
    );

    await waitFor(() => {
      expect(result.current.committed.status).toBe("failed");
      if (result.current.committed.status !== "failed") return;
      expect(result.current.committed.error.code).toBe(
        "invalid-contour-parameters",
      );
    });
    rerender({ persistedParams: { ...params } });

    expect(constructOutcomeMock).toHaveBeenCalledTimes(1);
    expect(result.current.committed.status).toBe("failed");
    if (result.current.committed.status === "failed") {
      expect(result.current.committed.error.message).toBe("轮廓参数无效");
    }
  });

  it("仅在 2D 工作预览启用时构造 working 结果", () => {
    const persistedParams: CustomLayoutParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
    };
    const workingParams = {
      ...persistedParams,
      spacing: persistedParams.spacing + 1,
    };
    const { result, rerender } = renderHook(
      ({ workingEnabled }) => useCustomContouredFootprint({
        persistedParams,
        workingParams,
        sessionEpoch: 0,
        workingEnabled,
      }),
      { initialProps: { workingEnabled: false } },
    );

    expect(result.current.working).toEqual({ status: "inactive" });
    expect(constructOutcomeMock).toHaveBeenCalledTimes(1);

    rerender({ workingEnabled: true });
    expect(result.current.working.status).toBe("ready");
    expect(constructOutcomeMock).toHaveBeenCalledTimes(2);
  });

  it("session 替换会清空休眠结果并重新构造", () => {
    const persistedParams: CustomLayoutParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
    };
    const { rerender } = renderHook(
      ({ sessionEpoch }) => useCustomContouredFootprint({
        persistedParams,
        workingParams: null,
        sessionEpoch,
        workingEnabled: false,
      }),
      { initialProps: { sessionEpoch: 0 } },
    );

    expect(constructOutcomeMock).toHaveBeenCalledTimes(1);
    rerender({ sessionEpoch: 1 });
    expect(constructOutcomeMock).toHaveBeenCalledTimes(2);
  });
});
