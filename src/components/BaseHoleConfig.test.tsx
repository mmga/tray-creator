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
});
