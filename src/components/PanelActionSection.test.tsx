import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PanelActionSection } from "@/components/PanelActionSection";
import type {
  ManualDraftActionAreaAdapter,
  SteppedDraftActionAreaAdapter,
} from "@/workspaces/draft-action-area";

const success = { status: "success" } as const;

describe("PanelActionSection", () => {
  it("固定展示锻造、导出和状态提示，并只发送意图", () => {
    const perform = vi.fn(async () => success);
    const adapter: ManualDraftActionAreaAdapter = {
      kind: "manual",
      state: {
        currentDraftId: null,
        hasUnsavedChanges: true,
        stale: true,
        generate: { state: "available" },
        exportWhole: { state: "available" },
        preview: { kind: "manual" },
      },
      perform,
    };

    render(<PanelActionSection adapter={adapter} />);
    fireEvent.click(screen.getByRole("button", { name: "开始锻造" }));
    fireEvent.click(screen.getByRole("button", { name: "导出" }));

    expect(perform).toHaveBeenCalledWith({ type: "generate" });
    expect(perform).toHaveBeenCalledWith({ type: "export-whole" });
    expect(screen.getByText("当前预览已过期，请重新锻造。")).toBeInTheDocument();
    expect(screen.getByText("有未保存修改")).toBeInTheDocument();
  });

  it("阶梯分件能力将导出收拢为菜单，并直接消费分件 Availability", async () => {
    const adapter: SteppedDraftActionAreaAdapter = {
      kind: "stepped",
      state: {
        currentDraftId: null,
        hasUnsavedChanges: false,
        stale: false,
        generate: { state: "available" },
        exportWhole: { state: "available" },
        exportSplit: { state: "blocked", reason: "至少需要两个分组且存在凹槽" },
        preview: { kind: "manual" },
      },
      perform: vi.fn(async () => success),
    };

    render(<PanelActionSection adapter={adapter} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "导出" }), { button: 0, ctrlKey: false });

    expect(await screen.findByText("完整 STL")).toBeInTheDocument();
    const splitItem = screen.getByText("分件 STL").closest('[role="menuitem"]');
    expect(splitItem).toHaveAttribute("data-disabled");
    expect(splitItem).toHaveAttribute("title", "至少需要两个分组且存在凹槽");
    expect(screen.getByRole("status")).toHaveTextContent(
      "分件导出：至少需要两个分组且存在凹槽",
    );
  });

  it("展示适配阻断原因并禁用锻造与完整导出", () => {
    const reason = "底板孔位不适配：侧壁不足";
    const adapter: ManualDraftActionAreaAdapter = {
      kind: "manual",
      state: {
        currentDraftId: null,
        hasUnsavedChanges: false,
        stale: false,
        generate: { state: "blocked", reason },
        exportWhole: { state: "blocked", reason },
        preview: { kind: "manual" },
      },
      perform: vi.fn(async () => success),
    };

    render(<PanelActionSection adapter={adapter} />);

    expect(screen.getByRole("button", { name: "开始锻造" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "开始锻造" })).toHaveAttribute("title", reason);
    expect(screen.getByRole("button", { name: "导出" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出" })).toHaveAttribute("title", reason);
    expect(screen.getByRole("status")).toHaveTextContent(`锻造：${reason}`);
    expect(screen.getByRole("status")).toHaveTextContent(`完整导出：${reason}`);
  });
});
