import { expect, it } from "vitest";
import { MANUAL_SPLIT_DEFAULTS, replayManualCuts, splitPrintRotation, type ManualSplitCut, type ManualSplitScene } from "./manual-split-plan";

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
