import { expect, it } from "vitest";
import { buildEndpointSnaps, chooseSplitSnap, gridSplitGuides, slotGapMidpoint } from "./manual-split-snap";
import type { SplitRing } from "./manual-split-geometry";

function rectangle(left: number, right: number, bottom = 0, top = 20): SplitRing {
  return [[left, bottom], [right, bottom], [right, top], [left, top]];
}

it("以槽边缘而非中心计算不同尺寸槽的净距中点", () => {
  expect(slotGapMidpoint(rectangle(0, 10), rectangle(20, 40))).toEqual([15, 10]);
  expect(slotGapMidpoint(rectangle(0, 25), rectangle(20, 40))).toBeNull();
  expect(gridSplitGuides([rectangle(0, 10), rectangle(20, 40), rectangle(30, 50)], 0)).toEqual([15]);
});

it("吸附到精确边中点，对称点落在轮廓内时只显示参考", () => {
  const snaps = buildEndpointSnaps(rectangle(0, 20), [10, 10], [0, 7], true);
  expect(snaps).toContainEqual({ point: [20, 7], label: "关于竖轴对称" });
  expect(chooseSplitSnap([10.3, 0.2], snaps, 0.1)).toEqual({ point: [10, 0], label: "边中点" });
  const concave: SplitRing = [[0, 0], [20, 0], [20, 5], [10, 5], [10, 20], [0, 20]];
  expect(buildEndpointSnaps(concave, [10, 10], [0, 15], true)).toContainEqual({
    point: [20, 15], label: "镜像参考",
  });
});
