import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_PRESETS } from "@/lib/config";
import { CUSTOM_LAYOUT_DEFAULTS, ELLIPSE_PRESETS } from "@/lib/custom-config";
import { PARAM_CONFIG, DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { calculateSimpleSteppedDimensions, deriveSimpleSteppedLayout } from "@/lib/simple-stepped-layout";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import { buildSteppedPerfFixture } from "@/lib/stepped-perf-fixtures";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";

const {
  useAutoPreviewMock,
  toastMock,
  resetPerfMetricsMock,
  isPerfEnabledMock,
} = vi.hoisted(() => ({
  useAutoPreviewMock: vi.fn(),
  toastMock: vi.fn(),
  resetPerfMetricsMock: vi.fn(),
  isPerfEnabledMock: vi.fn(() => false),
}));

vi.mock("@/hooks/useAutoPreview", () => ({
  useAutoPreview: useAutoPreviewMock,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/perf", () => ({
  isPerfEnabled: isPerfEnabledMock,
  resetPerfMetrics: resetPerfMetricsMock,
}));

vi.mock("@/components/ui/SectionHeader", () => ({
  SectionHeader({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) {
    return (
      <section>
        <h2>{title}</h2>
        <div>{children}</div>
      </section>
    );
  },
}));

vi.mock("@/components/BaseHoleConfig", () => ({
  BaseHoleConfig() {
    return <div data-testid="base-hole-config" />;
  },
}));

vi.mock("@/components/ui/switch", () => ({
  Switch({
    checked = false,
    onCheckedChange,
    onClick,
    id,
    "aria-label": ariaLabel,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    id?: string;
    "aria-label"?: string;
  }) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? id ?? "switch"}
        onClick={(event) => {
          onClick?.(event);
          onCheckedChange?.(!checked);
        }}
      />
    );
  },
}));

vi.mock("@/components/ui/select", async () => {
  const ReactModule = await import("react");

  const SelectContext = ReactModule.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  return {
    Select({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
    }) {
      return (
        <SelectContext.Provider value={{ value, onValueChange }}>
          {children}
        </SelectContext.Provider>
      );
    },
    SelectTrigger({ children }: { children: React.ReactNode }) {
      return <div>{children}</div>;
    },
    SelectValue({ placeholder }: { placeholder?: string }) {
      const { value } = ReactModule.useContext(SelectContext);
      return <span>{value ?? placeholder}</span>;
    },
    SelectContent({ children }: { children: React.ReactNode }) {
      return <div>{children}</div>;
    },
    SelectItem({
      value,
      children,
    }: {
      value: string;
      children: React.ReactNode;
    }) {
      const { onValueChange } = ReactModule.useContext(SelectContext);
      return (
        <button type="button" onClick={() => onValueChange?.(value)}>
          {children}
        </button>
      );
    },
  };
});

vi.mock("@/components/ui/ParamSlider", () => ({
  ParamSlider({
    label,
    value,
    onChange,
    config,
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    config: { step: number };
  }) {
    const nextValue = Number((value + config.step).toFixed(2));

    return (
      <div>
        <span>{label}</span>
        <button type="button" onClick={() => onChange(nextValue)}>
          {`设置${label}:${value}`}
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/PanelActionSection", () => ({
  PanelActionSection({
    autoPreview,
    onAutoPreviewChange,
    onGenerate,
    onExportSTL,
    onReset,
    onImport,
    mode,
    draftActions,
    showStaleNotice,
    isGenerating,
  }: {
    autoPreview?: boolean;
    onAutoPreviewChange?: (checked: boolean) => void;
    onGenerate: () => void;
    onExportSTL: () => void;
    onReset: () => void;
    onImport: (params: unknown) => void;
    mode: string;
    draftActions?: {
      currentDraftId: string | null;
      hasUnsavedChanges: boolean;
      onSaveDraft: () => void;
      onOpenDraftDialog: () => void;
    };
    showStaleNotice?: boolean;
    isGenerating: boolean;
    isOversized: boolean;
  }) {
    return (
      <div data-testid={`panel-actions-${mode}`}>
        {showStaleNotice ? (
          <div>当前预览已过期，请点击“开始锻造”生成最新模型。</div>
        ) : null}
        {onAutoPreviewChange ? (
          <button
            type="button"
            onClick={() => onAutoPreviewChange(!autoPreview)}
          >
            启用自动预览
          </button>
        ) : null}
        <button type="button" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? "锻造中..." : "开始锻造"}
        </button>
        <button type="button" onClick={onExportSTL}>
          导出 STL
        </button>
        <button type="button" onClick={onReset}>
          重置参数
        </button>
        <button
          type="button"
          onClick={() => onImport({ importedMode: mode })}
        >
          导入参数
        </button>
        {draftActions ? (
          <>
            <button type="button" onClick={draftActions.onSaveDraft}>
              {draftActions.currentDraftId ? "更新草稿" : "保存草稿"}
            </button>
            <button type="button" onClick={draftActions.onOpenDraftDialog}>
              草稿列表
            </button>
            {draftActions.hasUnsavedChanges ? <div>有未保存修改</div> : null}
          </>
        ) : null}
      </div>
    );
  },
}));

vi.mock("@/components/ParamIOButtons", () => ({
  ParamIOButtons({
    mode,
    onImport,
  }: {
    mode: string;
    onImport: (params: unknown) => void;
  }) {
    return (
      <button type="button" onClick={() => onImport({ importedMode: mode })}>
        导入参数
      </button>
    );
  },
}));

import CustomPanel from "@/components/CustomPanel";
import ParameterPanel from "@/components/ParameterPanel";
import SimpleSteppedPanel from "@/components/SimpleSteppedPanel";
import SteppedPanel from "@/components/SteppedPanel";

const HUNDRED_MM_PRESET = BASE_PRESETS.find(
  (preset) => preset.diameter === 100,
)!;

function createSteppedParams(overrides?: Partial<React.ComponentProps<typeof SteppedPanel>["params"]>) {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    slots: [
      {
        id: "slot-1",
        x: 120,
        y: 130,
        shape: "circle" as const,
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "group-1",
      },
    ],
    groups: [
      {
        id: "group-1",
        name: "组 1",
        color: "#ef4444",
        bottomHeight: 10,
        useGroupSmoothingRadius: false,
        groupSmoothingRadius: 40,
        useGroupDisconnectDistance: false,
        groupDisconnectDistance: 4,
      },
      {
        id: "group-2",
        name: "组 2",
        color: "#3b82f6",
        bottomHeight: 16,
        useGroupSmoothingRadius: false,
        groupSmoothingRadius: 55,
        useGroupDisconnectDistance: false,
        groupDisconnectDistance: 6,
      },
    ],
    activeGroupId: "group-1",
    ...overrides,
  };
}

