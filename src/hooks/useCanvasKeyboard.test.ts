import { act, renderHook } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasKeyboard } from "@/hooks/useCanvasKeyboard";
import type { FreeSlot } from "@/types/custom-tray";

function createSlot(id: string, x: number, y: number): FreeSlot {
  return {
    id,
    x,
    y,
    shape: "circle",
    width: 20,
    height: 20,
    rotation: 0,
  };
}

function dispatchKeyboardEvent(
  type: "keydown" | "keyup",
  init: KeyboardEventInit,
  target: EventTarget = window,
) {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
}

describe("useCanvasKeyboard", () => {
  const onUpdateSlot = vi.fn();
  const onRemoveSlot = vi.fn();
  const onDuplicateSlots = vi.fn();
  const onUndo = vi.fn();
  const setSelectedIds = vi.fn();
  const setIsRotating = vi.fn();
  const setIsSpacePressed = vi.fn();
  const setIsPanning = vi.fn();
  const setShowHints = vi.fn();

  let selectedIdsRef: React.RefObject<Set<string>>;
  let slotsRef: React.RefObject<FreeSlot[]>;

  beforeEach(() => {
    onUpdateSlot.mockReset();
    onRemoveSlot.mockReset();
    onDuplicateSlots.mockReset();
    onUndo.mockReset();
    setSelectedIds.mockReset();
    setIsRotating.mockReset();
    setIsSpacePressed.mockReset();
    setIsPanning.mockReset();
    setShowHints.mockReset();

    selectedIdsRef = { current: new Set(["slot-1", "slot-2"]) } as React.RefObject<Set<string>>;
    slotsRef = {
      current: [createSlot("slot-1", 10, 20), createSlot("slot-2", 30, 40)],
    } as React.RefObject<FreeSlot[]>;
  });

  it("moves selected slots with arrow keys and ignores editable targets", () => {
    renderHook(() =>
      useCanvasKeyboard({
        selectedIdsRef,
        slotsRef,
        onUpdateSlot,
        onRemoveSlot,
        onDuplicateSlots,
        onUndo,
        setSelectedIds,
        setIsRotating,
        setIsSpacePressed,
        setIsPanning,
        setShowHints,
      }),
    );

    act(() => {
      dispatchKeyboardEvent("keydown", { code: "ArrowRight" });
    });

    expect(onUpdateSlot).toHaveBeenCalledTimes(2);
    expect(onUpdateSlot).toHaveBeenNthCalledWith(1, "slot-1", 10.2, 20);
    expect(onUpdateSlot).toHaveBeenNthCalledWith(2, "slot-2", 30.2, 40);

    const input = document.createElement("input");
    document.body.appendChild(input);

    act(() => {
      dispatchKeyboardEvent("keydown", { code: "ArrowLeft" }, input);
    });

    expect(onUpdateSlot).toHaveBeenCalledTimes(2);
  });

  it("routes delete, duplicate, undo, escape, and hint toggles through the expected handlers", () => {
    onDuplicateSlots.mockReturnValue(["copy-1", "copy-2"]);

    renderHook(() =>
      useCanvasKeyboard({
        selectedIdsRef,
        slotsRef,
        onUpdateSlot,
        onRemoveSlot,
        onDuplicateSlots,
        onUndo,
        setSelectedIds,
        setIsRotating,
        setIsSpacePressed,
        setIsPanning,
        setShowHints,
      }),
    );

    act(() => {
      dispatchKeyboardEvent("keydown", { key: "c", ctrlKey: true });
      dispatchKeyboardEvent("keydown", { key: "v", ctrlKey: true });
      dispatchKeyboardEvent("keydown", { key: "z", ctrlKey: true });
      dispatchKeyboardEvent("keydown", { code: "Delete" });
      dispatchKeyboardEvent("keydown", { code: "Escape" });
      dispatchKeyboardEvent("keydown", { key: "?", shiftKey: true });
    });

    expect(onDuplicateSlots).toHaveBeenCalledWith(["slot-1", "slot-2"]);
    expect(setSelectedIds).toHaveBeenCalledWith(new Set(["copy-1", "copy-2"]));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRemoveSlot).toHaveBeenCalledTimes(2);
    expect(onRemoveSlot).toHaveBeenCalledWith("slot-1");
    expect(onRemoveSlot).toHaveBeenCalledWith("slot-2");
    expect(setSelectedIds).toHaveBeenCalledWith(new Set());
    expect(setIsRotating).toHaveBeenCalledWith(false);
    expect(setShowHints).toHaveBeenCalledTimes(1);
    expect(setShowHints.mock.calls[0][0](false)).toBe(true);
  });

  it("tracks the space key lifecycle and does nothing while disabled", () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useCanvasKeyboard({
          enabled,
          selectedIdsRef,
          slotsRef,
          onUpdateSlot,
          onRemoveSlot,
          onDuplicateSlots,
          onUndo,
          setSelectedIds,
          setIsRotating,
          setIsSpacePressed,
          setIsPanning,
          setShowHints,
        }),
      {
        initialProps: { enabled: true },
      },
    );

    act(() => {
      dispatchKeyboardEvent("keydown", { code: "Space" });
      dispatchKeyboardEvent("keyup", { code: "Space" });
    });

    expect(setIsSpacePressed).toHaveBeenNthCalledWith(1, true);
    expect(setIsSpacePressed).toHaveBeenNthCalledWith(2, false);
    expect(setIsPanning).toHaveBeenCalledWith(false);

    rerender({ enabled: false });

    act(() => {
      dispatchKeyboardEvent("keydown", { code: "ArrowUp" });
    });

    expect(onUpdateSlot).not.toHaveBeenCalled();
  });
});
