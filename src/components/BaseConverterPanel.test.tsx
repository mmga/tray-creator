import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BaseConverterPanel from "@/components/BaseConverterPanel";
import { ToastProvider, Toaster } from "@/hooks/useToast";
import {
  BASE_CONVERTER_DEFAULTS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  createConversionGeometrySnapshot,
} from "@/lib/base-converter-config";

function renderPanel(
  params = BASE_CONVERTER_DEFAULTS,
  overrides: Partial<React.ComponentProps<typeof BaseConverterPanel>> = {},
) {
  const props: React.ComponentProps<typeof BaseConverterPanel> = {
    params,
    updateParam: vi.fn(),
    updateParams: vi.fn(),
    beginContinuousEdit: vi.fn(() => true),
    previewParam: vi.fn(),
    commitContinuousEdit: vi.fn(),
    cancelContinuousEdit: vi.fn(),
    undo: vi.fn(),
    canUndo: false,
    actions: <div>操作区</div>,
    isGenerating: false,
    isPreviewStale: false,
    volume: 0,
    ...overrides,
  };
  return {
    ...render(
      <ToastProvider>
        <BaseConverterPanel {...props} />
        <Toaster />
      </ToastProvider>,
    ),
    props,
  };
}

describe("BaseConverterPanel", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    window.localStorage.clear();
  });

  it("shows adjustable clearance, all structure controls, and incompatible targets remain selectable", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) => item.id === "source-50x100")!;
    const target = TARGET_BASE_STANDARDS.find((item) => item.id === "target-ellipse-70x105")!;
    renderPanel({
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: source.id,
      targetStandardId: target.id,
      geometrySnapshot: createConversionGeometrySnapshot(source, target),
    });

    expect(screen.getAllByText("0.20 mm").length).toBeGreaterThan(0);
    expect(screen.getByText("50.40 × 100.40 mm")).toBeInTheDocument();
    expect(screen.getByText("底部保留厚度")).toBeInTheDocument();
    expect(screen.getByText("凹槽深度 / 挡边高度")).toBeInTheDocument();
    expect(screen.getByText("侧面斜面宽度")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "目标圆形 / 椭圆底盘" }));
    const incompatibleOption = screen
      .getAllByText("标准 · 圆形 · Ø25mm")
      .map((element) => element.closest('[role="option"]'))
      .find(Boolean);
    expect(incompatibleOption).not.toHaveAttribute("data-disabled");
  });

  it("applies custom target axes in short-to-long order with the shared fullness default", () => {
    const updateParams = vi.fn();
    renderPanel(BASE_CONVERTER_DEFAULTS, { updateParams });

    fireEvent.click(screen.getByRole("button", { name: /自定义与个人规格/ }));
    const shortAxis = screen.getByLabelText("短轴 mm");
    const longAxis = screen.getByLabelText("长轴 mm");
    fireEvent.change(shortAxis, { target: { value: "80" } });
    fireEvent.change(longAxis, { target: { value: "40" } });
    const applyButtons = screen.getAllByRole("button", { name: "应用" });
    fireEvent.click(applyButtons[1]);

    const mutate = updateParams.mock.calls[0][0] as (
      params: typeof BASE_CONVERTER_DEFAULTS,
    ) => typeof BASE_CONVERTER_DEFAULTS;
    const next = mutate(BASE_CONVERTER_DEFAULTS);
    expect(next.geometrySnapshot.target).toMatchObject({
      shape: "ellipse",
      width: 40,
      depth: 80,
      profileExponent: 2.6,
    });
  });

  it("exposes undo without mixing personal-library deletion into parameter edits", () => {
    const undo = vi.fn();
    renderPanel(BASE_CONVERTER_DEFAULTS, { undo, canUndo: true });

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("offers circular source standards", () => {
    const source = SOURCE_BASE_STANDARDS.find((item) =>
      item.id === "source-circle-20")!;
    const target = TARGET_BASE_STANDARDS.find((item) =>
      item.id === "target-circle-25")!;
    renderPanel({
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: source.id,
      targetStandardId: target.id,
      geometrySnapshot: createConversionGeometrySnapshot(source, target),
    });

    fireEvent.click(screen.getByRole("combobox", { name: "原底盘" }));
    expect(
      screen.getAllByText("标准 · 圆形 · Ø20mm")
        .some((element) => element.closest('[role="option"]')),
    ).toBe(true);
  });

  it("does not apply a personal specification when browser storage rejects it", () => {
    const updateParams = vi.fn();
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("quota exceeded");
    });
    renderPanel(BASE_CONVERTER_DEFAULTS, { updateParams });

    fireEvent.click(screen.getByRole("button", { name: /自定义与个人规格/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "保存并应用" })[0]);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "个人规格保存失败：quota exceeded",
    );
    expect(updateParams).not.toHaveBeenCalled();
    expect(screen.queryByText("个人规格库")).not.toBeInTheDocument();
  });
});
