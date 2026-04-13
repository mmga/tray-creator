import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCanvasZoom } from "@/hooks/useCanvasZoom";

function createTouch(clientX: number, clientY: number) {
  return { clientX, clientY };
}

function createTouchEvent(
  touches: Array<{ clientX: number; clientY: number }>,
) {
  return {
    touches,
    preventDefault: vi.fn(),
  };
}

describe("useCanvasZoom", () => {
  it("tracks zoom, pan, and derived viewBox values with clamp and reset behavior", () => {
    const { result } = renderHook(() =>
      useCanvasZoom({
        baseW: 300,
        baseH: 200,
        trayWidth: 260,
        trayDepth: 180,
      }),
    );

    expect(result.current.zoom).toBe(1);
    expect(result.current.pan).toEqual({ x: 0, y: 0 });
    expect(result.current.viewBox).toBe("-20 -10 300 200");

    act(() => {
      result.current.adjustZoom(0.5);
      result.current.setPan({ x: 10, y: -5 });
    });

    expect(result.current.zoom).toBe(1.5);
    expect(result.current.viewW).toBeCloseTo(200);
    expect(result.current.viewH).toBeCloseTo(133.3333333333);
    expect(result.current.minX).toBeCloseTo(20);
    expect(result.current.minY).toBeCloseTo(28.3333333333);
    expect(result.current.viewBox).toBe(
      `${result.current.minX} ${result.current.minY} ${result.current.viewW} ${result.current.viewH}`,
    );

    act(() => {
      result.current.adjustZoom(10);
    });
    expect(result.current.zoom).toBe(5);

    act(() => {
      result.current.adjustZoom(-10);
    });
    expect(result.current.zoom).toBe(0.5);

    act(() => {
      result.current.resetZoom();
    });

    expect(result.current.zoom).toBe(1);
    expect(result.current.pan).toEqual({ x: 0, y: 0 });
    expect(result.current.viewBox).toBe("-20 -10 300 200");
  });

  it("adjusts zoom from wheel input and only prevents default on ctrl/meta gestures", () => {
    const { result } = renderHook(() =>
      useCanvasZoom({
        baseW: 300,
        baseH: 200,
        trayWidth: 260,
        trayDepth: 180,
      }),
    );

    const ctrlWheelEvent = {
      deltaY: -120,
      ctrlKey: true,
      metaKey: false,
      preventDefault: vi.fn(),
    };
    const plainWheelEvent = {
      deltaY: 120,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    };

    act(() => {
      result.current.handleWheel(ctrlWheelEvent as React.WheelEvent);
      result.current.handleWheel(plainWheelEvent as React.WheelEvent);
    });

    expect(ctrlWheelEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(plainWheelEvent.preventDefault).not.toHaveBeenCalled();
    expect(result.current.zoom).toBe(1);
  });

  it("handles pinch zoom and pan gestures and ignores move events after touch end", () => {
    const { result } = renderHook(() =>
      useCanvasZoom({
        baseW: 300,
        baseH: 200,
        trayWidth: 260,
        trayDepth: 180,
      }),
    );

    const startEvent = createTouchEvent([
      createTouch(0, 0),
      createTouch(0, 100),
    ]);

    act(() => {
      result.current.handleTouchStart(startEvent as unknown as React.TouchEvent);
    });

    expect(startEvent.preventDefault).toHaveBeenCalledTimes(1);

    const moveEvent = createTouchEvent([
      createTouch(20, 20),
      createTouch(20, 220),
    ]);

    act(() => {
      result.current.handleTouchMove(moveEvent as unknown as React.TouchEvent);
    });

    expect(moveEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.zoom).toBe(2);
    expect(result.current.pan.x).toBeCloseTo(5);
    expect(result.current.pan.y).toBeCloseTo(17.5);

    act(() => {
      result.current.handleTouchEnd();
    });

    const afterEndMoveEvent = createTouchEvent([
      createTouch(40, 40),
      createTouch(40, 240),
    ]);

    act(() => {
      result.current.handleTouchMove(
        afterEndMoveEvent as unknown as React.TouchEvent,
      );
    });

    expect(afterEndMoveEvent.preventDefault).not.toHaveBeenCalled();
    expect(result.current.zoom).toBe(2);
    expect(result.current.pan.x).toBeCloseTo(5);
    expect(result.current.pan.y).toBeCloseTo(17.5);
  });
});
