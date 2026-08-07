import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModeTabs } from "@/components/ModeTabs";

vi.mock("@/components/ui/tabs", async () => {
  const ReactModule = await import("react");

  const TabsContext = ReactModule.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  return {
    Tabs({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
    }) {
      return (
        <TabsContext.Provider value={{ value, onValueChange }}>
          <div data-testid="tabs-root">{children}</div>
        </TabsContext.Provider>
      );
    },
    TabsList({ children }: { children: React.ReactNode }) {
      return <div data-testid="tabs-list">{children}</div>;
    },
    TabsTrigger({
      value,
      children,
      "aria-label": ariaLabel,
    }: {
      value: string;
      children: React.ReactNode;
      "aria-label"?: string;
    }) {
      const { value: activeValue, onValueChange } =
        ReactModule.useContext(TabsContext);

      return (
        <button
          type="button"
          aria-label={ariaLabel}
          data-state={activeValue === value ? "active" : "inactive"}
          onClick={() => onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
  };
});

describe("ModeTabs", { timeout: 15000 }, () => {
  it("renders all mode options and forwards mode changes", () => {
    const onModeChange = vi.fn();

    render(<ModeTabs mode="grid" onModeChange={onModeChange} />);

    const gridButton = screen.getByRole("button", { name: /网格模式/ });
    const customButton = screen.getByRole("button", { name: /自定义模式/ });
    const baseConverterButton = screen.getByRole("button", { name: /转换底盘/ });
    const steppedButton = screen.getByRole("button", {
      name: /自定义阶梯底座/,
    });

    expect(gridButton).toHaveAttribute("data-state", "active");
    expect(customButton).toHaveAttribute("data-state", "inactive");
    expect(baseConverterButton).toHaveAttribute("data-state", "inactive");
    expect(steppedButton).toHaveAttribute("data-state", "inactive");
    expect(screen.queryByRole("button", { name: /CAD 阶梯底座/ })).not.toBeInTheDocument();

    fireEvent.click(customButton);
    fireEvent.click(baseConverterButton);
    fireEvent.click(steppedButton);

    expect(onModeChange).toHaveBeenNthCalledWith(1, "custom");
    expect(onModeChange).toHaveBeenNthCalledWith(2, "base-converter");
    expect(onModeChange).toHaveBeenNthCalledWith(3, "stepped");
  });
});
