import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftManagerDialog } from "@/components/DraftManagerDialog";

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

type GridDraft = {
  id: string;
  title: string;
  updatedAt: string;
  summary: {
    rows: number;
    columns: number;
    trayWidth: number;
    trayDepth: number;
  };
};

function createGridDraft(id: string, title: string, updatedAt = 1): GridDraft {
  return {
    id,
    title,
    updatedAt: `updated:${updatedAt}`,
    summary: {
      rows: 2,
      columns: 3,
      trayWidth: 120,
      trayDepth: 80,
    },
  };
}

describe("DraftManagerDialog", { timeout: 15000 }, () => {
  it("renders mode title, current binding, dirty-state badge, and mode-specific summaries", () => {
    render(
      <DraftManagerDialog
        mode="grid"
        open={true}
        onOpenChange={vi.fn()}
        drafts={[createGridDraft("draft-1", "网格草稿")]}
        currentDraftId="draft-1"
        hasUnsavedChanges={true}
        draftNameInput="新草稿"
        onDraftNameInputChange={vi.fn()}
        onSaveAsNew={vi.fn()}
        onSaveCurrent={vi.fn()}
        onLoad={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onExport={vi.fn()}
        renderSummary={(item) => (
          <>
            <span>{item.summary.rows}×{item.summary.columns}</span>
            <span className="font-mono">
              {item.summary.trayWidth}×{item.summary.trayDepth}mm
            </span>
          </>
        )}
      />,
    );

    expect(screen.getByText("网格模式草稿")).toBeInTheDocument();
    expect(screen.getByText("有未保存修改")).toBeInTheDocument();
    expect(screen.getByText("2×3")).toBeInTheDocument();
    expect(screen.getByText("当前")).toBeInTheDocument();
    expect(screen.getAllByText("updated:1")).toHaveLength(2);
  });

  it("routes save, load, rename, export, and delete actions", () => {
    const onOpenChange = vi.fn();
    const onDraftNameInputChange = vi.fn();
    const onSaveAsNew = vi.fn();
    const onSaveCurrent = vi.fn();
    const onLoad = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const onExport = vi.fn();

    render(
      <DraftManagerDialog
        mode="custom"
        open={true}
        onOpenChange={onOpenChange}
        drafts={[createGridDraft("draft-1", "当前草稿")]}
        currentDraftId="draft-1"
        hasUnsavedChanges={false}
        draftNameInput="草稿 A"
        onDraftNameInputChange={onDraftNameInputChange}
        onSaveAsNew={onSaveAsNew}
        onSaveCurrent={onSaveCurrent}
        onLoad={onLoad}
        onRename={onRename}
        onDelete={onDelete}
        onExport={onExport}
        renderSummary={(item) => <span>{item.summary.rows}×{item.summary.columns}</span>}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("草稿名称（留空自动生成）"), {
      target: { value: "新草稿" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("草稿名称（留空自动生成）"), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("button", { name: /另存新草稿/ }));
    fireEvent.click(screen.getByRole("button", { name: /覆盖「当前草稿」/ }));
    fireEvent.click(screen.getByRole("button", { name: /加载/ }));
    fireEvent.click(screen.getByRole("button", { name: /重命名/ }));

    const renameInput = screen.getByDisplayValue("当前草稿");
    fireEvent.change(renameInput, { target: { value: "重命名后的草稿" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /导出/ }));
    fireEvent.click(screen.getByRole("button", { name: /删除/ }));
    expect(screen.getByText("确认删除？")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭弹窗" }));

    expect(onDraftNameInputChange).toHaveBeenCalledWith("新草稿");
    expect(onSaveAsNew).toHaveBeenCalledTimes(2);
    expect(onSaveCurrent).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith("draft-1");
    expect(onRename).toHaveBeenCalledWith("draft-1", "重命名后的草稿");
    expect(onExport).toHaveBeenCalledWith("draft-1");
    expect(onDelete).toHaveBeenCalledWith("draft-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the hard limit state and disables creating new drafts", () => {
    const drafts = Array.from({ length: 10 }, (_, index) =>
      createGridDraft(`draft-${index + 1}`, `Draft ${index + 1}`, index + 1),
    );

    render(
      <DraftManagerDialog
        mode="stepped"
        open={true}
        onOpenChange={vi.fn()}
        drafts={drafts}
        currentDraftId={null}
        hasUnsavedChanges={false}
        draftNameInput="达到上限"
        onDraftNameInputChange={vi.fn()}
        onSaveAsNew={vi.fn()}
        onSaveCurrent={vi.fn()}
        onLoad={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onExport={vi.fn()}
        renderSummary={(item) => <span>{item.summary.rows}×{item.summary.columns}</span>}
      />,
    );

    expect(screen.getByText("阶梯模式草稿")).toBeInTheDocument();
    expect(screen.getByText("草稿数量已达上限，请在列表中删除不需要的草稿")).toBeInTheDocument();
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("草稿名称（留空自动生成）")).toBeDisabled();
    expect(screen.getByRole("button", { name: /另存新草稿/ })).toBeDisabled();
  });
});
