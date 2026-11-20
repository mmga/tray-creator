import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { prepareGridTrayCutSource } from "@/lib/tray-model";
import { prepareCustomTrayCutSource } from "@/lib/custom-tray-model";
import { createFreeSlotInstance } from "@/lib/slot-instance-factory";
import { getStepCapability } from "./step-capability";

describe("STEP 导出能力与托盘构造语义", () => {
  it("区分支持、采样说明和阻断", () => {
    const grid = { mode: "grid" as const, params: DEFAULT_TRAY_PARAMS };
    expect(getStepCapability(grid, "whole")).toEqual({ available: true, sampled: false });
    expect(getStepCapability(grid, "parts")).toMatchObject({ available: false });
    expect(getStepCapability({ ...grid, params: { ...grid.params,
      stackableBox: { ...DEFAULT_TRAY_PARAMS.stackableBox!, enabled: true } } }, "whole"))
      .toMatchObject({ available: false, reason: expect.any(String) });
    const custom = { mode: "custom" as const, params: { ...CUSTOM_LAYOUT_DEFAULTS,
      slots: [createFreeSlotInstance({ id: "a", x: 0, y: 0, width: 50, height: 30 })] } };
    expect(getStepCapability(custom, "whole")).toEqual({ available: true, sampled: true });
    expect(getStepCapability({ ...custom, params: { ...custom.params, footprintStyle: "contoured" } }, "whole"))
      .toMatchObject({ available: false });
  });

  it("保留网格快照直径、实际切削高度和底孔阻断", () => {
    const params = { ...DEFAULT_TRAY_PARAMS, rows: 1, columns: 1, baseThickness: 1 };
    const source = prepareGridTrayCutSource({ ...params, slotDiameter: 40 });
    const [min, max] = measurements.measureBoundingBox(source.grooves[0]);
    expect(max[0] - min[0]).toBeCloseTo(40, 8);
    expect(min[2]).toBeCloseTo(0.99, 8);
    expect(prepareGridTrayCutSource({ ...params, slotDiameter: 10 }).baseHoles.blocked).toBe(true);
  });

  it("自定义自动尺寸以布局中心为原点且槽底不下移", () => {
    const params = { ...CUSTOM_LAYOUT_DEFAULTS, baseHoleStructure: "none" as const,
      slots: [createFreeSlotInstance({ id: "a", x: -35, y: 30, width: 25 })] };
    const [min, max] = measurements.measureBoundingBox(
      prepareCustomTrayCutSource(params, { status: "inactive" }).grooves[0],
    );
    expect(min[0] + max[0]).toBeCloseTo(0, 8);
    expect(min[1] + max[1]).toBeCloseTo(0, 8);
    expect(min[2]).toBeCloseTo(params.baseThickness, 8);
  });
});
