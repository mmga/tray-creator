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
  it("使用原生按钮折叠，并从键盘与辅助技术隐藏折叠内容", () => {
    render(<SectionHeader icon={Wrench} title="制造结构" collapsible defaultOpen><div data-testid="long-content"><button type="button">内部操作</button></div></SectionHeader>);
    const trigger = screen.getByRole("button", { name: /制造结构/ });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("long-content").parentElement).not.toHaveClass("max-h-500");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("long-content").parentElement?.parentElement).toHaveAttribute("inert");
    expect(screen.queryByRole("button", { name: "内部操作" })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "内部操作" })).toBeInTheDocument();
  });
});