function createSimpleSteppedParams(
  overrides?: Partial<React.ComponentProps<typeof SimpleSteppedPanel>["params"]>,
) {
  return {
    ...SIMPLE_STEPPED_LAYOUT_DEFAULTS,
    trayWidth: 150,
    trayDepth: 130,
    rows: [
      { id: "row-1", name: "前排", slotIds: ["slot-1"] },
      { id: "row-2", name: "后排", slotIds: ["slot-2"] },
    ],
    slots: [
      {
        id: "slot-1",
        rowId: "row-1",
        shape: "circle" as const,
        diameter: 25,
        x: 0,
        y: 0,
      },
      {
        id: "slot-2",
        rowId: "row-2",
        shape: "circle" as const,
        diameter: 40,
        x: 12,
        y: 0,
      },
    ],
    firstRowHeight: 5,
    stepHeight: 4,
    rowGap: 6,
    spacing: 5,
    outerMarginIndependent: false,
    outerMargin: 5,
    holeDepth: 3,
    cornerRadius: 4,
    ...overrides,
  };
}

function createOptimizationProposals(): React.ComponentProps<
  typeof SteppedPanel
>["optimizationProposals"] {
  return [
    {
      id: "compact",
      kind: "compact",
      label: "紧凑对称",
      description: "仅在组内重排，不跨组混排；优先保证左右对称，并尽量收敛到横向约 5:2 的长方形。",
      params: createSteppedParams(),
      metrics: {
        width: 92,
        depth: 78,
        area: 7176,
        displacement: 48.6,
        hasBridgeWarning: false,
        isOversized: false,
      },
    },
  ];
}

describe("ParameterPanel", { timeout: 15000 }, () => {
  beforeEach(() => {
    useAutoPreviewMock.mockReset();
  });

  it("wires preset changes and boundary spacing controls", () => {
    const updateParam = vi.fn();

    render(
      <ParameterPanel
        params={{ ...DEFAULT_TRAY_PARAMS, boundarySpacingIndependent: true }}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        resetParams={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: HUNDRED_MM_PRESET.name }),
    );
    fireEvent.click(
      screen.getByRole("switch", {
        name: "grid-boundary-spacing-independent",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置${PARAM_CONFIG.boundarySpacing.label}:${DEFAULT_TRAY_PARAMS.boundarySpacing}`,
      }),
    );

    expect(updateParam).toHaveBeenNthCalledWith(
      1,
      "holeDiameter",
      HUNDRED_MM_PRESET.diameter,
    );
    expect(updateParam).toHaveBeenNthCalledWith(
      2,
      "boundarySpacingIndependent",
      false,
    );
    expect(updateParam).toHaveBeenNthCalledWith(
      3,
      "boundarySpacing",
      DEFAULT_TRAY_PARAMS.boundarySpacing + PARAM_CONFIG.boundarySpacing.step,
    );
  });

  it("routes panel actions through the expected handlers", () => {
    const replaceParams = vi.fn();
    const resetParams = vi.fn();
    const onGenerate = vi.fn();
    const onExportSTL = vi.fn();

    render(
      <ParameterPanel
        params={DEFAULT_TRAY_PARAMS}
        updateParam={vi.fn()}
        replaceParams={replaceParams}
        resetParams={resetParams}
        onGenerate={onGenerate}
        onExportSTL={onExportSTL}
        isGenerating={false}
        volume={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "启用自动预览" }));
    fireEvent.click(screen.getByRole("button", { name: "开始锻造" }));
    fireEvent.click(screen.getByRole("button", { name: "导出 STL" }));
    fireEvent.click(screen.getByRole("button", { name: "重置参数" }));
    fireEvent.click(screen.getByRole("button", { name: "导入参数" }));

    expect(useAutoPreviewMock).toHaveBeenLastCalledWith(
      DEFAULT_TRAY_PARAMS,
      expect.objectContaining({
        enabled: true,
        isGenerating: false,
        isBlocked: false,
      }),
    );
    expect(onGenerate).toHaveBeenCalledWith({ shouldSwitchView: true });
    expect(onExportSTL).toHaveBeenCalledTimes(1);
    expect(resetParams).toHaveBeenCalledTimes(1);
    expect(replaceParams).toHaveBeenCalledWith({ importedMode: "grid" });
  });

  it("surfaces oversized grid state and blocks auto preview generation", () => {
    render(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          rows: 6,
          columns: 6,
          holeDiameter: 60,
          spacing: 10,
        }}
        updateParam={vi.fn()}
        replaceParams={vi.fn()}
        resetParams={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={1000}
      />,
    );

    expect(screen.getByText("超过常规打印尺寸 (260×260mm)，仍可继续建模")).toBeInTheDocument();
    expect(screen.getByText("PLA估重: 0.7g")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "启用自动预览" }));

    expect(useAutoPreviewMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rows: 6,
        columns: 6,
        holeDiameter: 60,
      }),
      expect.objectContaining({
        enabled: true,
        isBlocked: false,
        isGenerating: false,
      }),
    );
  });

  it("updates spacing-independent grid controls and shows an unmatched preset placeholder", () => {
    const updateParam = vi.fn();

    render(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          holeDiameter: 27,
          spacingIndependent: true,
          spacingX: 6.5,
          spacingY: 7.5,
          boundarySpacingIndependent: false,
          boundarySpacing: 9,
        }}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        resetParams={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByText("选择底座尺寸")).toBeInTheDocument();
    expect(screen.getByText("待锻造")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("switch", {
        name: "grid-spacing-independent",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置${PARAM_CONFIG.spacingX.label}:6.5`,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置${PARAM_CONFIG.spacingY.label}:7.5`,
      }),
    );

    expect(updateParam).toHaveBeenNthCalledWith(
      1,
      "spacingIndependent",
      false,
    );
    expect(updateParam).toHaveBeenNthCalledWith(2, "spacingX", 6.6);
    expect(updateParam).toHaveBeenNthCalledWith(3, "spacingY", 7.6);
  });

  it("routes structure controls when base holes are enabled and shows generating text without volume", () => {
    const updateParam = vi.fn();
    const { rerender } = render(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          enableBaseHole: true,
          baseThickness: 3,
          holeDepth: 3,
          cornerRadius: 4,
        }}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        resetParams={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={true}
        volume={0}
      />,
    );

    expect(screen.getByText("图纸生成中...")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: `设置${PARAM_CONFIG.baseThickness.label}:${DEFAULT_TRAY_PARAMS.baseThickness}`,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置${PARAM_CONFIG.holeDepth.label}:${DEFAULT_TRAY_PARAMS.holeDepth}`,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置${PARAM_CONFIG.cornerRadius.label}:${DEFAULT_TRAY_PARAMS.cornerRadius}`,
      }),
    );

    expect(updateParam).toHaveBeenNthCalledWith(1, "baseThickness", 3.2);
    expect(updateParam).toHaveBeenNthCalledWith(2, "holeDepth", 3.2);
    expect(updateParam).toHaveBeenNthCalledWith(3, "cornerRadius", 5);

    rerender(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          enableBaseHole: true,
        }}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        resetParams={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByText("待锻造")).toBeInTheDocument();
  });

  it("updates columns, rows, unified spacing, and reuses the auto-preview generate callback", () => {
    const updateParam = vi.fn();
    const onGenerate = vi.fn();

    render(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          columns: 2,
          rows: 5,
          spacingIndependent: false,
          spacing: 5,
        }}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        resetParams={vi.fn()}
        onGenerate={onGenerate}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "启用自动预览" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置${PARAM_CONFIG.columns.label}:${DEFAULT_TRAY_PARAMS.columns}`,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置${PARAM_CONFIG.rows.label}:${DEFAULT_TRAY_PARAMS.rows}`,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置${PARAM_CONFIG.spacing.label}:${DEFAULT_TRAY_PARAMS.spacing}`,
      }),
    );

    const autoPreviewOptions = useAutoPreviewMock.mock.calls.at(-1)?.[1] as
      | { onGenerate?: () => void }
      | undefined;
    autoPreviewOptions?.onGenerate?.();

    expect(updateParam).toHaveBeenNthCalledWith(1, "columns", 3);
    expect(updateParam).toHaveBeenNthCalledWith(2, "rows", 6);
    expect(updateParam).toHaveBeenNthCalledWith(3, "spacing", 6);
    expect(onGenerate).toHaveBeenCalledWith({ shouldSwitchView: false });
  });

  it("routes mutually exclusive grid structure modes from advanced settings", () => {
    const updateParam = vi.fn();
    const { rerender } = render(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          rows: 1,
          halfCircleSlots: false,
        }}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        resetParams={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "半圆槽" }));

    expect(updateParam).toHaveBeenCalledWith("halfCircleSlots", true);

    rerender(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          rows: 3,
          columns: 1,
          halfCircleSlots: true,
        }}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        resetParams={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByRole("button", { name: "半圆槽" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    rerender(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          rows: 2,
          columns: 2,
          halfCircleSlots: true,
        }}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        resetParams={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByRole("button", { name: "半圆槽" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "仅内嵌孔底板" }));

    expect(updateParam).toHaveBeenLastCalledWith("basePlateOnly", true);

    rerender(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          rows: 1,
          halfCircleSlots: true,
          basePlateOnly: false,
        }}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        resetParams={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "完整圆槽" }));

    expect(updateParam).toHaveBeenNthCalledWith(
      updateParam.mock.calls.length - 1,
      "halfCircleSlots",
      false,
    );
    expect(updateParam).toHaveBeenLastCalledWith("basePlateOnly", false);
  });
});

