import { beforeAll, describe, expect, it } from "vitest";
import { exportSTEP, importSTEP } from "replicad";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { createFreeSlotInstance } from "@/lib/slot-instance-factory";
import { createManualSplitScene } from "@/lib/manual-split-cad";
import { prepareCustomTrayCutSource } from "@/lib/custom-tray-model";
import { prepareGridTrayCutSource } from "@/lib/tray-model";
import { MANUAL_SPLIT_DEFAULTS, replayManualCuts, type FlatTraySnapshot, type ManualSplitCut } from "@/lib/manual-split-plan";
import { ringEdges, splitBounds, type SplitPoint } from "@/lib/manual-split-geometry";
import { planManualSplitRoutes } from "@/lib/manual-split-routes";
import { loadStepKernel } from "./step-kernel";
import { prepareStepConstruction, realizeStepTray, requireStepSolid, validateStepSolid } from "./step-realization";
import { realizeStepParts } from "./step-split";

const settings = { ...MANUAL_SPLIT_DEFAULTS, enabled: true };
const custom = { ...CUSTOM_LAYOUT_DEFAULTS, traySizingMode: "fixed" as const, trayWidth: 100,
  trayDepth: 100, baseHoleStructure: "none" as const };

async function verifyParts(snapshot: FlatTraySnapshot, ids: string[]) {
  const plan = prepareStepConstruction(snapshot);
  const whole = realizeStepTray(plan);
  try {
    const parts = realizeStepParts(whole, snapshot, plan);
    try {
      expect(parts.map(({ id }) => id).sort()).toEqual(ids);
      let volume = 0;
      for (const { shape, id } of parts) {
        const checked = validateStepSolid(shape, id);
        const [min, max] = checked.bounds;
        expect(min[2]).toBeCloseTo(0, 5);
        expect(min[0] + max[0]).toBeCloseTo(0, 5);
        expect(min[1] + max[1]).toBeCloseTo(0, 5);
        expect(checked.solidCount).toBe(1);
        const blob = exportSTEP([{ shape, name: id }], { unit: "MM" });
        const restored = requireStepSolid(await importSTEP(blob));
        try {
          const after = validateStepSolid(restored, id);
          expect(after.volume).toBeCloseTo(checked.volume, 4);
          volume += after.volume;
        } finally { restored.delete(); }
      }
      expect(volume).toBeCloseTo(validateStepSolid(whole, "整件").volume, 3);
    } finally { parts.forEach(({ shape }) => shape.delete()); }
  } finally { whole.delete(); }
}

