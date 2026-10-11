import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrayResultSummary } from "@/components/TrayResultSummary";
import type {
  GridTrayResultProjection,
  SteppedTrayResultProjection,
} from "@/lib/tray-result-projection";
import { projectBaseConverterResult, projectCustomTrayResult } from "@/lib/tray-result-projection";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import {
  BASE_CONVERTER_DEFAULTS,
  SQUARE_BASE_STANDARDS,
} from "@/lib/base-converter-config";

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
  it("直边摘要不显示休眠的固定尺寸语义", () => {
    render(<TrayResultSummary result={{ ...projectCustomTrayResult(
      { ...CUSTOM_LAYOUT_DEFAULTS, footprintStyle: "polygonal", traySizingMode: "fixed" },
      { width: 50, depth: 60 },
      { volume: 0, isGenerating: false, isPreviewStale: false },
    ), polygonSideCount: 3 }} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("直边包络")).toBeInTheDocument();
    expect(screen.getByText("3 边形")).toBeInTheDocument();
    expect(screen.queryByText("固定外轮廓")).not.toBeInTheDocument();
  });

  it("普通与简版底盘摘要展示对应规格和孔位，不再标成转换件", () => {
    const { rerender } = render(<TrayResultSummary result={
      projectBaseConverterResult({
        ...BASE_CONVERTER_DEFAULTS,
        generationKind: "plain",
      }, { volume: 0, isGenerating: false, isPreviewStale: false })
    } />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("普通底盘")).toBeInTheDocument();
    expect(screen.getByText("Ø32mm")).toBeInTheDocument();
    expect(screen.getByText("底盘数")).toBeInTheDocument();
    expect(screen.queryByText("原底盘")).not.toBeInTheDocument();

    rerender(<TrayResultSummary result={
      projectBaseConverterResult({
        ...BASE_CONVERTER_DEFAULTS,
        generationKind: "push-fit",
        pushFitHexHole: { acrossFlats: 3, offsetX: 1.2, offsetY: -0.8 },
      }, { volume: 0, isGenerating: false, isPreviewStale: false })
    } />);
    expect(screen.getByText("六边孔对边")).toBeInTheDocument();
    expect(screen.getByText("1.2 / -0.8 mm")).toBeInTheDocument();
  });

  it("方形普通底盘摘要展示底面形状与矩形规格", () => {
    render(<TrayResultSummary result={
      projectBaseConverterResult({
        ...BASE_CONVERTER_DEFAULTS,
        generationKind: "plain",
        plainBaseShape: "square",
        squareBaseStandardId: "old-world-25x50",
        squareBaseSnapshot: SQUARE_BASE_STANDARDS.find(
          (standard) => standard.standardId === "old-world-25x50",
        )!,
      }, { volume: 0, isGenerating: false, isPreviewStale: false })
    } />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("底面形状")).toBeInTheDocument();
    expect(screen.getByText("方形 / 矩形")).toBeInTheDocument();
    expect(screen.getByText("25 × 50mm")).toBeInTheDocument();
  });

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

  it("展示盒体结构的外尺寸、净高与耗材分项", () => {
    const boxResult: GridTrayResultProjection = {
      ...gridResult,
      itemLabel: "堆叠盒体",
      box: {
        outerWidth: 200,
        outerDepth: 150,
        outerHeight: 50,
        closedOuterHeight: 52.4,
        lidClearHeight: 47,
        stackClearHeight: 45,
        xyFitClearance: 0.4,
        bodyWeight: { status: "available", grams: 100 },
        lidWeight: { status: "available", grams: 20 },
      },
    };

    render(<TrayResultSummary result={boxResult} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("闭合外高")).toBeInTheDocument();
    expect(screen.getByText("带盖净高")).toBeInTheDocument();
    expect(screen.getByText("堆叠净高")).toBeInTheDocument();
    expect(screen.getByText("盒体耗材")).toBeInTheDocument();
    expect(screen.getByText("盖子耗材")).toBeInTheDocument();
    expect(screen.getByText("0.40 mm / 侧")).toBeInTheDocument();
  });
});
