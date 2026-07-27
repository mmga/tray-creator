import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutoPreview } from "@/hooks/useAutoPreview";

describe("useAutoPreview", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not regenerate the same parameters whenever generation becomes idle", () => {
    vi.useFakeTimers();
    const onGenerate = vi.fn();
    const initialTrigger = { revision: 1 };
    const { rerender } = renderHook(
      ({ trigger, isGenerating }) =>
        useAutoPreview(trigger, {
          enabled: true,
          isGenerating,
          isBlocked: false,
          onGenerate,
          delayMs: 300,
        }),
      {
        initialProps: {
          trigger: initialTrigger,
          isGenerating: false,
        },
      },
    );

    act(() => vi.advanceTimersByTime(300));
    expect(onGenerate).toHaveBeenCalledTimes(1);

    rerender({ trigger: initialTrigger, isGenerating: true });
    rerender({ trigger: initialTrigger, isGenerating: false });
    act(() => vi.advanceTimersByTime(300));
    expect(onGenerate).toHaveBeenCalledTimes(1);

    rerender({ trigger: { revision: 2 }, isGenerating: false });
    act(() => vi.advanceTimersByTime(300));
    expect(onGenerate).toHaveBeenCalledTimes(2);
  });
});
