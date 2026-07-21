import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrayResultSummary } from "@/components/TrayResultSummary";
import type {
  GridTrayResultProjection,
  SteppedTrayResultProjection,
} from "@/lib/tray-result-projection";

const gridResult: GridTrayResultProjection = {
  mode: "grid",
  slotCount: 6,
  itemLabel: "6 个凹槽",
  dimensions: { width: 120, depth: 80, height: 6 },
  weight: { status: "unavailable" },
  buildLimit: {
    maxSize: 260,
    oversized: false,
    widthExceeded: false,
    depthExceeded: false,
  },
  generating: false,
  stale: true,
  rows: 2,
  columns: 3,
  footprintArea: 9600,
};

describe("TrayResultSummary", () => {
  it("紧凑区展示核心结果，并仅在展开后挂载详情", () => {
    render(<TrayResultSummary result={gridResult} />);

    expect(screen.getByText(/6 个凹槽 · 120\.0 × 80\.0 × 6\.0 mm/)).toBeInTheDocument();
    expect(screen.getByText("预览待更新")).toBeInTheDocument();
    expect(screen.queryByText("耗材参考")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("耗材参考")).toBeInTheDocument();
    expect(screen.getByText("待锻造")).toBeInTheDocument();
    expect(screen.getByText("3 × 2")).toBeInTheDocument();
  });

  it("阶梯模式展示分组详情和超尺寸提示", () => {
    const result: SteppedTrayResultProjection = {
      mode: "stepped",
      slotCount: 3,
      itemLabel: "2 组 · 3 槽",
      dimensions: { width: 280, depth: 120, height: 16 },
      weight: { status: "available", grams: 8.4 },
      buildLimit: {
        maxSize: 260,
        oversized: true,
        widthExceeded: true,
        depthExceeded: false,
      },
      generating: false,
      stale: false,
      footprintWarnings: ["平滑轮廓构造失败，已退回未平滑轮廓"],
      groupCount: 2,
      groups: [
        { id: "front", name: "前排", color: "#8cb880", bottomHeight: 8, slotCount: 2 },
        { id: "back", name: "后排", color: "#d7b95d", bottomHeight: 16, slotCount: 1 },
      ],
    };

    render(<TrayResultSummary result={result} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("前排")).toBeInTheDocument();
    expect(screen.getByText("后排")).toBeInTheDocument();
    expect(screen.getByText(/超过常规打印尺寸 260 × 260 mm/)).toBeInTheDocument();
    expect(screen.getByText("2 个分组")).toBeInTheDocument();
    expect(screen.getByText(/平滑轮廓构造失败/)).toBeInTheDocument();
  });
});
