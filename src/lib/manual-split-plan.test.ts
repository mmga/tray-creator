import { expect, it } from "vitest";
import {
  MANUAL_SPLIT_DEFAULTS, planOrthogonalSplit, replayManualCuts, splitPrintRotation, type ManualSplitCut, type ManualSplitScene,
} from "./manual-split-plan";

it("修改平台只改变尺寸判定，几何冲突会标记上游切线及依赖", () => {
  const scene: ManualSplitScene = {
    roots: [{ id: "1", outer: [[0, 0], [100, 0], [100, 80], [0, 80]], holes: [] }],
    obstacles: [], grooves: [], height: 6,
  };
  const cuts: ManualSplitCut[] = [
    { target: "1", path: [[50, 0], [50, 80]] },
    { target: "1.1", path: [[50, 40], [100, 40]] },
  ];
  const plan = replayManualCuts(scene, cuts);
  expect(plan.parts.map(({ id }) => id)).toEqual(["1.2", "1.1.1", "1.1.2"]);
  expect(splitPrintRotation([50, 80, 6], MANUAL_SPLIT_DEFAULTS)).toBe(0);
  expect(splitPrintRotation([50, 80, 6], { ...MANUAL_SPLIT_DEFAULTS, bed: [81, 51, 6], bedMargin: 0 })).toBe(90);
  expect(splitPrintRotation([50, 80, 6], { ...MANUAL_SPLIT_DEFAULTS, bed: [81, 51, 5], bedMargin: 0 })).toBeNull();
  expect(replayManualCuts(scene, cuts)).toEqual(plan);
  const changed = replayManualCuts({
    ...scene, obstacles: [[[45, 30], [55, 30], [55, 45], [45, 45]]],
  }, cuts);
  expect([...changed.invalid]).toEqual([["1", "boundary"], ["1.1", "dependency"]]);
  expect(changed.parts.map(({ id }) => id)).toEqual(["1"]);
});

it("旋转和上下镜像都完整重放，镜像侧失效时两条线均不应用", () => {
  const scene: ManualSplitScene = {
    roots: [{ id: "1", outer: [[0, 0], [100, 0], [100, 80], [0, 80]], holes: [] }],
    obstacles: [], grooves: [], height: 6,
  };
  const [region] = scene.roots;
  const rotated = planOrthogonalSplit(region, [[30, 80], [30, 60], [10, 60], [10, 0]], [], { kind: "rotate", center: [50, 40] });
  expect(rotated.cuts[1].path).toEqual([[70, 0], [70, 20], [90, 20], [90, 80]]);
  expect(replayManualCuts(scene, rotated.cuts).parts).toEqual(rotated.parts);
  const mirrored = planOrthogonalSplit(region, [[0, 65], [30, 65], [30, 55], [100, 55]], [],
    { kind: "top-bottom", center: [50, 40] });
  expect(mirrored.cuts[1].path).toEqual([[0, 15], [30, 15], [30, 25], [100, 25]]);
  const changed = replayManualCuts({ ...scene, obstacles: [[[50, 20], [60, 20], [60, 30], [50, 30]]] }, mirrored.cuts);
  expect(changed.invalid.size).toBe(2);
  expect(changed.parts).toEqual(scene.roots);
  expect(planOrthogonalSplit(region, [[0, 40], [45, 40], [45, 65], [100, 65]], [],
    { kind: "top-bottom", center: [50, 40] }).issue).toContain("相交、接触或重合");
});
