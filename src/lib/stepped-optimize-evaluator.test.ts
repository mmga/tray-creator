import { describe, expect, it } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import {
  calculateHeightBandFootprintCost,
  compareCompactCandidateEvaluations,
  evaluateCompactCandidate,
} from "@/lib/stepped-optimize-evaluator";

function createParams() {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    footprintStyle: "rectangular" as const,
    boundarySpacing: 5,
    boundarySpacingIndependent: true,
    groups: [
      { ...STEPPED_LAYOUT_DEFAULTS.groups[0], id: "low", bottomHeight: 10 },
      { ...STEPPED_LAYOUT_DEFAULTS.groups[0], id: "high", bottomHeight: 25 },
    ],
    activeGroupId: "low",
  };
}

function slot(id: string, groupId: string, x: number, y = 20) {
  return {
    id,
    groupId,
    x,
    y,
    shape: "circle" as const,
    width: 25,
    height: 25,
    rotation: 0,
  };
}

describe("stepped optimize evaluator", () => {
  it("矩形高度组更集中时高度带体积和空白更小", () => {
    const params = createParams();
    const spread = [
      slot("h1", "high", 20),
      slot("l1", "low", 70),
      slot("l2", "low", 120),
      slot("h2", "high", 170),
    ];
    const concentrated = [
      slot("h1", "high", 20),
      slot("h2", "high", 70),
      slot("l1", "low", 120),
      slot("l2", "low", 170),
    ];

    const spreadCost = calculateHeightBandFootprintCost(params, spread);
    const concentratedCost = calculateHeightBandFootprintCost(params, concentrated);

    expect(concentratedCost.estimatedVolume).toBeLessThan(spreadCost.estimatedVolume);
    expect(concentratedCost.heightBandWhitespace).toBeLessThan(
      spreadCost.heightBandWhitespace,
    );
    expect(
      compareCompactCandidateEvaluations(
        evaluateCompactCandidate(params, concentrated, 0, 1),
        evaluateCompactCandidate(params, spread, 0, 1),
      ),
    ).toBeLessThan(0);
  });
});
