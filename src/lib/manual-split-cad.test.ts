import { expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import { createTrayModel } from "./tray-model";
import { createCustomTrayModel } from "./custom-tray-model";
import { CUSTOM_LAYOUT_DEFAULTS } from "./custom-config";
import { DEFAULT_TRAY_PARAMS } from "./grid-config";
import { createManualSplitScene, orientManualPrintPart, realizeManualSplitParts } from "./manual-split-cad";
import { cutSplitRegion, splitBounds, type SplitRing } from "./manual-split-geometry";
import { MANUAL_SPLIT_DEFAULTS, type ManualSplitScene } from "./manual-split-plan";

it("裁切真实圆角斜边网格，分件保持体积并按平台旋转落地", () => {
  let scene!: ManualSplitScene;
  const model = createTrayModel({
    ...DEFAULT_TRAY_PARAMS, rows: 1, columns: 2, spacing: 8, sideBevelWidth: 2,
    baseHoleStructure: "magnetic-base-hole",
  }, (source) => { scene = createManualSplitScene(source, 2); });
  const bounds = splitBounds(scene.roots[0].outer);
  const path: SplitRing = [[0, bounds.min[1]], [0, bounds.max[1]]];
  expect(scene.obstacles).toHaveLength(4);
  const parts = realizeManualSplitParts(model, scene, {
    ...MANUAL_SPLIT_DEFAULTS, bed: [bounds.max[1] * 2 + 0.5, bounds.max[0] + 0.5, 20],
    bedMargin: 0, cuts: [{ target: "1", path }],
  });
  expect(parts.map((part) => part.rotation)).toEqual([90, 90]);
  const [min, max] = measurements.measureBoundingBox(orientManualPrintPart(parts[0].geometry, 90));
  expect(min[2]).toBeCloseTo(0);
  expect(max[0] - min[0]).toBeCloseTo(parts[0].size[1]);
});

it("零间距去岛区域阻止沿连续凹槽拆分", () => {
  let scene!: ManualSplitScene;
  createTrayModel({
    ...DEFAULT_TRAY_PARAMS, rows: 3, columns: 3, spacing: 0, baseHoleStructure: "none",
  }, (source) => { scene = createManualSplitScene(source, 0); });
  const { min, max } = splitBounds(scene.roots[0].outer);
  expect(cutSplitRegion(scene.roots[0], [[0, min[1]], [0, max[1]]], scene.obstacles)).toBeNull();
});

it("自定义槽保护轮廓采用旋转后且含外扩的实际刀具", () => {
  let scene!: ManualSplitScene;
  createCustomTrayModel({
    ...CUSTOM_LAYOUT_DEFAULTS, traySizingMode: "fixed", trayWidth: 100, trayDepth: 100,
    baseHoleStructure: "none",
    slots: [{ id: "椭圆", x: 50, y: 50, width: 40, height: 20, shape: "ellipse", outerOffset: 1, rotation: 90 }],
  }, undefined, (source) => { scene = createManualSplitScene(source, 2); });
  const { min, max } = splitBounds(scene.grooves[0]);
  expect(max[1] - min[1]).toBeCloseTo(42, 1);
  expect(max[0] - min[0]).toBeCloseTo(22, 1);
  const bounds = splitBounds(scene.roots[0].outer);
  expect(cutSplitRegion(scene.roots[0], [[12, bounds.min[1]], [12, bounds.max[1]]], scene.obstacles)).toBeNull();
  expect(cutSplitRegion(scene.roots[0], [[14, bounds.min[1]], [14, bounds.max[1]]], scene.obstacles)).not.toBeNull();
});
