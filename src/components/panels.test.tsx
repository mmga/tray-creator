import * as React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_PRESETS } from "@/lib/config";
import {
  CUSTOM_LAYOUT_DEFAULTS,
  ELLIPSE_PRESETS,
} from "@/lib/custom-config";
import {
  createOldWorldGridSlotSnapshot,
  DEFAULT_TRAY_PARAMS,
  PARAM_CONFIG,
} from "@/lib/grid-config";
import { calculateCustomEffectiveDimensions } from "@/lib/custom-layout-math";
import { customContouredStateForTest } from "@/test/contoured-state";
import { buildSteppedPerfFixture } from "@/lib/stepped-perf-fixtures";
import { STEPPED_LAYOUT_DEFAULTS, STEPPED_LIMITS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import type { SteppedOptimizationProposal } from "@/lib/stepped-global-optimize";

function expandResultSummary() {
  fireEvent.click(
    within(screen.getByTestId("panel-summary")).getByRole("button"),
  );
}

const {
  toastMock,
  resetPerfMetricsMock,
  isPerfEnabledMock,
} = vi.hoisted(() => ({
  toastMock: vi.fn(),
  resetPerfMetricsMock: vi.fn(),
  isPerfEnabledMock: vi.fn(() => false),
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
  BaseHoleConfig({
    magnetPostHoleDiameter,
    magnetPostHoleDepth,
    updateParam,
  }: {
    magnetPostHoleDiameter: number;
    magnetPostHoleDepth: number;
    updateParam: (key: string, value: unknown) => void;
  }) {
    return (
      <div data-testid="base-hole-config">
        <button onClick={() => updateParam("baseHoleStructure", "none")}>无</button>
        <button onClick={() => updateParam("baseHoleStructure", "magnetic-base-hole")}>磁吸孔</button>
        <button onClick={() => updateParam("baseHoleStructure", "magnet-post-hole")}>磁铁桩孔</button>
        <button onClick={() => updateParam("magnetPostHoleDiameter", magnetPostHoleDiameter + 0.1)}>
          设置{STEPPED_LIMITS.magnetPostHoleDiameter.label}:{magnetPostHoleDiameter}
        </button>
        <button onClick={() => updateParam("magnetPostHoleDepth", magnetPostHoleDepth + 0.1)}>
          设置{STEPPED_LIMITS.magnetPostHoleDepth.label}:{magnetPostHoleDepth}
        </button>
      </div>
    );
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
    SelectGroup({ children }: { children: React.ReactNode }) {
      return <div>{children}</div>;
    },
    SelectLabel({ children }: { children: React.ReactNode }) {
      return <div>{children}</div>;
    },
    SelectSeparator() {
      return <hr />;
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
    config: { step: number; max: number };
  }) {
    const nextValue = Number((value + config.step).toFixed(2));

    return (
      <div>
        <span>{label}</span>
        <button type="button" data-max={config.max} onClick={() => onChange(nextValue)}>
          {`设置${label}:${value}`}
        </button>
      </div>
    );
  },
}));

import CustomPanelImplementation from "@/components/CustomPanel";
import ParameterPanelImplementation from "@/components/ParameterPanel";
import { SteppedLayoutPanel as SteppedLayoutPanelImplementation } from "@/components/SteppedPanel";

const panelActionsStub = <div data-testid="panel-actions-stub" />;

function ParameterPanel(
  props: Omit<
    React.ComponentProps<typeof ParameterPanelImplementation>,
    "actions" | "isPreviewStale" | "replaceParams"
  > & {
    actions?: React.ReactNode;
    isPreviewStale?: boolean;
    replaceParams?: React.ComponentProps<typeof ParameterPanelImplementation>["replaceParams"];
  },
) {
  const {
    actions = panelActionsStub,
    isPreviewStale = false,
    replaceParams = vi.fn(),
    ...rest
  } = props;
  return (
    <ParameterPanelImplementation
      {...rest}
      actions={actions}
      isPreviewStale={isPreviewStale}
      replaceParams={replaceParams}
    />
  );
}

function CustomPanel(
  props: Omit<
    React.ComponentProps<typeof CustomPanelImplementation>,
    "actions" | "isPreviewStale"
  > & { actions?: React.ReactNode; isPreviewStale?: boolean },
) {
  const { actions = panelActionsStub, isPreviewStale = false, ...rest } = props;
  return <CustomPanelImplementation {...rest} actions={actions} isPreviewStale={isPreviewStale} />;
}

function SteppedLayoutPanel(
  props: Omit<
    React.ComponentProps<typeof SteppedLayoutPanelImplementation>,
    "actions" | "onUpdateGroupSplitPartTarget"
  > & {
    actions?: React.ReactNode;
    onUpdateGroupSplitPartTarget?: React.ComponentProps<
      typeof SteppedLayoutPanelImplementation
    >["onUpdateGroupSplitPartTarget"];
  },
) {
  const {
    actions = panelActionsStub,
    onUpdateGroupSplitPartTarget = vi.fn(),
    ...rest
  } = props;
  const requestedActiveGroupId = rest.activeGroupId;
  const activeGroupId = rest.params.groups.some(
    (group) => group.id === requestedActiveGroupId,
  )
    ? requestedActiveGroupId
    : rest.params.groups[0]?.id ?? null;
  return (
    <SteppedLayoutPanelImplementation
      {...rest}
      activeGroupId={activeGroupId}
      actions={actions}
      onUpdateGroupSplitPartTarget={onUpdateGroupSplitPartTarget}
    />
  );
}

const HUNDRED_MM_PRESET = BASE_PRESETS.find(
  (preset) => preset.diameter === 100,
)!;
function createSteppedParams(overrides?: Partial<SteppedLayoutParams>) {
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
        color: "#c8a84e",
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
    ...overrides,
  };
}

