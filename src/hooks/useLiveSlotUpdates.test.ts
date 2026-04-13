import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CanvasSlotUpdate } from "@/lib/canvas-types";
import { useLiveSlotUpdates } from "@/hooks/useLiveSlotUpdates";

describe("useLiveSlotUpdates", () => {
  it("batches repeated schedules into a single animation frame and keeps the latest payload", () => {
    const applyLiveUpdates = vi.fn();
    let frameCallback: FrameRequestCallback | null = null;

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frameCallback = callback;
        return 7;
      });

    const { result } = renderHook(() =>
      useLiveSlotUpdates({ applyLiveUpdates }),
    );

    const initialUpdates: CanvasSlotUpdate[] = [{ id: "slot-1", x: 10, y: 20 }];
    const latestUpdates: CanvasSlotUpdate[] = [{ id: "slot-1", x: 30, y: 40 }];

    act(() => {
      result.current.scheduleLiveUpdates(initialUpdates);
      result.current.scheduleLiveUpdates(latestUpdates);
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(frameCallback).not.toBeNull();

    act(() => {
      frameCallback?.(16);
    });

    expect(applyLiveUpdates).toHaveBeenCalledTimes(1);
    expect(applyLiveUpdates).toHaveBeenCalledWith(latestUpdates);
  });

  it("flushes pending updates immediately and cancels the scheduled frame", () => {
    const applyLiveUpdates = vi.fn();
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});

    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 11);

    const { result } = renderHook(() =>
      useLiveSlotUpdates({ applyLiveUpdates }),
    );

    const updates: CanvasSlotUpdate[] = [{ id: "slot-2", x: 55, y: 66 }];

    act(() => {
      result.current.scheduleLiveUpdates(updates);
      result.current.flushScheduledLiveUpdates();
    });

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(11);
    expect(applyLiveUpdates).toHaveBeenCalledTimes(1);
    expect(applyLiveUpdates).toHaveBeenCalledWith(updates);
  });

  it("uses the latest apply callback and cancels pending work on unmount", () => {
    let frameCallback: FrameRequestCallback | null = null;
    const firstApply = vi.fn();
    const secondApply = vi.fn();
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});

    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) => {
        frameCallback = callback;
        return 19;
      },
    );

    const { result, rerender, unmount } = renderHook(
      ({ applyLiveUpdates }: { applyLiveUpdates: (updates: CanvasSlotUpdate[]) => void }) =>
        useLiveSlotUpdates({ applyLiveUpdates }),
      {
        initialProps: { applyLiveUpdates: firstApply },
      },
    );

    const updates: CanvasSlotUpdate[] = [{ id: "slot-3", x: 77, y: 88 }];

    act(() => {
      result.current.scheduleLiveUpdates(updates);
    });

    rerender({ applyLiveUpdates: secondApply });

    act(() => {
      frameCallback?.(16);
    });

    expect(firstApply).not.toHaveBeenCalled();
    expect(secondApply).toHaveBeenCalledWith(updates);

    act(() => {
      result.current.scheduleLiveUpdates(updates);
      unmount();
    });

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(19);
  });
});
