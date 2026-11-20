import { beforeAll, describe, expect, it } from "vitest";
import { exportSTEP, importSTEP, measureVolume } from "replicad";
import { measurements } from "@jscad/modeling";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { createFreeSlotInstance } from "@/lib/slot-instance-factory";
import { createTrayModel } from "@/lib/tray-model";
import { createCustomTrayModel } from "@/lib/custom-tray-model";
import type { FlatTraySnapshot } from "@/lib/manual-split-plan";
import { loadStepKernel } from "./step-kernel";
import { prepareStepConstruction, realizeStepTray, requireStepSolid, validateStepSolid } from "./step-realization";

const grid = { ...DEFAULT_TRAY_PARAMS, rows: 2, columns: 2 };
const custom = { ...CUSTOM_LAYOUT_DEFAULTS, traySizingMode: "fixed" as const,
  trayWidth: 100, trayDepth: 80, baseHoleStructure: "none" as const };
const cases: [string, FlatTraySnapshot][] = [
  ["网格圆槽和封闭磁吸腔", { mode: "grid", params: grid }],
  ["圆角斜面", { mode: "grid", params: { ...grid, sideBevelWidth: 3 } }],
  ["斜面大于圆角", { mode: "grid", params: { ...grid, cornerRadius: 1, sideBevelWidth: 4 } }],
  ["直角斜面", { mode: "grid", params: { ...grid, cornerRadius: 0, sideBevelWidth: 3 } }],
  ["横排半圆槽", { mode: "grid", params: { ...grid, rows: 1, halfCircleSlots: true } }],
  ["竖排半圆槽与斜面", { mode: "grid", params: { ...grid, columns: 1, halfCircleSlots: true, sideBevelWidth: 2 } }],
  ["零间距去岛", { mode: "grid", params: { ...grid, rows: 3, columns: 3, spacing: 0, boundarySpacingIndependent: true } }],
  ["网格矩形槽", { mode: "grid", params: { ...grid, slotShape: "rectangle",
    slotBaseWidth: 25, slotBaseHeight: 50, slotWidth: 25.4, slotHeight: 50.4, baseHoleStructure: "none" } }],
  ["带磁铁桩孔的底板", { mode: "grid", params: { ...grid, basePlateOnly: true, baseHoleStructure: "magnet-post-hole" } }],
  ["自定义圆槽", { mode: "custom", params: { ...custom,
    slots: [createFreeSlotInstance({ id: "a", x: 35, y: 40, width: 25 })] } }],
  ["自定义旋转超椭圆槽", { mode: "custom", params: { ...custom,
    slots: [createFreeSlotInstance({ id: "a", x: 50, y: 40, width: 50, height: 30, rotation: 35 })] } }],
  ["自定义断连轮廓", { mode: "custom", params: { ...custom, footprintStyle: "contoured", disconnectDistance: 0,
    slots: [0, 200].map((x) => createFreeSlotInstance({ id: String(x), x, y: x, width: 25 })) } }],
  ...(["manual", "tangent"] as const).map((polygonCornerStyle): [string, FlatTraySnapshot] => [
    `自定义直边包络 ${polygonCornerStyle}`, { mode: "custom", params: { ...custom,
      footprintStyle: "polygonal", polygonCornerStyle, cornerRadius: 30, sideBevelWidth: 8,
      slots: [[0, 0], [60, 0], [30, 50]].map(([x, y]) => createFreeSlotInstance({ id: String(x), x, y, width: 25 })) } },
  ]),
];

describe("真实内核 STEP 往返", () => {
  beforeAll(async () => { await loadStepKernel(); }, 15000);

  it.each(cases)("%s", async (_name, snapshot) => {
    const plan = prepareStepConstruction(snapshot);
    const model = snapshot.mode === "grid" ? createTrayModel(snapshot.params) : createCustomTrayModel(snapshot.params, plan.contoured);
    const shape = realizeStepTray(plan);
    try {
      const { volume, bounds, solidCount } = validateStepSolid(shape, "托盘");
      expect(solidCount).toBe(plan.contoured.status === "ready" ? Math.max(1, plan.contoured.value.bodyCount) : 1);
      const reference = measurements.measureVolume(model);
      expect(Math.abs(volume - reference) / reference).toBeLessThan(0.002);
      const refBounds = measurements.measureBoundingBox(model);
      for (const [index, coordinate] of bounds.flat().entries()) {
        expect(Math.abs(coordinate - refBounds.flat()[index])).toBeLessThan(0.001);
      }
      const blob = exportSTEP([{ shape, name: "tray" }], { unit: "MM", modelUnit: "MM" });
      const step = await blob.text();
      expect(step).toMatch(/MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS/);
      expect(step).toContain("SI_UNIT(.MILLI.,.METRE.)");
      expect(step).toContain("AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF");
      if (plan.grooves.some(({ shape }) => shape === "circle")) {
        expect(step).toContain("CYLINDRICAL_SURFACE");
      }
      const restored = requireStepSolid(await importSTEP(blob));
      try {
        const roundTrip = validateStepSolid(restored, "读回托盘");
        expect(roundTrip.solidCount).toBe(solidCount);
        expect(Math.abs(measureVolume(restored) - volume)).toBeLessThan(Math.max(0.001, volume * 1e-8));
        for (const [index, coordinate] of roundTrip.bounds.flat().entries()) {
          expect(Math.abs(coordinate - bounds.flat()[index])).toBeLessThan(0.001);
        }
      } finally { restored.delete(); }
    } finally { shape.delete(); }
  }, 15000);

  it("拒绝非有限参数和无法容纳的底孔", () => {
    expect(() => prepareStepConstruction({ mode: "grid", params: { ...grid, rows: Infinity } })).toThrow("网格行列");
    expect(() => prepareStepConstruction({ mode: "grid", params: { ...grid, slotDiameter: 10 } })).toThrow();
  });
});
