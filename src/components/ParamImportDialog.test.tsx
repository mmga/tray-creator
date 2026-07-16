import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParamImportDialog } from "@/components/ParamImportDialog";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import type { ImportCandidate } from "@/lib/historical-param-artifact-reader";

function createCandidate(): ImportCandidate {
  return {
    fileName: "legacy-grid.json",
    targetMode: "grid",
    params: DEFAULT_TRAY_PARAMS,
    report: {
      modeResolution: {
        kind: "declared",
        targetMode: "grid",
        message: "文件声明为「网格」",
      },
      adjustments: [
        {
          category: "default",
          path: "boundarySpacing",
          label: "边界间距",
          previousValue: undefined,
          normalizedValue: 5,
          reason: "旧文件未记录边界间距",
        },
        {
          category: "value-adjustment",
          path: "rows",
          label: "行数",
          previousValue: 99,
          normalizedValue: 30,
          reason: "当前允许范围为 1–30",
        },
        {
          category: "migration",
          path: "slots[]",
          label: "Slot Geometry Snapshot",
          previousValue: "旧几何",
          normalizedValue: "已规范化 2 个 Slot Instance",
          reason: "保证导入后的模型几何可复现",
          technical: true,
        },
      ],
      retiredFields: [
        {
          path: "groups[0].splitPartGroupId",
          label: "旧分件目标",
          previousValue: "group-2",
          reason: "该字段已过时且没有当前对应字段",
        },
      ],
    },
  };
}

describe("ParamImportDialog", () => {
  it("展示只读规范化报告、覆盖风险并确认导入", () => {
    const onConfirm = vi.fn();
    render(
      <ParamImportDialog
        currentMode="custom"
        modeSelection={null}
        candidate={createCandidate()}
        targetRisk={{ currentDraftId: "draft-1", hasUnsavedChanges: true }}
        onSelectMode={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("只读安全检查")).toBeInTheDocument();
    expect(screen.getByText("使用默认值")).toBeInTheDocument();
    expect(screen.getByText("数值调整")).toBeInTheDocument();
    expect(screen.getByText("已过时并忽略")).toBeInTheDocument();
    expect(screen.getByText("目标工作区将被替换")).toBeInTheDocument();
    expect(screen.getByText(/当前 Draft Binding 将被清除/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认并切换到网格" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("对历史阶梯文件先要求选择原始 Mode", () => {
    const onSelectMode = vi.fn();
    render(
      <ParamImportDialog
        currentMode="grid"
        modeSelection={{
          status: "mode-selection-required",
          fileName: "legacy-stepped.json",
          choices: ["stepped", "stepped-cad"],
          message: "历史阶梯文件没有区分普通阶梯与 CAD 阶梯，请选择原始 Mode",
        }}
        candidate={null}
        targetRisk={null}
        onSelectMode={onSelectMode}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /CAD 阶梯/ }));
    expect(onSelectMode).toHaveBeenCalledWith("stepped-cad");
    expect(screen.queryByRole("button", { name: /确认导入/ })).not.toBeInTheDocument();
  });

  it("无兼容调整时仍展示确认结论", () => {
    const candidate = createCandidate();
    candidate.report.adjustments = [];
    candidate.report.retiredFields = [];
    render(
      <ParamImportDialog
        currentMode="grid"
        modeSelection={null}
        candidate={candidate}
        targetRisk={{ currentDraftId: null, hasUnsavedChanges: false }}
        onSelectMode={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("未应用兼容调整")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认导入" })).toBeEnabled();
  });
});
