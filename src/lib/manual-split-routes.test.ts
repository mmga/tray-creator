import { expect, it } from "vitest";
import { cutSplitRegion, pointInSplitRing, type SplitPoint, type SplitRegion, type SplitRing } from "./manual-split-geometry";
import { planManualSplitRoutes } from "./manual-split-routes";

const region: SplitRegion = { outer: [[0, 0], [80, 0], [80, 80], [0, 80]], holes: [] };
const start: SplitPoint = [40, 0];
const end: SplitPoint = [40, 80];
const obstacle: SplitRing = Array.from({ length: 120 }, (_, i) => {
  const angle = i * Math.PI / 60;
  return [40 + 10 * Math.cos(angle), 40 + 10 * Math.sin(angle)];
});

it("选择两点后给出圆槽两侧分件归属不同的候选", () => {
  const routes = planManualSplitRoutes(region, [obstacle], start, end);
  expect(routes).toHaveLength(2);
  expect(routes.map((route) => pointInSplitRing([40, 40], route.children[0].outer)).sort()).toEqual([false, true]);
  for (const route of routes) {
    expect(cutSplitRegion(region, route.path, [obstacle])).not.toBeNull();
    expect(route.length).toBeLessThan(85);
  }
});

it("只提供有效直线，或遵守用户指定的途经点", () => {
  expect(planManualSplitRoutes(region, [], start, end).map(({ path }) => path)).toEqual([[start, end]]);
  const via: SplitPoint = [20, 45];
  const routes = planManualSplitRoutes(region, [obstacle], start, end, via);
  expect(routes.map(({ path }) => path)).toEqual([[start, via, end]]);
  expect(planManualSplitRoutes(region, [obstacle], start, end, [40, 40])).toEqual([]);
});

it("保护区隔断托盘时没有可用路线", () => {
  const barrier: SplitRing = [[-2, 35], [82, 35], [82, 45], [-2, 45]];
  expect(planManualSplitRoutes(region, [barrier], start, end)).toEqual([]);
});

it("沿外壁切出过窄薄边时保留候选但给出提示", () => {
  const [route] = planManualSplitRoutes(region, [], [0.8, 0], [0.8, 80]);
  expect(route.narrowWeb).toBe(true);
  expect(planManualSplitRoutes(region, [], start, end)[0].narrowWeb).toBe(false);
});