function createOptimizationProposals(): SteppedOptimizationProposal[] {
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
  it("wires preset changes and boundary spacing controls", () => {
    const updateParam = vi.fn();
    const replaceParams = vi.fn();

    render(
      <ParameterPanel
        params={{ ...DEFAULT_TRAY_PARAMS, boundarySpacingIndependent: true }}
        updateParam={updateParam}
        replaceParams={replaceParams}
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

    expect(replaceParams).toHaveBeenCalledWith(
      expect.objectContaining({
        holeDiameter: HUNDRED_MM_PRESET.diameter,
        slotDefinitionId: "circle-100",
        slotShape: "circle",
      }),
    );
    expect(updateParam).toHaveBeenNthCalledWith(
      1,
      "boundarySpacingIndependent",
      false,
    );
    expect(updateParam).toHaveBeenNthCalledWith(
      2,
      "boundarySpacing",
      DEFAULT_TRAY_PARAMS.boundarySpacing + PARAM_CONFIG.boundarySpacing.step,
    );
  });

  it("renders the action area injected by the workspace", () => {
    render(
      <ParameterPanel
        params={DEFAULT_TRAY_PARAMS}
        updateParam={vi.fn()}
        actions={<button type="button">工作区操作</button>}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByRole("button", { name: "工作区操作" })).toBeInTheDocument();
  });

  it("surfaces oversized grid state", () => {
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
        isGenerating={false}
        volume={1000}
      />,
    );

    expect(screen.getByText("超出常规尺寸")).toBeInTheDocument();
    expandResultSummary();
    expect(screen.getByText(/超过常规打印尺寸 260 × 260 mm/)).toBeInTheDocument();
    expect(screen.getByText("0.7 g")).toBeInTheDocument();

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
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByText("选择底座规格")).toBeInTheDocument();
    expect(screen.getByText("可锻造")).toBeInTheDocument();

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

  it("selects Old World rectangular presets and hides the circular half-slot mode", () => {
    const replaceParams = vi.fn();

    render(
      <ParameterPanel
        params={{ ...DEFAULT_TRAY_PARAMS, rows: 1, halfCircleSlots: true }}
        updateParam={vi.fn()}
        replaceParams={replaceParams}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByText("圆形底盘")).toBeInTheDocument();
    expect(screen.getByText("旧世界方形/矩形底盘")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "30×60mm" }));

    expect(replaceParams).toHaveBeenCalledWith(
      expect.objectContaining({
        slotShape: "rectangle",
        slotDefinitionId: "old-world-30x60",
        slotBaseWidth: 30,
        slotBaseHeight: 60,
        slotWidth: 30.4,
        slotHeight: 60.4,
        halfCircleSlots: false,
        baseHoleSize: "25",
      }),
    );
  });

  it("shows only full-slot and base-plate structures for Old World rectangles", () => {
    render(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          ...createOldWorldGridSlotSnapshot({
            id: "old-world-30x60",
            name: "旧世界 30×60mm",
            width: 30,
            height: 60,
          }),
          rows: 1,
          halfCircleSlots: false,
        }}
        updateParam={vi.fn()}
        replaceParams={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByRole("button", { name: "完整矩形槽" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "半圆槽" })).toBeNull();
    expect(screen.getByText("底盘间距")).toBeInTheDocument();
  });

  it("shows the overall tolerance control only for zero-spacing rectangular slots", () => {
    const updateParam = vi.fn();
    const rectangularParams = {
      ...DEFAULT_TRAY_PARAMS,
      ...createOldWorldGridSlotSnapshot({
        id: "old-world-25x25",
        name: "旧世界 25×25mm",
        width: 25,
        height: 25,
      }),
      spacing: 0,
      spacingX: 0,
      spacingY: 0,
    };
    const { rerender } = render(
      <ParameterPanel
        params={rectangularParams}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "设置零间距整体容差:1" }),
    );
    expect(updateParam).toHaveBeenCalledWith("zeroSpacingTolerance", 1.1);
    expect(screen.getByText(/不会按行列数累计/)).toBeInTheDocument();

    rerender(
      <ParameterPanel
        params={{ ...rectangularParams, spacing: 1, spacingX: 1, spacingY: 1 }}
        updateParam={updateParam}
        replaceParams={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );
    expect(screen.queryByText("零间距整体容差")).not.toBeInTheDocument();
  });

  it("disables half-circle structure when the stackable box is enabled", () => {
    render(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          rows: 1,
          halfCircleSlots: false,
          stackableBox: {
            ...DEFAULT_TRAY_PARAMS.stackableBox!,
            enabled: true,
          },
        }}
        updateParam={vi.fn()}
        replaceParams={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByRole("button", { name: "半圆槽" })).toBeDisabled();
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
        isGenerating={true}
        volume={0}
      />,
    );

    expect(screen.getByText("正在锻造")).toBeInTheDocument();

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
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置${PARAM_CONFIG.sideBevelWidth.label}:${DEFAULT_TRAY_PARAMS.sideBevelWidth}`,
      }),
    );

    expect(updateParam).toHaveBeenNthCalledWith(1, "baseThickness", 3.2);
    expect(updateParam).toHaveBeenNthCalledWith(2, "holeDepth", 3.2);
    expect(updateParam).toHaveBeenNthCalledWith(3, "cornerRadius", 5);
    expect(updateParam).toHaveBeenNthCalledWith(4, "sideBevelWidth", 0.5);

    rerender(
      <ParameterPanel
        params={{
          ...DEFAULT_TRAY_PARAMS,
          enableBaseHole: true,
        }}
        updateParam={updateParam}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByText("可锻造")).toBeInTheDocument();
  });

  it("updates columns, rows, and unified spacing", () => {
    const updateParam = vi.fn();

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
        isGenerating={false}
        volume={0}
      />,
    );

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

    expect(updateParam).toHaveBeenNthCalledWith(1, "columns", 3);
    expect(updateParam).toHaveBeenNthCalledWith(2, "rows", 6);
    expect(updateParam).toHaveBeenNthCalledWith(3, "spacing", 6);
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
    toastMock.mockReset();
  });

  it("adds circular slots from the custom input and preset buttons, then adds ellipse slots", () => {
    const onAddSlot = vi.fn();

    render(
      <CustomPanel
        params={CUSTOM_LAYOUT_DEFAULTS}
        effectiveDimensions={{ width: 120, depth: 140 }}
        updateParam={vi.fn()}
        onAddSlot={onAddSlot}
        isGenerating={false}
        volume={0}
      />,
    );

    fireEvent.change(screen.getByLabelText("自定义直径"), {
      target: { value: "13.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));
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

    expect(onAddSlot).toHaveBeenNthCalledWith(
      1,
      13.5,
      undefined,
      undefined,
      { applyTolerance: false },
    );
    expect(onAddSlot).toHaveBeenNthCalledWith(2, HUNDRED_MM_PRESET.diameter);
    expect(onAddSlot).toHaveBeenNthCalledWith(
      3,
      ELLIPSE_PRESETS[0].width,
      ELLIPSE_PRESETS[0].height,
      {
        slotDefinitionId: ELLIPSE_PRESETS[0].id,
        outerOffset: ELLIPSE_PRESETS[0].outerOffset,
        profileExponent: ELLIPSE_PRESETS[0].profileExponent,
      },
    );
  });

  it("places the custom circle diameter row after presets in one line", () => {
    render(
      <CustomPanel
        params={CUSTOM_LAYOUT_DEFAULTS}
        effectiveDimensions={{ width: 120, depth: 140 }}
        updateParam={vi.fn()}
        onAddSlot={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    const input = screen.getByLabelText("自定义直径");
    const preset = screen.getByRole("button", {
      name: String(HUNDRED_MM_PRESET.diameter),
    });
    const customRow = input.parentElement;

    expect(
      preset.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(customRow).toHaveClass("flex", "items-center");
    expect(within(customRow!).getByRole("button", { name: "添加" })).toBeInTheDocument();
  });

  it("does not render a global ellipse fullness control", () => {
    render(
      <CustomPanel
        params={CUSTOM_LAYOUT_DEFAULTS}
        effectiveDimensions={{ width: 120, depth: 140 }}
        updateParam={vi.fn()}
        onAddSlot={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.queryByText("椭圆丰满度")).not.toBeInTheDocument();
  });

  it("switches between automatic and fixed tray sizing without moving slots", () => {
    const updateParam = vi.fn();
    const { rerender } = render(
      <CustomPanel
        params={CUSTOM_LAYOUT_DEFAULTS}
        effectiveDimensions={{ width: 120, depth: 140 }}
        updateParam={updateParam}
        onAddSlot={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(screen.getByRole("switch", { name: "custom-fixed-tray-size" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
    fireEvent.click(screen.getByRole("switch", { name: "custom-fixed-tray-size" }));
    expect(updateParam).toHaveBeenCalledWith("traySizingMode", "fixed");

    rerender(
      <CustomPanel
        params={{ ...CUSTOM_LAYOUT_DEFAULTS, traySizingMode: "fixed" }}
        effectiveDimensions={{ width: 120, depth: 140 }}
        updateParam={updateParam}
        onAddSlot={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: `设置长度:${CUSTOM_LAYOUT_DEFAULTS.trayWidth}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `设置宽度:${CUSTOM_LAYOUT_DEFAULTS.trayDepth}`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("外尺寸固定，凹槽可在内部自由排版")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "随机排列" })).not.toBeInTheDocument();
  });

  it("shows custom statistics from the calculated upper edge dimensions", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      boundarySpacing: 3,
      boundarySpacingIndependent: true,
      sideBevelWidth: 2,
      slots: [
        {
          id: "slot-1",
          x: 109.6,
          y: 112.8,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
        {
          id: "slot-2",
          x: 89,
          y: 112.6,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
        {
          id: "slot-3",
          x: 98.2,
          y: 103.1,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
        {
          id: "slot-4",
          x: 81,
          y: 102.2,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
      ],
    };
    const dimensions = calculateCustomEffectiveDimensions(params);

    render(
      <CustomPanel
        params={params}
        effectiveDimensions={dimensions}
        updateParam={vi.fn()}
        onAddSlot={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    expandResultSummary();
    expect(screen.getByText(`${dimensions.width.toFixed(1)} mm`)).toBeInTheDocument();
    expect(screen.getByText(`${dimensions.depth.toFixed(1)} mm`)).toBeInTheDocument();
    expect(screen.getByText("有效底板")).toBeInTheDocument();
    expect(screen.getByText("长度")).toBeInTheDocument();
    expect(screen.getByText("宽度")).toBeInTheDocument();
    expect(screen.queryByText("50.0 mm")).not.toBeInTheDocument();
  });

  it("routes custom layout parameter controls", () => {
    const updateParam = vi.fn();

    render(
      <CustomPanel
        params={{ ...CUSTOM_LAYOUT_DEFAULTS, boundarySpacingIndependent: true }}
        effectiveDimensions={{ width: 120, depth: 140 }}
        updateParam={updateParam}
        onAddSlot={vi.fn()}
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
    fireEvent.click(
      screen.getByRole("button", {
        name: `设置侧面斜面宽度:${CUSTOM_LAYOUT_DEFAULTS.sideBevelWidth}`,
      }),
    );

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
    expect(updateParam).toHaveBeenNthCalledWith(3, "sideBevelWidth", 0.5);
  });

  it("直边面板显示真实边数，圆角变化不计入边数，空布局不伪报边数", () => {
    const params = { ...CUSTOM_LAYOUT_DEFAULTS, footprintStyle: "polygonal" as const,
      slots: [[0,0],[60,0],[30,50]].map(([x,y], i) => ({
        id: String(i), x, y, width: 25, height: 25, shape: "circle" as const, rotation: 0,
      })) };
    const common = { effectiveDimensions: { width: 120, depth: 140 }, updateParam: vi.fn(),
      onAddSlot: vi.fn(), isGenerating: false, volume: 0 };
    const { rerender } = render(<CustomPanel {...common} params={params}
      contouredFootprintState={customContouredStateForTest(params)} />);
    expect(screen.getByText("当前外形：3 边形（忽略圆角）")).toBeInTheDocument();
    const sharp = { ...params, cornerRadius: 0 };
    rerender(<CustomPanel {...common} params={sharp} contouredFootprintState={customContouredStateForTest(sharp)} />);
    expect(screen.getByText("当前外形：3 边形（忽略圆角）")).toBeInTheDocument();
    const empty = { ...params, slots: [] };
    rerender(<CustomPanel {...common} params={empty} contouredFootprintState={customContouredStateForTest(empty)} />);
    expect(screen.getByText("当前外形：暂无轮廓（忽略圆角）")).toBeInTheDocument();
  });

  it("三种轮廓可选择，直边模式隐藏休眠参数并保留切回入口", () => {
    const updateParam = vi.fn();
    const common = {
      effectiveDimensions: { width: 120, depth: 140 },
      updateParam,
      onAddSlot: vi.fn(),
      isGenerating: false,
      volume: 0,
    };
    const params = { ...CUSTOM_LAYOUT_DEFAULTS, traySizingMode: "fixed" as const };
    const { rerender } = render(<CustomPanel {...common} params={params} />);
    fireEvent.click(screen.getByRole("button", { name: "直边包络" }));
    expect(updateParam).toHaveBeenLastCalledWith("footprintStyle", "polygonal");

    rerender(<CustomPanel {...common} params={{ ...params, footprintStyle: "polygonal" }} />);
    expect(screen.getByText("自动直边外包，凹口填平，生成一整块；顶点可设圆弧过渡")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "custom-fixed-tray-size" })).not.toBeInTheDocument();
    for (const label of ["长度", "宽度", "侧面斜面宽度", "平滑半径", "槽群断连距离"]) {
      expect(screen.queryByRole("button", { name: new RegExp(`^设置${label}:`) })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /^设置底板厚度:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^设置圆角半径:/ })).toHaveAttribute("data-max", "30");
    expect(screen.getByText("圆角半径为 0 时保留尖角；超过边界间距时底板向外扩展，以保证凹槽边距。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `设置圆角半径:${params.cornerRadius}` }));
    expect(updateParam).toHaveBeenLastCalledWith("cornerRadius", params.cornerRadius + 1);
    fireEvent.click(screen.getByRole("button", { name: "弧形贴合" }));
    expect(updateParam).toHaveBeenLastCalledWith("footprintStyle", "contoured");
    fireEvent.click(screen.getByRole("button", { name: "矩形包络" }));
    expect(updateParam).toHaveBeenLastCalledWith("footprintStyle", "rectangular");

    rerender(<CustomPanel {...common} params={params} />);
    expect(screen.getByRole("button", { name: /^设置圆角半径:/ })).toHaveAttribute("data-max", "10");
    expect(screen.getByRole("button", { name: `设置长度:${params.trayWidth}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `设置侧面斜面宽度:${params.sideBevelWidth}` })).toBeInTheDocument();
  });

  it("直边下切换手调圆角与凹槽相切，保留手调半径，单圆不误报空轮廓", () => {
    const updateParam = vi.fn();
    const params = { ...CUSTOM_LAYOUT_DEFAULTS, footprintStyle: "polygonal" as const, cornerRadius: 20,
      slots: [{ id: "circle", x: 0, y: 0, width: 25, height: 25, shape: "circle" as const, rotation: 0 }] };
    const common = { effectiveDimensions: { width: 35, depth: 35 }, updateParam, onAddSlot: vi.fn(), isGenerating: false, volume: 0 };
    const { rerender } = render(<CustomPanel {...common} params={params} />);
    fireEvent.click(screen.getByRole("button", { name: "凹槽相切" }));
    expect(updateParam).toHaveBeenLastCalledWith("polygonCornerStyle", "tangent");
    const tangent = { ...params, polygonCornerStyle: "tangent" as const };
    rerender(<CustomPanel {...common} params={tangent} contouredFootprintState={customContouredStateForTest(tangent)} />);
    expect(screen.queryByRole("button", { name: /^设置圆角半径:/ })).not.toBeInTheDocument();
    expect(screen.getByText(/当前外形：圆弧外形（无直边）/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "手调圆角" }));
    expect(updateParam).toHaveBeenLastCalledWith("polygonCornerStyle", "manual");
    rerender(<CustomPanel {...common} params={{ ...tangent, polygonCornerStyle: "manual" }} />);
    expect(screen.getByRole("button", { name: "设置圆角半径:20" })).toBeInTheDocument();
  });

  it("从盒体切到直边包络时提示自动关闭盒体", () => {
    const updateParam = vi.fn();
    render(<CustomPanel
      params={{ ...CUSTOM_LAYOUT_DEFAULTS, stackableBox: { ...CUSTOM_LAYOUT_DEFAULTS.stackableBox!, enabled: true } }}
      effectiveDimensions={{ width: 120, depth: 140 }}
      updateParam={updateParam}
      onAddSlot={vi.fn()}
      isGenerating={false}
      volume={0}
    />);
    fireEvent.click(screen.getByRole("button", { name: "直边包络" }));
    expect(updateParam).toHaveBeenCalledWith("footprintStyle", "polygonal");
    expect(toastMock).toHaveBeenCalledWith("info", "直边包络不支持堆叠盒体，已自动关闭盒体结构");
  });

  it("贴合轮廓显示并路由平滑与断连参数", () => {
    const updateParam = vi.fn();
    render(
      <CustomPanel
        params={{
          ...CUSTOM_LAYOUT_DEFAULTS,
          footprintStyle: "contoured",
          smoothingRadius: 60,
          disconnectDistance: 0,
        }}
        effectiveDimensions={{ width: 120, depth: 140 }}
        updateParam={updateParam}
        onAddSlot={vi.fn()}
        isGenerating={false}
        volume={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "设置平滑半径:60" }));
    fireEvent.click(screen.getByRole("button", { name: "设置槽群断连距离:0" }));

    expect(updateParam).toHaveBeenNthCalledWith(1, "smoothingRadius", 61);
    expect(updateParam).toHaveBeenNthCalledWith(2, "disconnectDistance", 1);
    expect(screen.queryByText("侧面斜面宽度")).not.toBeInTheDocument();
  });
});


describe("SteppedLayoutPanel", { timeout: 15000 }, () => {
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
      <SteppedLayoutPanel
        params={createSteppedParams({
          groups: [
            {
              id: "group-1",
              name: "组 1",
              color: "#c8a84e",
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
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "选择分组：组 2" }));
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
      <SteppedLayoutPanel
        params={createSteppedParams({
          groups: [
            {
              id: "group-1",
              name: "组 1",
              color: "#c8a84e",
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
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "设置圆柱高度:10" }),
    );
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
      <SteppedLayoutPanel
        params={createSteppedParams({ enableSplitAssembly: true })}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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

  it("routes stepped group and slot controls", () => {
    const onAddGroup = vi.fn();
    const onMoveSelectedSlotsToGroup = vi.fn();

    render(
      <SteppedLayoutPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={true}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "组 2" }));
    fireEvent.click(screen.getByRole("button", { name: "新建组" }));

    expect(onMoveSelectedSlotsToGroup).toHaveBeenCalledWith(
      ["slot-1", "slot-2"],
      "group-2",
    );
    expect(onAddGroup).toHaveBeenCalledTimes(1);
  });

  it("adds slots from presets and updates stepped structure controls", () => {
    const updateParam = vi.fn();
    const onAddSlot = vi.fn();

    render(
      <SteppedLayoutPanel
        params={createSteppedParams({
          spacing: 5,
          holeDepth: 3,
          splitGrooveDepth: 2,
          enableSplitAssembly: true,
          smoothingRadius: 14,
          disconnectDistance: 2,
        })}
        activeGroupId="group-2"
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={updateParam}
        setParams={vi.fn()}
        onAddSlot={onAddSlot}
        onUpdateGroupSplitPartTarget={vi.fn()}
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
    const ellipsePreset = ELLIPSE_PRESETS[0];
    fireEvent.click(
      screen.getByRole("button", { name: ellipsePreset.name }),
    );
    expect(onAddSlot).toHaveBeenLastCalledWith(
      ellipsePreset.width,
      ellipsePreset.height,
      {
        slotDefinitionId: ellipsePreset.id,
        outerOffset: ellipsePreset.outerOffset,
        profileExponent: ellipsePreset.profileExponent,
      },
    );
    expect(updateParam).toHaveBeenNthCalledWith(1, "spacing", 6);
    expect(updateParam).toHaveBeenNthCalledWith(2, "holeDepth", 3.2);
    expect(updateParam).toHaveBeenNthCalledWith(3, "splitGrooveDepth", 2.2);
    expect(updateParam).toHaveBeenNthCalledWith(4, "smoothingRadius", 15);
    expect(updateParam).toHaveBeenNthCalledWith(5, "disconnectDistance", 3);
  });

  it("默认关闭分件能力但始终提供椭圆凹槽", () => {
    render(
      <SteppedLayoutPanel
        params={createSteppedParams({
          splitGrooveDepth: 2,
        })}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      />,
    );

    expect(screen.getByRole("switch", { name: "启用分件与装配" })).not.toBeChecked();
    expect(
      screen.queryByRole("button", { name: "设置装配槽深度:2" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("轮廓凹槽")).not.toBeInTheDocument();
    expect(screen.queryByText("内缩凹槽")).not.toBeInTheDocument();
    expect(screen.queryByText("定位柱")).not.toBeInTheDocument();
    expect(screen.queryByText("拆件归并")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: ELLIPSE_PRESETS[0].name }),
    ).toBeInTheDocument();
  });

  it("启用后路由分件凹槽类型与定位柱控件", () => {
    const updateParam = vi.fn();

    render(
      <SteppedLayoutPanel
        params={createSteppedParams({
          enableSplitAssembly: true,
          enableSplitRecess: false,
          splitGrooveType: "profile",
          enableSplitLocators: false,
        })}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={updateParam}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
        onUpdateGroupSplitPartTarget={vi.fn()}
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
      <SteppedLayoutPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={updateParam}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "磁吸孔" }));
    fireEvent.click(screen.getByRole("button", { name: "无" }));

    expect(updateParam).toHaveBeenNthCalledWith(1, "baseHoleStructure", "magnetic-base-hole");
    expect(updateParam).toHaveBeenNthCalledWith(2, "baseHoleStructure", "none");
  });

  it("在普通阶梯和 CAD 阶梯中都提供磁铁桩孔控件", () => {
    const updateParam = vi.fn();
    const commonProps = {
      params: createSteppedParams({ baseHoleStructure: "magnet-post-hole" }),
      effectiveDimensions: { width: 120, depth: 140 },
      isPreviewStale: false,
      updateParam,
      setParams: vi.fn(),
      onAddSlot: vi.fn(),
      isGenerating: false,
      volume: 0,
      selectedSlotIds: [],
      onAddGroup: vi.fn(),
      onRemoveGroup: vi.fn(),
      onUpdateGroupHeight: vi.fn(),
      onUpdateGroupSmoothingOverride: vi.fn(),
      onUpdateGroupSmoothingRadius: vi.fn(),
      onUpdateGroupDisconnectOverride: vi.fn(),
      onUpdateGroupDisconnectDistance: vi.fn(),
      onSetActiveGroup: vi.fn(),
      onMoveSelectedSlotsToGroup: vi.fn(),
      onReorderGroups: vi.fn(),
      previewGroupId: null,
      onPreviewGroupChange: vi.fn(),
      bridgeWarning: null,
      optimizationProposals: [],
      isOptimizingLayout: false,
      onGenerateOptimizationProposals: vi.fn(),
      onApplyOptimizationProposal: vi.fn(),
      onClearOptimizationProposals: vi.fn(),
    };

    const { unmount } = render(
      <SteppedLayoutPanel
        {...commonProps}
        onUpdateGroupSplitPartTarget={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "磁铁桩孔" })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: `设置${STEPPED_LIMITS.magnetPostHoleDiameter.label}:5` }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: `设置${STEPPED_LIMITS.magnetPostHoleDepth.label}:2` }),
    );
    expect(updateParam).toHaveBeenNthCalledWith(1, "magnetPostHoleDiameter", 5.1);
    expect(updateParam).toHaveBeenNthCalledWith(2, "magnetPostHoleDepth", 2.1);
    unmount();

    render(<SteppedLayoutPanel {...commonProps} />);
    expect(screen.getByRole("button", { name: "磁铁桩孔" })).toBeInTheDocument();
  });

  it("toggles preview groups through pointer and keyboard interactions", () => {
    const onPreviewGroupChange = vi.fn();

    render(
      <SteppedLayoutPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      <SteppedLayoutPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      <SteppedLayoutPanel
        params={{
          ...nextParams,
          slots: [],
          groups: [nextParams.groups[0]!],
        }}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      />,
    );

    expect(onPreviewGroupChange).toHaveBeenNthCalledWith(3, null);
  });

  it("supports touch preview locking, lost pointer capture cleanup, and repeat-key guards", () => {
    const onPreviewGroupChange = vi.fn();

    render(
      <SteppedLayoutPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      <SteppedLayoutPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      <SteppedLayoutPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 0, depth: 0 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      <SteppedLayoutPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={setParams}
        onAddSlot={vi.fn()}
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
      <SteppedLayoutPanel
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
      <SteppedLayoutPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      />,
    );

    expect(screen.getByRole("button", { name: "全局优化" })).toBeDisabled();

    rerender(
      <SteppedLayoutPanel
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
      />,
    );

    expect(screen.getByRole("button", { name: "优化中..." })).toBeDisabled();
  });

  it("renders bridge warnings", () => {
    render(
      <SteppedLayoutPanel
        params={createSteppedParams()}
        effectiveDimensions={{ width: 120, depth: 140 }}
        isPreviewStale={false}
        updateParam={vi.fn()}
        setParams={vi.fn()}
        onAddSlot={vi.fn()}
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
      />,
    );

    expect(
      screen.getByText("组 1 当前参数可能会将 3 个槽群连接为 1 个整体。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("可以尝试增大“槽群断连距离”、减小“平滑半径”，或调整槽位位置。"),
    ).toBeInTheDocument();

  });
});
