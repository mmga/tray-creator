import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BaseConverterPreview,
  clientPointToSvgPoint,
} from "@/components/BaseConverterPreview";
import {
  BASE_CONVERTER_DEFAULTS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  createConversionGeometrySnapshot,
} from "@/lib/base-converter-config";

describe("BaseConverterPreview", () => {
  it("converts client coordinates through a centered meet viewBox", () => {
    expect(clientPointToSvgPoint(
      { x: 200, y: 100 },
      { left: 0, top: 0, width: 300, height: 200 },
      { x: -20, y: -20, width: 40, height: 40 },
    )).toEqual({ x: 10, y: 0 });
  });

  it("renders the ordinary round base with its inset top outline", () => {
    const { container } = render(
      <BaseConverterPreview
        params={{ ...BASE_CONVERTER_DEFAULTS, generationKind: "plain" }}
      />,
    );

    expect(screen.getByLabelText("底盘生成 2D 图")).toBeInTheDocument();
    expect(screen.getByText(/普通底盘 · Ø32mm/)).toBeInTheDocument();
    expect(container.querySelector('[data-shape="round-base-bottom"]'))
      .toHaveAttribute("r", "16");
    expect(container.querySelector('[data-shape="round-base-top"]'))
      .toHaveAttribute("r", "14.5");
    expect(container.querySelector('[data-shape="push-fit-hole"]'))
      .not.toBeInTheDocument();
    expect(container.querySelector('[data-shape="push-fit-hole-wall"]'))
      .not.toBeInTheDocument();
  });

  it("renders an offset hex hole for a push-fit base", () => {
    const { container } = render(
      <BaseConverterPreview
        params={{
          ...BASE_CONVERTER_DEFAULTS,
          generationKind: "push-fit",
          pushFitHexHole: { acrossFlats: 3, offsetX: 2, offsetY: -1 },
        }}
      />,
    );

    expect(screen.getByText(/简版底盘 · Ø32mm · 六边孔 3.0mm/)).toBeInTheDocument();
    expect(container.querySelector('[data-shape="push-fit-hole"]'))
      .toHaveAttribute(
        "points",
        "3.732,1 2.866,-0.5 1.134,-0.5 0.268,1 1.134,2.5 2.866,2.5",
      );
    const wall = container.querySelector('[data-shape="push-fit-hole-wall"]');
    expect(wall).toHaveAttribute(
      "points",
      "5.118,1 3.559,-1.7 0.441,-1.7 -1.118,1 0.441,3.7 3.559,3.7",
    );
    const clipPath = wall?.getAttribute("clip-path");
    expect(clipPath).toMatch(/^url\(#.+\)$/);
    const clipId = clipPath!.slice(5, -1);
    expect(container.querySelector(`clipPath#${clipId} circle`))
      .toHaveAttribute("r", "15.625");
  });

  it("captures pointer dragging, previews offsets, and commits or cancels once", () => {
    const beginContinuousEdit = vi.fn(() => true);
    const previewParams = vi.fn();
    const commitContinuousEdit = vi.fn();
    const cancelContinuousEdit = vi.fn();
    const setPointerCapture = vi.fn();
    Object.defineProperty(SVGElement.prototype, "setPointerCapture", {
      configurable: true,
      value: setPointerCapture,
    });
    const { container } = render(
      <BaseConverterPreview
        params={{ ...BASE_CONVERTER_DEFAULTS, generationKind: "push-fit" }}
        beginContinuousEdit={beginContinuousEdit}
        previewParams={previewParams}
        commitContinuousEdit={commitContinuousEdit}
        cancelContinuousEdit={cancelContinuousEdit}
      />,
    );
    const svg = container.querySelector("svg")!;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 200, height: 200,
      right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}),
    });
    const hole = screen.getByRole("button", { name: "拖动简版六边孔" });

    fireEvent.pointerDown(hole, { pointerId: 7, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(hole, { pointerId: 7, clientX: 120, clientY: 90 });
    fireEvent.pointerUp(hole, { pointerId: 7 });

    expect(beginContinuousEdit).toHaveBeenCalledTimes(1);
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(previewParams).toHaveBeenCalledTimes(1);
    const mutate = previewParams.mock.calls[0][0];
    expect(mutate(BASE_CONVERTER_DEFAULTS).pushFitHexHole).toMatchObject({
      offsetX: expect.closeTo(4.768, 3),
      offsetY: expect.closeTo(2.384, 3),
    });
    expect(commitContinuousEdit).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(hole, { pointerId: 8, clientX: 100, clientY: 100 });
    fireEvent.pointerCancel(hole, { pointerId: 8 });
    expect(cancelContinuousEdit).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(hole, { pointerId: 9, clientX: 100, clientY: 100 });
    fireEvent.keyDown(hole, { key: "Escape" });
    expect(cancelContinuousEdit).toHaveBeenCalledTimes(2);
  });

  it("moves a focused hole by 0.1mm or 1mm with arrow keys", () => {
    const updateParams = vi.fn();
    render(
      <BaseConverterPreview
        params={{ ...BASE_CONVERTER_DEFAULTS, generationKind: "push-fit" }}
        updateParams={updateParams}
      />,
    );
    const hole = screen.getByRole("button", { name: "拖动简版六边孔" });

    fireEvent.keyDown(hole, { key: "ArrowRight" });
    fireEvent.keyDown(hole, { key: "ArrowUp", shiftKey: true });

    expect(updateParams).toHaveBeenCalledTimes(2);
    expect(updateParams.mock.calls[0][0](BASE_CONVERTER_DEFAULTS).pushFitHexHole)
      .toMatchObject({ offsetX: 0.1, offsetY: 0 });
    expect(updateParams.mock.calls[1][0](BASE_CONVERTER_DEFAULTS).pushFitHexHole)
      .toMatchObject({ offsetX: 0, offsetY: 1 });
  });

  it("renders the selected standard conversion and fixed-clearance recess", () => {
    const { container } = render(
      <BaseConverterPreview params={{
        ...BASE_CONVERTER_DEFAULTS,
        sourceStandardId: "source-50x100",
        targetStandardId: "target-ellipse-70x105",
        geometrySnapshot: createConversionGeometrySnapshot(
          SOURCE_BASE_STANDARDS.find((item) => item.id === "source-50x100")!,
          TARGET_BASE_STANDARDS.find((item) => item.id === "target-ellipse-70x105")!,
        ),
      }} />,
    );

    expect(screen.getByLabelText("转换底盘 2D 图")).toBeInTheDocument();
    expect(screen.getByText(/50 × 100mm → 70 × 105mm/)).toBeInTheDocument();
    const recess = container.querySelector("rect[clip-path]");
    expect(recess).toHaveAttribute("width", "50.4");
    expect(recess).toHaveAttribute("height", "100.4");
    expect(recess).toHaveAttribute("rx", "0.2");
    expect(container.querySelector("clipPath path")).toHaveAttribute(
      "d",
      expect.stringContaining("M 35 0"),
    );
  });

  it("shows the inset top outline when side bevel is enabled", () => {
    const { container } = render(
      <BaseConverterPreview
        params={{
          ...BASE_CONVERTER_DEFAULTS,
          sideBevelWidth: 2,
        }}
      />,
    );

    expect(container.querySelector('path[stroke-dasharray="1 0.8"]'))
      .toBeInTheDocument();
  });

  it("renders a circular recess for round-to-round conversion", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) =>
      item.id === "source-circle-20")!;
    const target = TARGET_BASE_STANDARDS.find((item) =>
      item.id === "target-circle-25")!;
    const { container } = render(
      <BaseConverterPreview params={{
        ...BASE_CONVERTER_DEFAULTS,
        sourceStandardId: source.id,
        targetStandardId: target.id,
        geometrySnapshot: createConversionGeometrySnapshot(source, target),
      }} />,
    );

    expect(screen.getByText(/Ø20mm → Ø25mm/)).toBeInTheDocument();
    const recess = container.querySelector("ellipse[clip-path]");
    expect(recess).toHaveAttribute("rx", "10.2");
    expect(recess).toHaveAttribute("ry", "10.2");
  });
});
