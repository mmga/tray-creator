import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type {
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";

const { recordPerfSampleMock, buildSteppedOutlinePreviewMock } = vi.hoisted(() => ({
  recordPerfSampleMock: vi.fn(),
  buildSteppedOutlinePreviewMock: vi.fn(),
}));

vi.mock("@/lib/perf", () => ({
  recordPerfSample: recordPerfSampleMock,
}));

vi.mock("@/lib/stepped-outline-preview", () => ({
  buildSteppedOutlinePreview: buildSteppedOutlinePreviewMock,
}));

import { useSteppedOutlinePreview } from "@/hooks/useSteppedOutlinePreview";

function createSteppedParams(
  overrides: Partial<SteppedLayoutParams> = {},
): SteppedLayoutParams {
  const groups =
    overrides.groups?.map((group) => ({ ...group })) ??
    STEPPED_LAYOUT_DEFAULTS.groups.map((group) => ({ ...group }));

  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    ...overrides,
    // Worker/local async preview 仅服务 Rectangular；Contoured 直接消费权威构造结果。
    footprintStyle: overrides.footprintStyle ?? "rectangular",
    groups,
    activeGroupId: overrides.activeGroupId ?? groups[0].id,
    slots:
      overrides.slots?.map((slot) => ({ ...slot })) ?? [
        {
          id: "slot-1",
          x: 30,
          y: 40,
          shape: "circle",
          width: 25,
          height: 25,
          rotation: 0,
          groupId: groups[0].id,
        },
      ],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const previewSample: GroupOutlinePreview[] = [
  {
    key: "group-1-cluster",
    groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    color: STEPPED_LAYOUT_DEFAULTS.groups[0].color,
    bottomHeight: STEPPED_LAYOUT_DEFAULTS.groups[0].bottomHeight,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  },
];

describe("useSteppedOutlinePreview", () => {
  beforeEach(() => {
    recordPerfSampleMock.mockReset();
    buildSteppedOutlinePreviewMock.mockReset();
  });

  it("clears outline previews when there are no slots", async () => {
    const params = createSteppedParams({ slots: [] });
    const previewPort = {
      generateSteppedOutlinePreview: vi.fn(),
    };

    const { result } = renderHook(() =>
      useSteppedOutlinePreview(params, previewPort),
    );

    await waitFor(() => {
      expect(result.current.outlinePreview).toBeNull();
    });
    expect(previewPort.generateSteppedOutlinePreview).not.toHaveBeenCalled();
    expect(buildSteppedOutlinePreviewMock).not.toHaveBeenCalled();
  });

  it("uses the preview port result and records perf samples", async () => {
    const params = createSteppedParams();
    const previewPort = {
      generateSteppedOutlinePreview: vi.fn().mockResolvedValue({
        outlinePreview: previewSample,
        durationMs: 12,
      }),
    };

    const { result } = renderHook(() =>
      useSteppedOutlinePreview(params, previewPort),
    );

    await waitFor(() => {
      expect(result.current.outlinePreview).toEqual(previewSample);
    });
    expect(previewPort.generateSteppedOutlinePreview).toHaveBeenCalledTimes(1);
    expect(recordPerfSampleMock).toHaveBeenCalledWith("stepped.outline", 12);
  });

  it("ignores stale async results and keeps only the latest preview", async () => {
    const firstDeferred = createDeferred<{
      outlinePreview: GroupOutlinePreview[] | null;
      durationMs: number;
    }>();
    const secondDeferred = createDeferred<{
      outlinePreview: GroupOutlinePreview[] | null;
      durationMs: number;
    }>();
    const previewPort = {
      generateSteppedOutlinePreview: vi
        .fn()
        .mockReturnValueOnce(firstDeferred.promise)
        .mockReturnValueOnce(secondDeferred.promise),
    };

    const { result, rerender } = renderHook(
      ({ params }) => useSteppedOutlinePreview(params, previewPort),
      {
        initialProps: {
          params: createSteppedParams({
            slots: [
              {
                id: "slot-1",
                x: 30,
                y: 40,
                shape: "circle",
                width: 25,
                height: 25,
                rotation: 0,
                groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
              },
            ],
          }),
        },
      },
    );

    rerender({
      params: createSteppedParams({
        slots: [
          {
            id: "slot-2",
            x: 60,
            y: 70,
            shape: "circle",
            width: 32,
            height: 32,
            rotation: 0,
            groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
          },
        ],
      }),
    });

    firstDeferred.resolve({ outlinePreview: null, durationMs: 8 });
    secondDeferred.resolve({ outlinePreview: previewSample, durationMs: 6 });

    await waitFor(() => {
      expect(result.current.outlinePreview).toEqual(previewSample);
    });
    expect(previewPort.generateSteppedOutlinePreview).toHaveBeenCalledTimes(2);
  });

  it("freezes params while paused and resumes from the latest params", async () => {
    const previewPort = {
      generateSteppedOutlinePreview: vi.fn().mockResolvedValue({
        outlinePreview: previewSample,
        durationMs: 4,
      }),
    };
    const initialParams = createSteppedParams();
    const nextParams = createSteppedParams({
      spacing: 9,
      slots: [
        {
          id: "slot-2",
          x: 80,
          y: 90,
          shape: "circle",
          width: 32,
          height: 32,
          rotation: 0,
          groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
        },
      ],
    });

    const { result, rerender } = renderHook(
      ({ params }) => useSteppedOutlinePreview(params, previewPort),
      { initialProps: { params: initialParams } },
    );

    await waitFor(() => {
      expect(previewPort.generateSteppedOutlinePreview).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.pauseOutlinePreview();
    });
    rerender({ params: nextParams });

    await waitFor(() => {
      expect(previewPort.generateSteppedOutlinePreview).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.resumeOutlinePreview();
    });

    await waitFor(() => {
      expect(previewPort.generateSteppedOutlinePreview).toHaveBeenCalledTimes(2);
    });
    expect(previewPort.generateSteppedOutlinePreview).toHaveBeenLastCalledWith(
      nextParams,
    );
  });

  it("falls back to local outline generation when there is no preview port", async () => {
    const params = createSteppedParams();
    buildSteppedOutlinePreviewMock.mockReturnValue(previewSample);

    const { result } = renderHook(() =>
      useSteppedOutlinePreview(params, null),
    );

    await waitFor(() => {
      expect(result.current.outlinePreview).toEqual(previewSample);
    });
    expect(buildSteppedOutlinePreviewMock).toHaveBeenCalledTimes(1);
    expect(recordPerfSampleMock).toHaveBeenCalled();
    expect(recordPerfSampleMock.mock.calls[0]?.[0]).toBe("stepped.outline");
  });
});
