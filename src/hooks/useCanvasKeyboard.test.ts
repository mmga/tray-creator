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
  return event;
}

describe("useCanvasKeyboard", () => {
  const onUpdateSlot = vi.fn();
  const onUpdateSlots = vi.fn();
  const onRemoveSlot = vi.fn();
  const onRemoveSlots = vi.fn();
  const onDuplicateSlots = vi.fn();
  const onUndo = vi.fn();
  const onCancelInteraction = vi.fn();
  const setSelectedIds = vi.fn();
  const setIsRotating = vi.fn();
  const setIsSpacePressed = vi.fn();
  const setIsPanning = vi.fn();
  const setShowHints = vi.fn();

  let selectedIdsRef: React.RefObject<Set<string>>;
  let slotsRef: React.RefObject<FreeSlot[]>;

  beforeEach(() => {
    onUpdateSlot.mockReset();
    onUpdateSlots.mockReset();
    onRemoveSlot.mockReset();
    onRemoveSlots.mockReset();
    onDuplicateSlots.mockReset();
    onUndo.mockReset();
    onCancelInteraction.mockReset();
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

  it("moves selected slots with arrow keys and ignores interactive targets", () => {
    renderHook(() =>
      useCanvasKeyboard({
        selectedIdsRef,
        slotsRef,
        onUpdateSlot,
        onUpdateSlots,
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

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { id: "slot-1", x: 10.1, y: 20 },
      { id: "slot-2", x: 30.1, y: 40 },
    ]);
    expect(onUpdateSlot).not.toHaveBeenCalled();

    const input = document.createElement("input");
    document.body.appendChild(input);

    act(() => {
      dispatchKeyboardEvent("keydown", { code: "ArrowLeft" }, input);
    });

    expect(onUpdateSlots).toHaveBeenCalledTimes(1);

    const button = document.createElement("button");
    document.body.appendChild(button);

    act(() => {
      dispatchKeyboardEvent("keydown", { code: "ArrowLeft" }, button);
      dispatchKeyboardEvent("keydown", { code: "Delete" }, button);
    });

    expect(onUpdateSlots).toHaveBeenCalledTimes(1);
    expect(onRemoveSlot).not.toHaveBeenCalled();
    input.remove();
    button.remove();
  });

  it("routes delete, duplicate, undo, escape, and hint toggles through the expected handlers", () => {
    onDuplicateSlots.mockReturnValue(["copy-1", "copy-2"]);

    renderHook(() =>
      useCanvasKeyboard({
        selectedIdsRef,
        slotsRef,
        onUpdateSlot,
        onUpdateSlots,
        onRemoveSlot,
        onRemoveSlots,
        onDuplicateSlots,
        onUndo,
        onCancelInteraction,
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
    expect(onRemoveSlots).toHaveBeenCalledWith(["slot-1", "slot-2"]);
    expect(onRemoveSlot).not.toHaveBeenCalled();
    expect(onCancelInteraction).toHaveBeenCalledTimes(1);
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

    let keyDownEvent!: KeyboardEvent;
    let keyUpEvent!: KeyboardEvent;
    act(() => {
      keyDownEvent = dispatchKeyboardEvent("keydown", { code: "Space" });
      keyUpEvent = dispatchKeyboardEvent("keyup", { code: "Space" });
    });

    expect(setIsSpacePressed).toHaveBeenNthCalledWith(1, true);
    expect(setIsSpacePressed).toHaveBeenNthCalledWith(2, false);
    expect(setIsPanning).toHaveBeenCalledWith(false);
    expect(keyDownEvent.defaultPrevented).toBe(true);
    expect(keyUpEvent.defaultPrevented).toBe(true);

    act(() => {
      dispatchKeyboardEvent("keydown", { code: "Space" });
      window.dispatchEvent(new Event("blur"));
    });

    expect(setIsSpacePressed).toHaveBeenNthCalledWith(3, true);
    expect(setIsSpacePressed).toHaveBeenNthCalledWith(4, false);
    expect(setIsPanning).toHaveBeenCalledTimes(2);

    act(() => {
      dispatchKeyboardEvent("keydown", { code: "Space" });
    });
    rerender({ enabled: false });

    expect(setIsSpacePressed).toHaveBeenNthCalledWith(5, true);
    expect(setIsSpacePressed).toHaveBeenNthCalledWith(6, false);
    expect(setIsPanning).toHaveBeenCalledTimes(3);

    act(() => {
      dispatchKeyboardEvent("keydown", { code: "ArrowUp" });
    });

    expect(onUpdateSlot).not.toHaveBeenCalled();
  });

  it("prevents browser copy and paste only when handling selected slots", () => {
    onDuplicateSlots.mockReturnValue(["copy-1"]);
    renderHook(() =>
      useCanvasKeyboard({
        selectedIdsRef,
        slotsRef,
        onUpdateSlot,
        onRemoveSlot,
        onDuplicateSlots,
        setSelectedIds,
        setIsRotating,
        setIsSpacePressed,
        setIsPanning,
        setShowHints,
      }),
    );

    let copyEvent!: KeyboardEvent;
    let pasteEvent!: KeyboardEvent;
    act(() => {
      copyEvent = dispatchKeyboardEvent("keydown", { key: "c", ctrlKey: true });
      pasteEvent = dispatchKeyboardEvent("keydown", { key: "v", ctrlKey: true });
    });

    expect(copyEvent.defaultPrevented).toBe(true);
    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(onDuplicateSlots).toHaveBeenCalledWith(["slot-1", "slot-2"]);
  });
});
