import { describe, expect, it } from "vitest";
import {
  analyzeBridgeWarning,
  clusterConnectivityCircles,
  getConnectivityRadius,
  getEffectiveBridgeGap,
} from "@/lib/stepped-connectivity";

describe("stepped connectivity", () => {
  it("calculates connectivity radius using the largest tolerated diameter", () => {
    expect(getConnectivityRadius(25, 32, 5, 0.2, 0.4)).toBeCloseTo(21.2, 5);
  });

  it("uses disconnect distance when provided and falls back to smoothing radius", () => {
    expect(getEffectiveBridgeGap(60, 0)).toBe(60);
    expect(getEffectiveBridgeGap(60, 12)).toBe(12);
    expect(getEffectiveBridgeGap(60, -5)).toBe(60);
  });

  it("clusters circles by allowed gap", () => {
    const circles = [
      { id: "a", cx: 0, cy: 0, rOuter: 10 },
      { id: "b", cx: 20, cy: 0, rOuter: 10 },
      { id: "c", cx: 50, cy: 0, rOuter: 10 },
    ];

    expect(clusterConnectivityCircles(circles, 0)).toHaveLength(2);
    expect(clusterConnectivityCircles(circles, 20)).toHaveLength(1);
  });

  it("emits bridge warnings only when bridging merges separate clusters", () => {
    const circles = [
      { id: "a", cx: 0, cy: 0, rOuter: 10 },
      { id: "b", cx: 24, cy: 0, rOuter: 10 },
      { id: "c", cx: 48, cy: 0, rOuter: 10 },
    ];

    expect(
      analyzeBridgeWarning(circles, 0, 0, {
        groupId: "group-1",
        groupName: "组 1",
      }),
    ).toBeNull();

    expect(
      analyzeBridgeWarning(circles, 6, 0, {
        groupId: "group-1",
        groupName: "组 1",
      }),
    ).toEqual({
      groupId: "group-1",
      groupName: "组 1",
      separatedClusterCount: 3,
      mergedClusterCount: 1,
      effectiveBridgeGap: 6,
    });

    expect(
      analyzeBridgeWarning(
        [{ id: "a", cx: 0, cy: 0, rOuter: 10 }],
        6,
        0,
        {
          groupId: "group-1",
          groupName: "组 1",
        },
      ),
    ).toBeNull();
  });
});
