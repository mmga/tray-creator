import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUndoHistory } from "@/hooks/useUndoHistory";

describe("useUndoHistory", () => {
  it("merges rapid pushes unless forced and resets the merge window after undo", () => {
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_200)
      .mockReturnValueOnce(1_300)
      .mockReturnValueOnce(1_350);

    const { result } = renderHook(() => useUndoHistory<number>());

    act(() => {
      result.current.pushState(1);
      result.current.pushState(2);
    });

    expect(result.current.canUndo()).toBe(true);
    expect(result.current.popState()).toBe(1);
    expect(result.current.popState()).toBeUndefined();

    act(() => {
      result.current.pushState(3);
      result.current.pushState(4, { force: true });
    });

    expect(result.current.popState()).toBe(4);
    expect(result.current.popState()).toBe(3);
    expect(result.current.popState()).toBeUndefined();
  });

  it("keeps only the latest fifty snapshots", () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => {
      now += 600;
      return now;
    });

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
