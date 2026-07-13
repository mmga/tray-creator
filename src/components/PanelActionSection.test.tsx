import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PanelActionSection } from "@/components/PanelActionSection";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";

describe("PanelActionSection", () => {
  it("固定展示锻造、导出和状态提示", () => {
    const onGenerate = vi.fn();
    const onExportSTL = vi.fn();
    render(<PanelActionSection onGenerate={onGenerate} onExportSTL={onExportSTL} onReset={vi.fn()} isGenerating={false} isOversized={false} mode="grid" params={DEFAULT_TRAY_PARAMS} onImport={vi.fn()} showStaleNotice draftActions={{ currentDraftId: null, hasUnsavedChanges: true, onSaveDraft: vi.fn(), onOpenDraftDialog: vi.fn() }} />);
    fireEvent.click(screen.getByRole("button", { name: "开始锻造" }));
    fireEvent.click(screen.getByRole("button", { name: "导出" }));
    expect(onGenerate).toHaveBeenCalledOnce();
    expect(onExportSTL).toHaveBeenCalledOnce();
    expect(screen.getByText("当前预览已过期，请重新锻造。")).toBeInTheDocument();
    expect(screen.getByText("有未保存修改")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多操作" })).toBeInTheDocument();
  });

  it("CAD 模式将导出收拢为菜单并保留分件禁用条件", async () => {
    render(<PanelActionSection onGenerate={vi.fn()} onExportSTL={vi.fn()} onExportSplitParts={vi.fn()} canExportSplitParts={false} onReset={vi.fn()} isGenerating={false} isOversized={false} mode="stepped-cad" params={{ ...DEFAULT_TRAY_PARAMS, groups: [], slots: [] } as never} onImport={vi.fn()} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "导出" }), { button: 0, ctrlKey: false });
    expect(await screen.findByText("完整 STL")).toBeInTheDocument();
    expect(screen.getByText("分件 STL").closest('[role="menuitem"]')).toHaveAttribute("data-disabled");
  });
});
