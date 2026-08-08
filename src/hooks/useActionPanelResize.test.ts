import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useActionPanelResize } from "@/hooks/useActionPanelResize";

describe("useActionPanelResize", () => {
  it("resizes within bounds and restores document styles after pointerup", () => {
    document.body.style.cursor = "crosshair";
    document.body.style.userSelect = "text";
    let frameCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallback = callback;
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useActionPanelResize({
        defaultWidth: 320,
        minWidth: 180,
        maxWidth: 420,
      }),
    );

    act(() => {
      result.current.startActionPanelResize(500);
    });

    expect(result.current.isResizingActionPanel).toBe(true);
    expect(document.body.style.cursor).toBe("col-resize");
    expect(document.body.style.userSelect).toBe("none");

    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 450 }));
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 400 }));
    });
    expect(result.current.actionPanelWidth).toBe(320);
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);

    act(() => {
      if (!frameCallback) throw new Error("未安排侧栏缩放帧");
      const callback = frameCallback as FrameRequestCallback;
      frameCallback = null;
      callback(0);
    });
    expect(result.current.actionPanelWidth).toBe(420);

    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 900 }));
      window.dispatchEvent(new PointerEvent("pointerup"));
    });

    expect(result.current.actionPanelWidth).toBe(180);
    expect(cancelAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isResizingActionPanel).toBe(false);
    expect(document.body.style.cursor).toBe("crosshair");
    expect(document.body.style.userSelect).toBe("text");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("stops resizing on pointer cancel and when the page becomes hidden", async () => {
    const { result } = renderHook(() =>
      useActionPanelResize({
        defaultWidth: 240,
        minWidth: 160,
        maxWidth: 360,
      }),
    );

    act(() => {
      result.current.startActionPanelResize(400);
    });

    await waitFor(() => {
      expect(document.body.style.cursor).toBe("col-resize");
    });

    act(() => {
      window.dispatchEvent(new PointerEvent("pointercancel"));
    });

    await waitFor(() => {
      expect(result.current.isResizingActionPanel).toBe(false);
    });

    act(() => {
      result.current.startActionPanelResize(400);
    });

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.isResizingActionPanel).toBe(false);
    });

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });
});
