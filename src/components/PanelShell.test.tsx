import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Wrench } from "lucide-react";
import { PanelShell } from "@/components/PanelShell";
import { SectionHeader } from "@/components/ui/SectionHeader";

describe("PanelShell", () => {
  it("将摘要、滚动内容和操作栏分配到三个独立区域", () => {
    render(<PanelShell summary={<div>结果摘要</div>} actions={<button>开始锻造</button>}><div>参数内容</div></PanelShell>);
    expect(screen.getByTestId("panel-summary")).toHaveTextContent("结果摘要");
    expect(screen.getByTestId("panel-scroll-region")).toHaveTextContent("参数内容");
    expect(screen.getByTestId("panel-scroll-region")).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("panel-action-bar")).toHaveTextContent("开始锻造");
  });
});

describe("SectionHeader", () => {
  it("支持 Enter 和 Space 键折叠，并且展开态不设置固定最大高度", () => {
    render(<SectionHeader icon={Wrench} title="制造结构" collapsible defaultOpen><div data-testid="long-content">长内容</div></SectionHeader>);
    const trigger = screen.getByRole("button", { name: /制造结构/ });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("long-content").parentElement).not.toHaveClass("max-h-500");
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(trigger, { key: " " });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
