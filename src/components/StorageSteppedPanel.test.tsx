import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StorageSteppedPanel } from "@/components/StorageSteppedPanel";
import type { UseStorageSteppedReturn } from "@/hooks/useStorageStepped";
import {
  createDefaultStorageSteppedParams,
  withStorageSteppedHeightSpec,
} from "@/lib/storage-stepped-config";
import {
  deriveStorageSteppedPlan,
  validateStorageSteppedParams,
} from "@/lib/storage-stepped-plan";
import type { StorageSteppedParams } from "@/types/storage-stepped";

function createModel(params: StorageSteppedParams = createDefaultStorageSteppedParams()) {
  const plan = deriveStorageSteppedPlan(params);
  const validation = validateStorageSteppedParams(params);
  const model = {
    params,
    persistedParams: params,
    currentTray: params.trays[0],
    plan,
    validation,
    blockingReason: null,
    transactionRevision: 0,
    currentStepIndex: 0,
    parts: [],
    missingPartLabels: [],
    volume: 0,
    workerErrors: {},
    isGenerating: false,
    isExporting: false,
    isPreviewStale: false,
    canUndo: false,
    liftedStepIndex: null,
    viewMode: "assembly",
    selectedPartId: "body",
    setHeightSpec: vi.fn(),
    setCurrentStepIndex: vi.fn(),
    applyPreset: vi.fn(),
    addSlot: vi.fn(),
    removeSlots: vi.fn(),
    copyTrayToStep: vi.fn(),
    copyTrayFromStep: vi.fn(),
    updateInterface: vi.fn(),
    updateSlotSpacing: vi.fn(),
    updateSlotBoundarySpacing: vi.fn(),
    setHoleDepth: vi.fn(),
    updateBaseHole: vi.fn(),
    handleGenerate: vi.fn(async () => {}),
    getPartBlockingReason: vi.fn(() => null),
    prepareLayoutImport: vi.fn(),
    applyLayoutImport: vi.fn(),
  } as unknown as UseStorageSteppedReturn;
  return model;
}

function renderPanel(model: UseStorageSteppedReturn) {
  return render(
    <StorageSteppedPanel
      model={model}
      selectedSlotIds={[]}
      actions={<div data-testid="actions" />}
    />,
  );
}

describe("StorageSteppedPanel", () => {
  it("显示主体、托盘、仓净高与理论容积摘要", () => {
    renderPanel(createModel());
    expect(screen.getAllByText(/阶梯收纳展示台/).length).toBeGreaterThan(0);
    expect(screen.getByText("240×240×110")).toBeInTheDocument();
    expect(screen.getByText("235.4×75.4×6")).toBeInTheDocument();
    expect(screen.getAllByText("21.6 / 61.6 / 101.6").length).toBeGreaterThan(0);
    expect(screen.getByText("3.087 L")).toBeInTheDocument();
    expect(screen.getByTestId("actions")).toBeInTheDocument();
    expect(screen.getByText("校验通过")).toBeInTheDocument();
  });

  it("切换高度规格与当前阶", () => {
    const model = createModel();
    renderPanel(model);
    fireEvent.click(screen.getByRole("button", { name: /收纳高度 40\/80\/120/ }));
    expect(model.setHeightSpec).toHaveBeenCalledWith("storage");

    fireEvent.click(screen.getByRole("button", { name: /^第 3 阶/ }));
    expect(model.setCurrentStepIndex).toHaveBeenCalledWith(2);
  });

  it("添加槽位使用所选槽位定义的成品规格", () => {
    const model = createModel();
    renderPanel(model);
    fireEvent.click(screen.getByRole("button", { name: /^添加$/ }));
    expect(model.addSlot).toHaveBeenCalledWith(32);
  });

  it("非法托盘显示参数位置与错误说明，并把摘要标为错误", () => {
    const base = createDefaultStorageSteppedParams();
    const params: StorageSteppedParams = {
      ...base,
      trays: base.trays.map((tray) =>
        tray.stepIndex === 0
          ? { ...tray, holeDepth: 6.2 }
          : tray,
      ),
    };
    renderPanel(createModel(params));
    expect(screen.getByText(/1 项错误/)).toBeInTheDocument();
    expect(
      screen.getByText(/槽深 6.2mm 不小于托盘总厚度 6mm/),
    ).toBeInTheDocument();
  });

  it("接口偏离默认值时提示不能与默认接口无条件互换", () => {
    const base = createDefaultStorageSteppedParams();
    const params: StorageSteppedParams = {
      ...withStorageSteppedHeightSpec(base, "standard"),
      interface: { ...base.interface, bodyWidth: 260 },
    };
    renderPanel(createModel(params));
    expect(
      screen.getByText(/接口参数已偏离打样默认值/),
    ).toBeInTheDocument();
  });
});