describe("CustomPanel", { timeout: 15000 }, () => {
  beforeEach(() => {
    useAutoPreviewMock.mockReset();
  });

  it("adds circular and ellipse slots from preset buttons", () => {
    const onAddSlot = vi.fn();

    render(
      <CustomPanel
        params={CUSTOM_LAYOUT_DEFAULTS}
        effectiveDimensions={{ width: 120, depth: 140 }}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={onAddSlot}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: String(HUNDRED_MM_PRESET.diameter),
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: ELLIPSE_PRESETS[0].name.replace("mm", ""),
      }),
    );

    expect(onAddSlot).toHaveBeenNthCalledWith(1, HUNDRED_MM_PRESET.diameter);
    expect(onAddSlot).toHaveBeenNthCalledWith(
      2,
      ELLIPSE_PRESETS[0].width,
      ELLIPSE_PRESETS[0].height,
      {
        slotDefinitionId: ELLIPSE_PRESETS[0].id,
        outerOffset: ELLIPSE_PRESETS[0].outerOffset,
        profileExponent: ELLIPSE_PRESETS[0].profileExponent,
      },
    );
  });

  it("does not render a global ellipse fullness control", () => {
    render(
      <CustomPanel
        params={CUSTOM_LAYOUT_DEFAULTS}
        effectiveDimensions={{ width: 120, depth: 140 }}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.queryByText("椭圆丰满度")).not.toBeInTheDocument();
  });

  it("routes layout actions and reset/import through the panel controls", () => {
    const updateParam = vi.fn();
    const setParams = vi.fn();
    const onGenerate = vi.fn();
    const onExportSTL = vi.fn();

    render(
      <CustomPanel
        params={{ ...CUSTOM_LAYOUT_DEFAULTS, boundarySpacingIndependent: true }}
        effectiveDimensions={{ width: 120, depth: 140 }}
        updateParam={updateParam}
        setParams={setParams}
        onAddSlot={vi.fn()}
        onGenerate={onGenerate}
        onExportSTL={onExportSTL}
        isGenerating={false}
        volume={0}
      />,
    );

    fireEvent.click(
      screen.getByRole("switch", {
        name: "custom-boundary-spacing-independent",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置边界间距:${CUSTOM_LAYOUT_DEFAULTS.boundarySpacing}`,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "启用自动预览" }));
    fireEvent.click(screen.getByRole("button", { name: "开始锻造" }));
    fireEvent.click(screen.getByRole("button", { name: "导出 STL" }));
    fireEvent.click(screen.getByRole("button", { name: "重置参数" }));
    fireEvent.click(screen.getByRole("button", { name: "导入参数" }));

    expect(updateParam).toHaveBeenNthCalledWith(
      1,
      "boundarySpacingIndependent",
      false,
    );
    expect(updateParam).toHaveBeenNthCalledWith(
      2,
      "boundarySpacing",
      CUSTOM_LAYOUT_DEFAULTS.boundarySpacing + 1,
    );
    expect(useAutoPreviewMock).toHaveBeenLastCalledWith(
      { ...CUSTOM_LAYOUT_DEFAULTS, boundarySpacingIndependent: true },
      expect.objectContaining({
        enabled: true,
        isGenerating: false,
        isBlocked: false,
      }),
    );
    expect(onGenerate).toHaveBeenCalledWith({ shouldSwitchView: true });
    expect(onExportSTL).toHaveBeenCalledTimes(1);
    expect(setParams).toHaveBeenNthCalledWith(1, CUSTOM_LAYOUT_DEFAULTS);
    expect(setParams).toHaveBeenNthCalledWith(2, { importedMode: "custom" });
  });
});

describe("SimpleSteppedPanel", { timeout: 15000 }, () => {
  it("routes row management and slot insertion controls", () => {
    const params = createSimpleSteppedParams();
    const derivedLayout = deriveSimpleSteppedLayout(params, "row-1");
    const effectiveDimensions = calculateSimpleSteppedDimensions(params);
    const onSetActiveRow = vi.fn();
    const onAddRow = vi.fn();
    const onRemoveRow = vi.fn();
    const onRenameRow = vi.fn();
    const onClearRow = vi.fn();
    const onReorderRows = vi.fn();
    const onAddSlotToRow = vi.fn();

    render(
      <SimpleSteppedPanel
        params={params}
        derivedLayout={derivedLayout}
        activeRowId="row-1"
        effectiveDimensions={effectiveDimensions}
        setParams={vi.fn()}
        updateParam={vi.fn()}
        onSetActiveRow={onSetActiveRow}
        onAddRow={onAddRow}
        onRemoveRow={onRemoveRow}
        onRenameRow={onRenameRow}
        onClearRow={onClearRow}
        onReorderRows={onReorderRows}
        onAddSlotToRow={onAddSlotToRow}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        onTrimTray={vi.fn()}
        isGenerating={false}
        isPreviewStale={false}
        volume={0}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("前排"), {
      target: { value: "第一排" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: String(HUNDRED_MM_PRESET.diameter),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "清空本行" }));
    fireEvent.click(screen.getByText("后排"));
    fireEvent.click(screen.getAllByTitle("下移")[0]!);
    fireEvent.click(screen.getAllByTitle("删除行")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "新建行" }));

    expect(onRenameRow).toHaveBeenCalledWith("row-1", "第一排");
    expect(onAddSlotToRow).toHaveBeenCalledWith(
      "row-1",
      HUNDRED_MM_PRESET.diameter,
    );
    expect(onClearRow).toHaveBeenCalledWith("row-1");
    expect(onSetActiveRow).toHaveBeenCalledWith("row-2");
    expect(onReorderRows).toHaveBeenCalledWith(0, 1);
    expect(onRemoveRow).toHaveBeenCalledWith("row-1");
    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  it("routes structure, trim, generate, export, reset, and import controls", () => {
    const params = createSimpleSteppedParams({
      outerMarginIndependent: true,
      outerMargin: 8,
    });
    const derivedLayout = deriveSimpleSteppedLayout(params, "row-1");
    const effectiveDimensions = calculateSimpleSteppedDimensions(params);
    const updateParam = vi.fn();
    const setParams = vi.fn();
    const onGenerate = vi.fn();
    const onExportSTL = vi.fn();
    const onTrimTray = vi.fn();

    render(
      <SimpleSteppedPanel
        params={params}
        derivedLayout={derivedLayout}
        activeRowId="row-1"
        effectiveDimensions={effectiveDimensions}
        setParams={setParams}
        updateParam={updateParam}
        onSetActiveRow={vi.fn()}
        onAddRow={vi.fn()}
        onRemoveRow={vi.fn()}
        onRenameRow={vi.fn()}
        onClearRow={vi.fn()}
        onReorderRows={vi.fn()}
        onAddSlotToRow={vi.fn()}
        onGenerate={onGenerate}
        onExportSTL={onExportSTL}
        onTrimTray={onTrimTray}
        isGenerating={false}
        isPreviewStale={true}
        volume={1000}
      />,
    );

    expect(screen.getByText("当前预览已过期，请点击“开始锻造”生成最新模型。")).toBeInTheDocument();
    expect(screen.getByText("¥0.3")).toBeInTheDocument();
    expect(screen.getByText("估重: 0.7g")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("switch", {
        name: "simple-stepped-outer-margin-independent",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "设置首排高度:5" }));
    fireEvent.click(screen.getByRole("button", { name: "设置阶梯步进:4" }));
    fireEvent.click(screen.getByRole("button", { name: "设置行间距:6" }));
    fireEvent.click(screen.getByRole("button", { name: "设置凹槽间距:5" }));
    fireEvent.click(screen.getByRole("button", { name: "设置边界间距:8" }));
    fireEvent.click(screen.getByRole("button", { name: "设置凹槽深度:3" }));
    fireEvent.click(screen.getByRole("button", { name: "设置底板圆角:4" }));
    fireEvent.click(screen.getByRole("button", { name: "Trim 到凹槽占用区域" }));
    fireEvent.click(screen.getByRole("button", { name: "开始锻造" }));
    fireEvent.click(screen.getByRole("button", { name: "导出 STL" }));
    fireEvent.click(screen.getByRole("button", { name: "重置参数" }));
    fireEvent.click(screen.getByRole("button", { name: "导入参数" }));

    expect(updateParam).toHaveBeenNthCalledWith(
      1,
      "outerMarginIndependent",
      false,
    );
    expect(updateParam).toHaveBeenNthCalledWith(2, "firstRowHeight", 5.5);
    expect(updateParam).toHaveBeenNthCalledWith(3, "stepHeight", 4.5);
    expect(updateParam).toHaveBeenNthCalledWith(4, "rowGap", 7);
    expect(updateParam).toHaveBeenNthCalledWith(5, "spacing", 6);
    expect(updateParam).toHaveBeenNthCalledWith(6, "outerMargin", 9);
    expect(updateParam).toHaveBeenNthCalledWith(7, "holeDepth", 3.2);
    expect(updateParam).toHaveBeenNthCalledWith(8, "cornerRadius", 5);
    expect(onTrimTray).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onExportSTL).toHaveBeenCalledTimes(1);
    expect(setParams).toHaveBeenNthCalledWith(1, SIMPLE_STEPPED_LAYOUT_DEFAULTS);
    expect(setParams).toHaveBeenNthCalledWith(
      2,
      { importedMode: "simple-stepped" },
    );
  });

  it("shows disabled states when no row is active, nothing can trim, and the layout is oversized", () => {
    const params = createSimpleSteppedParams();
    const derivedLayout = deriveSimpleSteppedLayout(params, null);
    const onGenerate = vi.fn();

    render(
      <SimpleSteppedPanel
        params={params}
        derivedLayout={{
          ...derivedLayout,
          trayWidth: derivedLayout.minimumTrayWidth,
          trayDepth: derivedLayout.minimumTrayDepth,
        }}
        activeRowId={null}
        effectiveDimensions={{ width: 300, depth: 280, height: 12 }}
        setParams={vi.fn()}
        updateParam={vi.fn()}
        onSetActiveRow={vi.fn()}
        onAddRow={vi.fn()}
        onRemoveRow={vi.fn()}
        onRenameRow={vi.fn()}
        onClearRow={vi.fn()}
        onReorderRows={vi.fn()}
        onAddSlotToRow={vi.fn()}
        onGenerate={onGenerate}
        onExportSTL={vi.fn()}
        onTrimTray={vi.fn()}
        isGenerating={false}
        isPreviewStale={false}
        volume={0}
      />,
    );

    expect(screen.getByText("请先选择一行")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /25/ })[0]).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Trim 到凹槽占用区域" }),
    ).toBeDisabled();
    expect(screen.getByText("超过常规打印尺寸，仍可继续建模")).toBeInTheDocument();
    const generateButton = screen.getByRole("button", { name: "开始锻造" });
    expect(generateButton).not.toBeDisabled();
    fireEvent.click(generateButton);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("renders the empty-row state and only allows creating a new row", () => {
    const onAddRow = vi.fn();
    const params = createSimpleSteppedParams({
      rows: [],
      slots: [],
    });
    const derivedLayout = deriveSimpleSteppedLayout(params, null);

    render(
      <SimpleSteppedPanel
        params={params}
        derivedLayout={derivedLayout}
        activeRowId={null}
        effectiveDimensions={{ width: 0, depth: 0, height: 0 }}
        setParams={vi.fn()}
        updateParam={vi.fn()}
        onSetActiveRow={vi.fn()}
        onAddRow={onAddRow}
        onRemoveRow={vi.fn()}
        onRenameRow={vi.fn()}
        onClearRow={vi.fn()}
        onReorderRows={vi.fn()}
        onAddSlotToRow={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        onTrimTray={vi.fn()}
        isGenerating={false}
        isPreviewStale={false}
        volume={0}
      />,
    );

    expect(
      screen.getByText("还没有行，先新建一行再开始排布凹槽。"),
    ).toBeInTheDocument();
    expect(screen.getByText("请先选择一行")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /25/ })[0]!).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "新建行" }));

    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  it("renders fallback row metrics and generating state for rows missing derived layout", () => {
    const params = createSimpleSteppedParams({
      rows: [
        { id: "row-1", name: "前排", slotIds: ["slot-1"] },
        { id: "row-2", name: "空白排", slotIds: [] },
      ],
      slots: [
        {
          id: "slot-1",
          rowId: "row-1",
          shape: "circle" as const,
          diameter: 25,
          x: 0,
          y: 0,
        },
      ],
    });
    const derivedLayout = deriveSimpleSteppedLayout(params, "row-2");

    render(
      <SimpleSteppedPanel
        params={params}
        derivedLayout={derivedLayout}
        activeRowId="row-2"
        effectiveDimensions={{ width: 120, depth: 130, height: 9 }}
        setParams={vi.fn()}
        updateParam={vi.fn()}
        onSetActiveRow={vi.fn()}
        onAddRow={vi.fn()}
        onRemoveRow={vi.fn()}
        onRenameRow={vi.fn()}
        onClearRow={vi.fn()}
        onReorderRows={vi.fn()}
        onAddSlotToRow={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        onTrimTray={vi.fn()}
        isGenerating={true}
        isPreviewStale={false}
        volume={0}
      />,
    );

    expect(screen.getByText("0 槽位 / 空行")).toBeInTheDocument();
    expect(screen.getByText("图纸生成中...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "锻造中..." })).toBeDisabled();
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getAllByText("0mm")).toHaveLength(2);
  });
});

describe("SteppedPanel", { timeout: 15000 }, () => {
  beforeEach(() => {
    toastMock.mockReset();
    resetPerfMetricsMock.mockReset();
    isPerfEnabledMock.mockReset();
    isPerfEnabledMock.mockReturnValue(false);
  });

  it("updates the active group and its structure override controls", () => {
    const onSetActiveGroup = vi.fn();
    const onUpdateGroupSmoothingOverride = vi.fn();
    const onUpdateGroupDisconnectOverride = vi.fn();
    const onUpdateGroupSmoothingRadius = vi.fn();
    const onUpdateGroupDisconnectDistance = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams({
          groups: [
            {
              id: "group-1",
              name: "组 1",
              color: "#ef4444",
              bottomHeight: 10,
              useGroupSmoothingRadius: true,
              groupSmoothingRadius: 40,
              useGroupDisconnectDistance: true,
              groupDisconnectDistance: 4,
            },
            {
              id: "group-2",
              name: "组 2",
              color: "#3b82f6",
              bottomHeight: 16,
              useGroupSmoothingRadius: false,
              groupSmoothingRadius: 55,
              useGroupDisconnectDistance: false,
              groupDisconnectDistance: 6,
            },
          ],
        })}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={onUpdateGroupSmoothingOverride}
        onUpdateGroupSmoothingRadius={onUpdateGroupSmoothingRadius}
        onUpdateGroupDisconnectOverride={onUpdateGroupDisconnectOverride}
        onUpdateGroupDisconnectDistance={onUpdateGroupDisconnectDistance}
        onSetActiveGroup={onSetActiveGroup}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    fireEvent.click(screen.getAllByText("组 2")[0]!);
    fireEvent.click(
      screen.getByRole("switch", { name: "组 1 平滑半径独立设置" }),
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "组 1 槽群断连距离独立设置" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "设置平滑半径:40" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "设置槽群断连距离:4" }),
    );

    expect(onSetActiveGroup).toHaveBeenCalledWith("group-2");
    expect(onUpdateGroupSmoothingOverride).toHaveBeenCalledWith(
      "group-1",
      false,
    );
    expect(onUpdateGroupDisconnectOverride).toHaveBeenCalledWith(
      "group-1",
      false,
    );
    expect(onUpdateGroupSmoothingRadius).toHaveBeenCalledWith("group-1", 41);
    expect(onUpdateGroupDisconnectDistance).toHaveBeenCalledWith(
      "group-1",
      5,
    );
  });

  it("routes group action buttons and nested controls without bubbling selection", () => {
    const onSetActiveGroup = vi.fn();
    const onUpdateGroupHeight = vi.fn();
    const onUpdateGroupSmoothingOverride = vi.fn();
    const onUpdateGroupDisconnectOverride = vi.fn();
    const onReorderGroups = vi.fn();
    const onRemoveGroup = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams({
          groups: [
            {
              id: "group-1",
              name: "组 1",
              color: "#ef4444",
              bottomHeight: 10,
              useGroupSmoothingRadius: true,
              groupSmoothingRadius: 40,
              useGroupDisconnectDistance: true,
              groupDisconnectDistance: 4,
            },
            {
              id: "group-2",
              name: "组 2",
              color: "#3b82f6",
              bottomHeight: 16,
              useGroupSmoothingRadius: false,
              groupSmoothingRadius: 55,
              useGroupDisconnectDistance: false,
              groupDisconnectDistance: 6,
            },
          ],
        })}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={onRemoveGroup}
        onUpdateGroupHeight={onUpdateGroupHeight}
        onUpdateGroupSmoothingOverride={onUpdateGroupSmoothingOverride}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={onUpdateGroupDisconnectOverride}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={onSetActiveGroup}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={onReorderGroups}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "设置圆柱高度:10" }),
    );
    expect(onSetActiveGroup).toHaveBeenCalledWith("group-1");
    onSetActiveGroup.mockClear();
    fireEvent.click(
      screen.getByRole("switch", { name: "组 1 平滑半径独立设置" }),
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "组 1 槽群断连距离独立设置" }),
    );
    fireEvent.click(screen.getAllByTitle("下移")[0]!);
    fireEvent.click(screen.getAllByTitle("上移")[1]!);
    fireEvent.click(
      screen.getAllByTitle("删除组（同时删除组内所有凹槽）")[0]!,
    );

    expect(onUpdateGroupHeight).toHaveBeenCalledWith("group-1", 11);
    expect(onUpdateGroupSmoothingOverride).toHaveBeenCalledWith(
      "group-1",
      false,
    );
    expect(onUpdateGroupDisconnectOverride).toHaveBeenCalledWith(
      "group-1",
      false,
    );
    expect(onReorderGroups).toHaveBeenNthCalledWith(1, 0, 1);
    expect(onReorderGroups).toHaveBeenNthCalledWith(2, 1, 0);
    expect(onRemoveGroup).toHaveBeenCalledWith("group-1");
    expect(onSetActiveGroup).not.toHaveBeenCalled();
  });

  it("routes stepped split part merge target changes", () => {
    const onUpdateGroupSplitPartTarget = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onUpdateGroupSplitPartTarget={onUpdateGroupSplitPartTarget}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "并入 组 2 (16mm)" }));
    fireEvent.click(screen.getByRole("button", { name: "单独导出" }));

    expect(onUpdateGroupSplitPartTarget).toHaveBeenNthCalledWith(
      1,
      "group-1",
      "group-2",
    );
    expect(onUpdateGroupSplitPartTarget).toHaveBeenNthCalledWith(
      2,
      "group-1",
      null,
    );
  });

  it("routes stepped panel actions for add group, moving slots, reset, and import", () => {
    const setParams = vi.fn();
    const onAddGroup = vi.fn();
    const onMoveSelectedSlotsToGroup = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={true}
        updateParam={vi.fn()}
        setParams={setParams}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={["slot-1", "slot-2"]}
        onAddGroup={onAddGroup}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={onMoveSelectedSlotsToGroup}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "组 2" }));
    fireEvent.click(screen.getByRole("button", { name: "新建组" }));
    fireEvent.click(screen.getByRole("button", { name: "重置参数" }));
    fireEvent.click(screen.getByRole("button", { name: "导入参数" }));

    expect(onMoveSelectedSlotsToGroup).toHaveBeenCalledWith(
      ["slot-1", "slot-2"],
      "group-2",
    );
    expect(onAddGroup).toHaveBeenCalledTimes(1);
    expect(setParams).toHaveBeenNthCalledWith(1, STEPPED_LAYOUT_DEFAULTS);
    expect(setParams).toHaveBeenNthCalledWith(2, { importedMode: "stepped" });
  });

  it("adds slots from presets and updates global stepped structure controls", () => {
    const updateParam = vi.fn();
    const onAddSlot = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams({
          activeGroupId: "group-2",
          spacing: 5,
          holeDepth: 3,
          splitGrooveDepth: 2,
          smoothingRadius: 14,
          disconnectDistance: 2,
        })}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={updateParam}
        setParams={vi.fn()}
        onAddSlot={onAddSlot}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: String(HUNDRED_MM_PRESET.diameter),
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "设置凹槽间距:5" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "设置凹槽深度:3" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "设置装配槽深度:2" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "设置平滑半径:14" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "设置槽群断连距离:2" }),
    );

    expect(onAddSlot).toHaveBeenCalledWith(HUNDRED_MM_PRESET.diameter);
    expect(updateParam).toHaveBeenNthCalledWith(1, "spacing", 6);
    expect(updateParam).toHaveBeenNthCalledWith(2, "holeDepth", 3.2);
    expect(updateParam).toHaveBeenNthCalledWith(3, "splitGrooveDepth", 2.2);
    expect(updateParam).toHaveBeenNthCalledWith(4, "smoothingRadius", 15);
    expect(updateParam).toHaveBeenNthCalledWith(5, "disconnectDistance", 3);
  });

  it("routes CAD split groove type and locator controls", () => {
    const updateParam = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams({
          enableSplitRecess: false,
          splitGrooveType: "profile",
          enableSplitLocators: false,
        })}
        mode="stepped-cad"
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={updateParam}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    expect(screen.getByRole("button", { name: "关" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "轮廓凹槽" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "内缩凹槽" })).toBeInTheDocument();
    expect(screen.getByText("定位柱")).toBeInTheDocument();

    const locatorSwitch = screen
      .getByText("定位柱")
      .closest("label")
      ?.querySelector('[role="switch"]');
    expect(locatorSwitch).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "内缩凹槽" }));
    fireEvent.click(locatorSwitch!);

    expect(updateParam).toHaveBeenNthCalledWith(1, "enableSplitRecess", true);
    expect(updateParam).toHaveBeenNthCalledWith(2, "splitGrooveType", "inset");
    expect(updateParam).toHaveBeenNthCalledWith(3, "enableSplitLocators", true);
  });

  it("routes stepped magnetic base-hole mode toggles", () => {
    const updateParam = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={updateParam}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "磁吸孔" }));
    fireEvent.click(screen.getByRole("button", { name: "普通托盘" }));

    expect(updateParam).toHaveBeenNthCalledWith(1, "enableBaseHole", true);
    expect(updateParam).toHaveBeenNthCalledWith(2, "enableBaseHole", false);
  });

  it("shows the stepped pricing formula tooltip on hover", () => {
    render(
      <SteppedPanel
        params={createSteppedParams({
          slots: [
            {
              id: "slot-1",
              x: 80,
              y: 120,
              shape: "circle",
              width: 40,
              height: 40,
              rotation: 0,
              groupId: "group-1",
            },
            {
              id: "slot-2",
              x: 132,
              y: 120,
              shape: "circle",
              width: 60,
              height: 60,
              rotation: 0,
              groupId: "group-2",
            },
          ],
          groups: [
            {
              id: "group-1",
              name: "组 1",
              color: "#ef4444",
              bottomHeight: 12,
              useGroupSmoothingRadius: false,
              groupSmoothingRadius: 15,
              useGroupDisconnectDistance: false,
              groupDisconnectDistance: 0,
            },
            {
              id: "group-2",
              name: "组 2",
              color: "#3b82f6",
              bottomHeight: 28,
              useGroupSmoothingRadius: false,
              groupSmoothingRadius: 15,
              useGroupDisconnectDistance: false,
              groupDisconnectDistance: 0,
            },
          ],
          activeGroupId: "group-1",
          smoothingRadius: 15,
        })}
        effectiveDimensions={{ width: 122, depth: 70 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={32000}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "查看阶梯底座报价公式" }),
    );

    expect(screen.getByRole("tooltip")).toHaveTextContent("阶梯底座报价公式");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "价格 = round(1 + 0.10 × 估重 + 6.5 × 机时 + 占地 / 7000 + 复杂度)",
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "估重 = 真实体积(cm³) × 有效打印密度(g/cm³)",
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("最终报价");
  });

  it("shows fallback pricing help and generating or oversized status text", () => {
    const tooltipButtonLabel = "查看阶梯底座报价公式";
    const onGenerate = vi.fn();
    const { rerender } = render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={onGenerate}
        onExportSTL={vi.fn()}
        isGenerating={true}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    const tooltipButton = screen.getByRole("button", {
      name: tooltipButtonLabel,
    });

    expect(screen.getByText("图纸生成中...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "锻造中..." })).toBeDisabled();

    fireEvent.mouseEnter(tooltipButton);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "生成模型后会按当前体积估重，并同步计算机时、占地与复杂度。",
    );
    fireEvent.mouseLeave(tooltipButton);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(tooltipButton);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(tooltipButton, { relatedTarget: null });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(tooltipButton);
    expect(screen.getByRole("tooltip")).toHaveTextContent("复杂度 =");
    fireEvent.keyDown(tooltipButton, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    rerender(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 280, depth: 270 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={onGenerate}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    expect(screen.getByText("超过常规打印尺寸，仍可继续建模")).toBeInTheDocument();
    const generateButton = screen.getByRole("button", { name: "开始锻造" });
    expect(generateButton).not.toBeDisabled();
    fireEvent.click(generateButton);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("toggles preview groups through pointer and keyboard interactions", () => {
    const onPreviewGroupChange = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={onPreviewGroupChange}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    const previewButtons = screen.getAllByRole("button", {
      name: "按住仅查看当前组",
    });
    Object.defineProperty(previewButtons[0]!, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });

    fireEvent.pointerDown(previewButtons[0]!, { pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerUp(previewButtons[0]!, { pointerId: 1, pointerType: "mouse" });
    fireEvent.keyDown(previewButtons[1]!, { key: "Enter" });
    fireEvent.keyDown(previewButtons[1]!, { key: "Enter" });

    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(1, "group-1");
    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(2, null);
    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(3, "group-2");
    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(4, null);
  });

  it("clears preview on blur and invalidates preview groups removed from params", () => {
    const onPreviewGroupChange = vi.fn();
    const { rerender } = render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={onPreviewGroupChange}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    const previewButton = screen.getAllByRole("button", {
      name: "按住仅查看当前组",
    })[0]!;
    Object.defineProperty(previewButton, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });

    fireEvent.pointerDown(previewButton, { pointerId: 1, pointerType: "mouse" });
    window.dispatchEvent(new Event("blur"));

    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(1, "group-1");
    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(2, null);

    const nextParams = createSteppedParams();

    rerender(
      <SteppedPanel
        params={{
          ...nextParams,
          slots: [],
          groups: [nextParams.groups[0]!],
          activeGroupId: "group-1",
        }}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId="group-2"
        onPreviewGroupChange={onPreviewGroupChange}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(3, null);
  });

  it("supports touch preview locking, lost pointer capture cleanup, and repeat-key guards", () => {
    const onPreviewGroupChange = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={onPreviewGroupChange}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    const previewButtons = screen.getAllByRole("button", {
      name: "按住仅查看当前组",
    });
    Object.defineProperty(previewButtons[0]!, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });

    fireEvent.pointerDown(previewButtons[0]!, { pointerId: 1, pointerType: "mouse" });
    fireEvent(previewButtons[0]!, new Event("lostpointercapture", { bubbles: true }));
    fireEvent.pointerDown(previewButtons[1]!, { pointerId: 2, pointerType: "touch" });
    fireEvent.pointerDown(previewButtons[1]!, { pointerId: 3, pointerType: "touch" });
    fireEvent.keyDown(previewButtons[0]!, { key: " ", repeat: true });
    fireEvent.keyDown(previewButtons[0]!, { key: " " });

    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(1, "group-1");
    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(2, null);
    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(3, "group-2");
    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(4, null);
    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(5, "group-1");
    expect(onPreviewGroupChange).toHaveBeenCalledTimes(5);
  });

  it("ignores unrelated preview keys and clears pressed preview on pointer cancel", () => {
    const onPreviewGroupChange = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={onPreviewGroupChange}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    const previewButton = screen.getAllByRole("button", {
      name: "按住仅查看当前组",
    })[0]!;
    Object.defineProperty(previewButton, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });

    fireEvent.keyDown(previewButton, { key: "Escape" });
    fireEvent.pointerDown(previewButton, { pointerId: 7, pointerType: "mouse" });
    fireEvent.pointerCancel(previewButton, {
      pointerId: 7,
      pointerType: "mouse",
    });

    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(1, "group-1");
    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(2, null);
    expect(onPreviewGroupChange).toHaveBeenCalledTimes(2);
  });

  it("keeps preview button clicks and touch pointer-up from changing group selection", () => {
    const onSetActiveGroup = vi.fn();
    const onPreviewGroupChange = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 0, depth: 0 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={onSetActiveGroup}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={onPreviewGroupChange}
        bridgeWarning={null}
        optimizationProposals={[
          {
            ...createOptimizationProposals()[0]!,
            metrics: {
              ...createOptimizationProposals()[0]!.metrics,
              area: 0,
            },
          },
        ]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    const previewButton = screen.getAllByRole("button", {
      name: "按住仅查看当前组",
    })[0]!;

    fireEvent.click(previewButton);
    fireEvent.pointerDown(previewButton, { pointerId: 9, pointerType: "touch" });
    fireEvent.pointerUp(previewButton, { pointerId: 9, pointerType: "touch" });

    expect(screen.getByText("较当前 0.0%")).toBeInTheDocument();
    expect(onPreviewGroupChange).toHaveBeenCalledWith("group-1");
    expect(onSetActiveGroup).not.toHaveBeenCalled();
    expect(onPreviewGroupChange).toHaveBeenCalledTimes(1);
  });

  it("loads stepped perf fixtures and resets sampling through the perf panel", () => {
    isPerfEnabledMock.mockReturnValue(true);
    const setParams = vi.fn();
    const onPreviewGroupChange = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={setParams}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId="group-1"
        onPreviewGroupChange={onPreviewGroupChange}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    expect(screen.getByText("性能测量")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "50 槽位" }));
    fireEvent.click(screen.getByRole("button", { name: "清空采样" }));

    expect(onPreviewGroupChange).toHaveBeenCalledWith(null);
    expect(resetPerfMetricsMock).toHaveBeenCalledTimes(2);
    expect(setParams).toHaveBeenCalledWith(buildSteppedPerfFixture(50));
    expect(toastMock).toHaveBeenNthCalledWith(
      1,
      "success",
      "已载入 50 槽位性能样本，采样已清零",
    );
    expect(toastMock).toHaveBeenNthCalledWith(
      2,
      "success",
      "性能采样已清零",
    );
  });

  it("renders optimization proposals and routes generate, apply, and clear actions", () => {
    const onGenerateOptimizationProposals = vi.fn();
    const onApplyOptimizationProposal = vi.fn();
    const onClearOptimizationProposals = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams({
          slots: [
            {
              id: "slot-1",
              x: 90,
              y: 100,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
              groupId: "group-1",
            },
            {
              id: "slot-2",
              x: 140,
              y: 100,
              shape: "circle",
              width: 40,
              height: 40,
              rotation: 0,
              groupId: "group-2",
            },
          ],
        })}
        effectiveDimensions={{ width: 120, depth: 100 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={createOptimizationProposals()}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={onGenerateOptimizationProposals}
        onApplyOptimizationProposal={onApplyOptimizationProposal}
        onClearOptimizationProposals={onClearOptimizationProposals}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "全局优化" }));
    fireEvent.click(screen.getByRole("button", { name: "应用此方案" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭建议" }));

    expect(screen.getByText("优化建议")).toBeInTheDocument();
    expect(screen.getByText("紧凑对称")).toBeInTheDocument();
    expect(screen.getByText("较当前 -40.2%")).toBeInTheDocument();
    expect(onGenerateOptimizationProposals).toHaveBeenCalledTimes(1);
    expect(onApplyOptimizationProposal).toHaveBeenCalledWith("compact");
    expect(onClearOptimizationProposals).toHaveBeenCalledTimes(1);
  });

  it("disables optimization when there are too few slots or generation is in progress", () => {
    const { rerender } = render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    expect(screen.getByRole("button", { name: "全局优化" })).toBeDisabled();

    rerender(
      <SteppedPanel
        params={createSteppedParams({
          slots: [
            {
              id: "slot-1",
              x: 90,
              y: 100,
              shape: "circle",
              width: 25,
              height: 25,
              rotation: 0,
              groupId: "group-1",
            },
            {
              id: "slot-2",
              x: 140,
              y: 100,
              shape: "circle",
              width: 40,
              height: 40,
              rotation: 0,
              groupId: "group-2",
            },
          ],
        })}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={null}
        optimizationProposals={[]}
        isOptimizingLayout={true}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={vi.fn()}
        onSaveDraft={vi.fn()}
        currentDraftId={null}
      />,
    );

    expect(screen.getByRole("button", { name: "优化中..." })).toBeDisabled();
  });

  it("renders bridge warnings and routes draft actions", () => {
    const onOpenDraftDialog = vi.fn();
    const onSaveDraft = vi.fn();

    render(
      <SteppedPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onGenerate={vi.fn()}
        onExportSTL={vi.fn()}
        isGenerating={false}
        volume={0}
        selectedSlotIds={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onUpdateGroupHeight={vi.fn()}
        onUpdateGroupSmoothingOverride={vi.fn()}
        onUpdateGroupSmoothingRadius={vi.fn()}
        onUpdateGroupDisconnectOverride={vi.fn()}
        onUpdateGroupDisconnectDistance={vi.fn()}
        onSetActiveGroup={vi.fn()}
        onMoveSelectedSlotsToGroup={vi.fn()}
        onReorderGroups={vi.fn()}
        previewGroupId={null}
        onPreviewGroupChange={vi.fn()}
        bridgeWarning={{
          groupId: "group-1",
          groupName: "组 1",
          separatedClusterCount: 3,
          mergedClusterCount: 1,
          effectiveBridgeGap: 6,
        }}
        optimizationProposals={[]}
        isOptimizingLayout={false}
        onGenerateOptimizationProposals={vi.fn()}
        onApplyOptimizationProposal={vi.fn()}
        onClearOptimizationProposals={vi.fn()}
        onOpenDraftDialog={onOpenDraftDialog}
        onSaveDraft={onSaveDraft}
        currentDraftId="draft-1"
      />,
    );

    expect(
      screen.getByText("组 1 当前参数可能会将 3 个槽群连接为 1 个整体。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("可以尝试增大“槽群断连距离”、减小“平滑半径”，或调整槽位位置。"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "更新草稿" }));
    fireEvent.click(screen.getByRole("button", { name: "草稿列表" }));

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onOpenDraftDialog).toHaveBeenCalledTimes(1);
  });
});
