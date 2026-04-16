import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DraftListItem } from "@/lib/local-drafts";

vi.mock("@/components/ui/dialog", () => ({
  Dialog({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) {
    return (
      <div data-testid="dialog-root" data-open={String(open)}>
        <button type="button" onClick={() => onOpenChange(false)}>
          关闭弹窗
        </button>
        {children}
      </div>
    );
  },
  DialogContent({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  },
  DialogHeader({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  },
  DialogTitle({ children }: { children: React.ReactNode }) {
    return <h2>{children}</h2>;
  },
}));

vi.mock("@/lib/local-drafts", () => ({
  MAX_DRAFTS_PER_MODE: 10,
  formatDraftTime: (value: string) => value,
}));

import { SteppedDraftDialog } from "@/components/SteppedDraftDialog";

function createDraft(id: string, title: string, updatedAt = 1): DraftListItem {
  return {
    id,
    mode: "stepped",
    title,
    createdAt: `created:${updatedAt - 1}`,
    updatedAt: `updated:${updatedAt}`,
    slotCount: 2,
    groupCount: 1,
    trayWidth: 220,
    trayDepth: 180,
  };
}

describe("SteppedDraftDialog", { timeout: 15000 }, () => {
  it("renders the empty state and routes save-area controls", () => {
    const onOpenChange = vi.fn();
    const onDraftNameInputChange = vi.fn();
    const onSaveAsNew = vi.fn();

    render(
      <SteppedDraftDialog
        open={true}
        onOpenChange={onOpenChange}
        drafts={[]}
        currentDraftId={null}
        draftNameInput="草稿 A"
        onDraftNameInputChange={onDraftNameInputChange}
        onSaveAsNew={onSaveAsNew}
        onSaveCurrent={vi.fn()}
        onLoad={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByTestId("dialog-root")).toHaveAttribute("data-open", "true");
    expect(screen.getByText("暂无已保存草稿")).toBeInTheDocument();
    expect(screen.getByText("0 / 10")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("草稿名称（留空自动生成）"), {
      target: { value: "新草稿" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("草稿名称（留空自动生成）"), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("button", { name: /另存新草稿/ }));
    fireEvent.click(screen.getByRole("button", { name: "关闭弹窗" }));

    expect(onDraftNameInputChange).toHaveBeenCalledWith("新草稿");
    expect(onSaveAsNew).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders current-draft state, list actions, and near-limit warning", () => {
    const drafts = [
      createDraft("draft-1", "当前草稿", 1),
      createDraft("draft-2", "Draft 2", 2),
      createDraft("draft-3", "Draft 3", 3),
      createDraft("draft-4", "Draft 4", 4),
      createDraft("draft-5", "Draft 5", 5),
      createDraft("draft-6", "Draft 6", 6),
    ];
    const onSaveCurrent = vi.fn();
    const onLoad = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const onExport = vi.fn();

    render(
      <SteppedDraftDialog
        open={true}
        onOpenChange={vi.fn()}
        drafts={drafts}
        currentDraftId="draft-1"
        draftNameInput="下一个草稿"
        onDraftNameInputChange={vi.fn()}
        onSaveAsNew={vi.fn()}
        onSaveCurrent={onSaveCurrent}
        onLoad={onLoad}
        onRename={onRename}
        onDelete={onDelete}
        onExport={onExport}
      />,
    );

    expect(screen.getByText("草稿数量即将达到上限，建议清理旧草稿")).toBeInTheDocument();
    expect(screen.getByText("当前")).toBeInTheDocument();
    expect(screen.getAllByText("updated:1")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /覆盖「当前草稿」/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /覆盖「当前草稿」/ }));
    expect(onSaveCurrent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole("button", { name: /加载/ })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: /重命名/ })[0]!);
    const renameInput = screen.getByDisplayValue("当前草稿");
    fireEvent.change(renameInput, { target: { value: "重命名后的草稿" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });
    fireEvent.click(screen.getAllByRole("button", { name: /导出/ })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: /删除/ })[0]!);
    expect(screen.getByText("确认删除？")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "删除" })[0]!);

    expect(onLoad).toHaveBeenCalledWith("draft-1");
    expect(onRename).toHaveBeenCalledWith("draft-1", "重命名后的草稿");
    expect(onExport).toHaveBeenCalledWith("draft-1");
    expect(onDelete).toHaveBeenCalledWith("draft-1");
  });

  it("shows the hard limit state and disables creating new drafts", () => {
    const drafts = Array.from({ length: 10 }, (_, index) =>
      createDraft(`draft-${index + 1}`, `Draft ${index + 1}`, index + 1),
    );

    render(
      <SteppedDraftDialog
        open={true}
        onOpenChange={vi.fn()}
        drafts={drafts}
        currentDraftId={null}
        draftNameInput="达到上限"
        onDraftNameInputChange={vi.fn()}
        onSaveAsNew={vi.fn()}
        onSaveCurrent={vi.fn()}
        onLoad={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText("草稿数量已达上限，请在列表中删除不需要的草稿")).toBeInTheDocument();
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("草稿名称（留空自动生成）")).toBeDisabled();
    expect(screen.getByRole("button", { name: /另存新草稿/ })).toBeDisabled();
  });
});
