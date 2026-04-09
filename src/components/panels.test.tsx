import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_PRESETS } from "@/lib/config";
import { CUSTOM_LAYOUT_DEFAULTS, ELLIPSE_PRESETS } from "@/lib/custom-config";
import { PARAM_CONFIG, DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";

const { useAutoPreviewMock, toastMock, resetPerfMetricsMock } = vi.hoisted(
  () => ({
    useAutoPreviewMock: vi.fn(),
    toastMock: vi.fn(),
    resetPerfMetricsMock: vi.fn(),
  }),
);

vi.mock("@/hooks/useAutoPreview", () => ({
  useAutoPreview: useAutoPreviewMock,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/perf", () => ({
  isPerfEnabled: () => false,
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
    id,
    "aria-label": ariaLabel,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    id?: string;
    "aria-label"?: string;
  }) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? id ?? "switch"}
        onClick={() => onCheckedChange?.(!checked)}
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
  }: {
    autoPreview: boolean;
    onAutoPreviewChange: (checked: boolean) => void;
    onGenerate: () => void;
    onExportSTL: () => void;
    onReset: () => void;
    onImport: (params: unknown) => void;
    mode: string;
  }) {
    return (
      <div data-testid={`panel-actions-${mode}`}>
        <button
          type="button"
          onClick={() => onAutoPreviewChange(!autoPreview)}
        >
          启用自动预览
        </button>
        <button type="button" onClick={onGenerate}>
          开始锻造
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
import SteppedPanel from "@/components/SteppedPanel";

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
      screen.getByRole("button", { name: BASE_PRESETS[0].name }),
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
      BASE_PRESETS[0].diameter,
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
        name: String(BASE_PRESETS[0].diameter),
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: ELLIPSE_PRESETS[0].name.replace("mm", ""),
      }),
    );

    expect(onAddSlot).toHaveBeenNthCalledWith(1, BASE_PRESETS[0].diameter);
    expect(onAddSlot).toHaveBeenNthCalledWith(
      2,
      ELLIPSE_PRESETS[0].width,
      ELLIPSE_PRESETS[0].height,
    );
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

describe("SteppedPanel", { timeout: 15000 }, () => {
  beforeEach(() => {
    toastMock.mockReset();
    resetPerfMetricsMock.mockReset();
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
});
