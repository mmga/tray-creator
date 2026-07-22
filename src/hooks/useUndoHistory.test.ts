import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUndoHistory } from "@/hooks/useUndoHistory";

describe("useUndoHistory", () => {
  it("keeps every explicit transaction and can clear an editing session", () => {
    const { result } = renderHook(() => useUndoHistory<number>());

    act(() => {
      result.current.pushState(1);
      result.current.pushState(2);
    });

    expect(result.current.canUndo()).toBe(true);
    expect(result.current.popState()).toBe(2);
    expect(result.current.popState()).toBe(1);

    act(() => {
      result.current.pushState(3);
      result.current.clearHistory();
    });

    expect(result.current.popState()).toBeUndefined();
  });

  it("keeps only the latest fifty snapshots", () => {
    const { result } = renderHook(() => useUndoHistory<number>());

    act(() => {
      for (let index = 0; index < 55; index += 1) {
        result.current.pushState(index);
      }
    });

    const popped: number[] = [];
    while (result.current.canUndo()) {
      const value = result.current.popState();
      if (value !== undefined) {
        popped.push(value);
      }
    }

    expect(popped).toHaveLength(50);
    expect(popped[0]).toBe(54);
    expect(popped.at(-1)).toBe(5);
  });
});
