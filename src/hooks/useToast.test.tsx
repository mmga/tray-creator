import { Profiler } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, Toaster, useToast } from "@/hooks/useToast";

const triggerRenderSpy = vi.fn();

function ToastTrigger() {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast("info", "测试消息")}>
      添加通知
    </button>
  );
}

function renderToasts() {
  return render(
    <ToastProvider>
      <Profiler id="toast-trigger" onRender={triggerRenderSpy}>
        <ToastTrigger />
      </Profiler>
      <Toaster />
    </ToastProvider>,
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    triggerRenderSpy.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears the auto-dismiss timer when a toast is dismissed manually", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    renderToasts();

    fireEvent.click(screen.getByRole("button", { name: "添加通知" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(screen.queryByText("测试消息")).not.toBeInTheDocument();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it("clears every outstanding timer when the provider unmounts", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { unmount } = renderToasts();
    fireEvent.click(screen.getByRole("button", { name: "添加通知" }));
    fireEvent.click(screen.getByRole("button", { name: "添加通知" }));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it("does not rerender action-only consumers when toast state changes", () => {
    renderToasts();
    expect(triggerRenderSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "添加通知" }));

    expect(screen.getByText("测试消息")).toBeInTheDocument();
    expect(triggerRenderSpy).toHaveBeenCalledTimes(1);
  });
});
