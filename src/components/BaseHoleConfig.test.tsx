import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BaseHoleConfig } from "@/components/BaseHoleConfig";
import type { TrayParams } from "@/types/tray";

describe("BaseHoleConfig", () => {
  it("统一提供三种结构并展示适配违规", () => {
    const updateParam = vi.fn();
    render(
      <BaseHoleConfig<TrayParams>
        baseHoleStructure="magnet-post-hole"
        magnetPostHoleDiameter={15}
        magnetPostHoleDepth={2}
        resolvedBaseHoleSizes={["25", "40"]}
        supportingThickness={3}
        fitViolations={[{
          kind: "magnet-post-hole-fit",
          slotIds: ["slot-1"],
          message: "磁铁桩孔直径超过槽位最短成品尺寸",
        }]}
        updateParam={updateParam}
      />,
    );

    expect(screen.getByRole("button", { name: "无" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "磁吸孔" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "磁铁桩孔" })).toBeInTheDocument();
    expect(screen.getByText("当前设置无法生成或导出模型")).toBeInTheDocument();
    expect(screen.getByText("slot-1")).toBeInTheDocument();
    expect(screen.getByText(/磁铁桩孔直径超过槽位最短成品尺寸/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "磁吸孔" }));
    expect(updateParam).toHaveBeenCalledWith(
      "baseHoleStructure",
      "magnetic-base-hole",
    );
  });

  it("展示当前选中槽位匹配的磁吸孔规格", () => {
    render(
      <BaseHoleConfig<TrayParams>
        baseHoleStructure="magnetic-base-hole"
        magnetPostHoleDiameter={5}
        magnetPostHoleDepth={2}
        resolvedBaseHoleSizes={["25", "40"]}
        selectedSlotMatch={{ label: "槽位 2", presetKey: "40" }}
        supportingThickness={6}
        updateParam={vi.fn()}
      />,
    );

    expect(screen.getByText("当前选中槽位")).toBeInTheDocument();
    expect(screen.getByText("槽位 2")).toBeInTheDocument();
    expect(screen.getAllByText(/40/).length).toBeGreaterThan(0);
  });

  it("允许切换 25mm 小底盘的铁片规格", () => {
    const updateParam = vi.fn();
    render(
      <BaseHoleConfig<TrayParams>
        baseHoleStructure="magnetic-base-hole"
        magnetPostHoleDiameter={5}
        magnetPostHoleDepth={2}
        smallBaseHoleSize="20"
        resolvedBaseHoleSizes={["20"]}
        supportingThickness={3}
        updateParam={updateParam}
      />,
    );

    expect(screen.getByLabelText("25mm 小尺寸铁片")).toHaveValue("20");
    expect(screen.getByRole("option", { name: "标准25铁片" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("25mm 小尺寸铁片"), {
      target: { value: "25" },
    });
    expect(updateParam).toHaveBeenCalledWith("smallBaseHoleSize", "25");
  });
});
