import { describe, expect, it } from "vitest";
import { cutSplitRegion, splitRingArea, type SplitRegion, type SplitRing } from "./manual-split-geometry";

const square: SplitRegion = { outer: [[0, 0], [20, 0], [20, 20], [0, 20]], holes: [] };
const obstacle: SplitRing = [[8, 8], [12, 8], [12, 12], [8, 12]];

describe("手动拆件分区", () => {
  it("两个子件共享同一切线，已确认接缝可作为下一刀的边界", () => {
    const cut = cutSplitRegion(square, [[10, 0], [10, 20]], [])!;
    expect(cut.children.map(({ outer }) => splitRingArea(outer))).toEqual([200, 200]);
    const next = cutSplitRegion(cut.children[0], [[10, 10], [20, 10]], [])!;
    expect(next.children.map(({ outer }) => splitRingArea(outer))).toEqual([100, 100]);
  });

  it("保留完整内孔，拒绝穿过、擦到保护区或自交的路径", () => {
    expect(cutSplitRegion(square, [[10, 0], [10, 20]], [obstacle])).toBeNull();
    expect(cutSplitRegion(square, [[8, 0], [8, 20]], [obstacle])).toBeNull();
    expect(cutSplitRegion(square, [[10, 0], [15, 15], [15, 5], [10, 20]], [])).toBeNull();
    const routed = cutSplitRegion({ ...square, holes: [obstacle] }, [[10, 0], [13, 7], [13, 13], [10, 20]], [])!;
    expect(routed.children.map(({ holes }) => holes.length).sort()).toEqual([0, 1]);
    expect(routed.children.reduce((total, { outer }) => total + splitRingArea(outer), 0)).toBe(400);
  });

  it("允许从同一边绕行切出一个子件，拒绝从凹形零件切到外部", () => {
    const result = cutSplitRegion(square, [[5, 0], [10, 5], [15, 0]], [])!;
    expect(result.children.map(({ outer }) => splitRingArea(outer))).toEqual([25, 375]);
    const concave = { ...square, outer: [[0, 0], [20, 0], [20, 20], [15, 20], [15, 5], [5, 5], [5, 20], [0, 20]] as SplitRing };
    expect(cutSplitRegion(concave, [[0, 10], [20, 10]], [])).toBeNull();
  });
});
