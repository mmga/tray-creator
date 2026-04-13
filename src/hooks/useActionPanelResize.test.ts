import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useActionPanelResize } from "@/hooks/useActionPanelResize";

describe("useActionPanelResize", () => {
  it("resizes within bounds and restores document styles after pointerup", () => {
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
    });
    expect(result.current.actionPanelWidth).toBe(370);

    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 900 }));
    });
    expect(result.current.actionPanelWidth).toBe(180);

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });

    expect(result.current.isResizingActionPanel).toBe(false);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
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
