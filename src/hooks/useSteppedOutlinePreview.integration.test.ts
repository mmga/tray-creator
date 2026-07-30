import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type {
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";

const buildSteppedOutlinePreviewMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stepped-outline-preview", () => ({
  buildSteppedOutlinePreview: buildSteppedOutlinePreviewMock,
}));

import { useSteppedOutlinePreview } from "@/hooks/useSteppedOutlinePreview";

function createSteppedParams(
  overrides: Partial<SteppedLayoutParams> = {},
): SteppedLayoutParams {
  const groups = overrides.groups?.map((group) => ({ ...group })) ??
    STEPPED_LAYOUT_DEFAULTS.groups.map((group) => ({ ...group }));
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    ...overrides,
    groups,
    activeGroupId: overrides.activeGroupId ?? groups[0].id,
    slots: overrides.slots?.map((slot) => ({ ...slot })) ?? [{
      id: "slot-1",
      x: 30,
      y: 40,
      shape: "circle",
      width: 25,
      height: 25,
      rotation: 0,
      groupId: groups[0].id,
    }],
  };
}

const previewSample: GroupOutlinePreview[] = [{
  key: "group-1-cluster",
  groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
  color: STEPPED_LAYOUT_DEFAULTS.groups[0].color,
  bottomHeight: STEPPED_LAYOUT_DEFAULTS.groups[0].bottomHeight,
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ],
}];

describe("useSteppedOutlinePreview", () => {
  beforeEach(() => {
    buildSteppedOutlinePreviewMock.mockReset();
    buildSteppedOutlinePreviewMock.mockReturnValue(previewSample);
  });

  it("直接消费 Mode owner 提供的权威状态", async () => {
    const params = createSteppedParams();
    const state = { status: "inactive" as const };
    const { result } = renderHook(() =>
      useSteppedOutlinePreview(params, state)
    );

    await waitFor(() => {
      expect(result.current.outlinePreview).toEqual(previewSample);
    });
    expect(buildSteppedOutlinePreviewMock).toHaveBeenCalledWith(params, state);
  });

  it("暂停期间冻结结果，恢复后使用最新参数", async () => {
    const initialParams = createSteppedParams();
    const nextParams = createSteppedParams({ spacing: 9 });
    const state = { status: "inactive" as const };
    const { result, rerender } = renderHook(
      ({ params }) => useSteppedOutlinePreview(params, state),
      { initialProps: { params: initialParams } },
    );

    await waitFor(() => {
      expect(buildSteppedOutlinePreviewMock).toHaveBeenCalledTimes(1);
    });
    act(() => result.current.pauseOutlinePreview());
    rerender({ params: nextParams });
    expect(buildSteppedOutlinePreviewMock).toHaveBeenCalledTimes(1);

    act(() => result.current.resumeOutlinePreview());
    await waitFor(() => {
      expect(buildSteppedOutlinePreviewMock).toHaveBeenCalledTimes(2);
    });
    expect(buildSteppedOutlinePreviewMock).toHaveBeenLastCalledWith(
      nextParams,
      state,
    );
  });

  it("session 替换会重新派生轮廓", async () => {
    const params = createSteppedParams();
    const state = { status: "inactive" as const };
    const { rerender } = renderHook(
      ({ epoch }) => useSteppedOutlinePreview(params, state, epoch),
      { initialProps: { epoch: 0 } },
    );
    await waitFor(() => {
      expect(buildSteppedOutlinePreviewMock).toHaveBeenCalledTimes(1);
    });
    rerender({ epoch: 1 });
    await waitFor(() => {
      expect(buildSteppedOutlinePreviewMock).toHaveBeenCalledTimes(2);
    });
  });
});