describe("STEP 分件", () => {
  beforeAll(async () => { await loadStepKernel(); }, 15000);

  it("保留圆角与斜面，分割端点位于预览圆弧的采样边中点", async () => {
    const params = { ...custom, sideBevelWidth: 2, cornerRadius: 8 };
    const { roots } = createManualSplitScene(prepareCustomTrayCutSource(params, { status: "inactive" }), settings.clearance);
    const corner = ringEdges(roots[0].outer)
      .map(([a, b]): SplitPoint => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
      .sort((a, b) => b[0] + b[1] - a[0] - a[1])[0];
    const opposite = ringEdges(roots[0].outer)
      .map(([a, b]): SplitPoint => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
      .sort((a, b) => a[0] + a[1] - b[0] - b[1])[0];
    await verifyParts({ mode: "custom", params: { ...params, manualSplit: { ...settings,
      cuts: [{ target: "1", path: [corner, opposite] }] } } }, ["1.1", "1.2"]);
  }, 15000);

  it("保留绕开旋转超椭圆的原折线", async () => {
    const params = { ...custom, slots: [createFreeSlotInstance({ id: "a", x: 50, y: 50,
      width: 36, height: 20, rotation: 35 })] };
    const scene = createManualSplitScene(prepareCustomTrayCutSource(params, { status: "inactive" }), settings.clearance);
    const bounds = splitBounds(scene.roots[0].outer);
    const [route] = planManualSplitRoutes(scene.roots[0], scene.obstacles, [0, bounds.min[1]], [0, bounds.max[1]]);
    expect(route.path.length).toBeGreaterThan(2);
    await verifyParts({ mode: "custom", params: { ...params, manualSplit: { ...settings,
      cuts: [{ target: "1", path: route.path }] } } }, ["1.1", "1.2"]);
  }, 15000);

  it("断连轮廓可以按独立实体导出，无需添加切线", async () => {
    await verifyParts({ mode: "custom", params: { ...custom, footprintStyle: "contoured", manualSplit: settings,
      slots: [0, 200].map((x) => createFreeSlotInstance({ id: String(x), x, y: x, width: 25 })) } }, ["1", "2"]);
  }, 15000);

  it("连续切割网格时保留封闭磁吸腔并分配稳定编号", async () => {
    const params = { ...DEFAULT_TRAY_PARAMS, rows: 3, columns: 2 };
    const plan = prepareStepConstruction({ mode: "grid", params });
    const rows = [...new Set(plan.grooves.map(({ cy }) => cy))].sort((a, b) => a - b);
    const scene = createManualSplitScene(prepareGridTrayCutSource(params), settings.clearance);
    const cuts: ManualSplitCut[] = [];
    for (let i = 1; i < rows.length; i++) {
      const y = (rows[i - 1] + rows[i]) / 2;
      const part = replayManualCuts(scene, cuts).parts.find(({ outer }) => {
        const { min, max } = splitBounds(outer);
        return min[1] < y && max[1] > y;
      })!;
      const { min, max } = splitBounds(part.outer);
      cuts.push({ target: part.id, path: [[min[0], y], [max[0], y]] });
    }
    const ids = replayManualCuts(scene, cuts).parts.map(({ id }) => id).sort();
    expect(ids).toHaveLength(3);
    await verifyParts({ mode: "grid", params: { ...params, manualSplit: { ...settings, cuts } } }, ids);
  }, 15000);

  it("拒绝穿槽切线或超平台零件", () => {
    const baseline = { ...DEFAULT_TRAY_PARAMS, rows: 1, columns: 1, baseHoleStructure: "none" as const };
    const plan = prepareStepConstruction({ mode: "grid", params: baseline });
    const shape = realizeStepTray(plan);
    const cut: ManualSplitCut = { target: "1", path: [[-21.2, 0], [21.2, 0]] };
    try {
      expect(() => realizeStepParts(shape, { mode: "grid", params: { ...baseline,
        manualSplit: { ...settings, cuts: [cut] } } }, plan)).toThrow("分割线已失效");
    } finally { shape.delete(); }
    const { roots } = createManualSplitScene(prepareCustomTrayCutSource(custom, { status: "inactive" }), settings.clearance);
    const bounds = splitBounds(roots[0].outer);
    const params = { ...custom, manualSplit: { ...settings, bed: [25, 25, 20] as [number, number, number],
      cuts: [{ target: "1", path: [[0, bounds.min[1]], [0, bounds.max[1]]] as SplitPoint[] }] } };
    const snap = { mode: "custom" as const, params };
    const prepared = prepareStepConstruction(snap);
    const square = realizeStepTray(prepared);
    try { expect(() => realizeStepParts(square, snap, prepared)).toThrow("超出打印范围"); }
    finally { square.delete(); }
  });

  it("拒绝通过采样保护区、却离真实圆柱面过近的切线", () => {
    const params = { ...custom, trayWidth: 240, trayDepth: 240,
      slots: [createFreeSlotInstance({ id: "round", x: 120, y: 120, width: 180,
        circleConfig: { applyTolerance: false } })] };
    const clearance = 1;
    const scene = createManualSplitScene(prepareCustomTrayCutSource(params, { status: "inactive" }), clearance);
    const { min, max } = splitBounds(scene.roots[0].outer);
    const angle = Math.PI / 64;
    const path: SplitPoint[] = [min[1], max[1]].map((y) => [(90.97 - y * Math.sin(angle)) / Math.cos(angle), y]);
    const cuts = [{ target: "1", path }];
    expect(replayManualCuts(scene, cuts).invalid.size).toBe(0);
    const snapshot: FlatTraySnapshot = { mode: "custom", params: { ...params,
      manualSplit: { ...settings, clearance, cuts, bed: [300, 300, 250] } } };
    const plan = prepareStepConstruction(snapshot);
    const shape = realizeStepTray(plan);
    try { expect(() => realizeStepParts(shape, snapshot, plan)).toThrow("距离不足"); }
    finally { shape.delete(); }
  });
});
