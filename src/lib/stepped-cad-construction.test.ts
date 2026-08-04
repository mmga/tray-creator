import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const mocks = vi.hoisted(() => ({
  buildFeatureGraph: vi.fn(),
  buildPartitionPlan: vi.fn(),
  buildProfilePlan: vi.fn(),
  realizeWhole: vi.fn(),
  realizeSplitParts: vi.fn(),
}));

vi.mock("@/lib/stepped-cad-feature-graph", () => ({
  buildSteppedCadFeatureGraph: mocks.buildFeatureGraph,
}));
vi.mock("@/lib/stepped-cad-split-partition-plan", () => ({
  buildSteppedCadSplitPartitionPlan: mocks.buildPartitionPlan,
}));
vi.mock("@/lib/stepped-cad-split-profiles", () => ({
  buildSteppedCadSplitProfilePlan: mocks.buildProfilePlan,
}));
vi.mock("@/lib/stepped-cad-realization", () => ({
  realizeSteppedCadWhole: mocks.realizeWhole,
  realizeSteppedCadSplitParts: mocks.realizeSplitParts,
}));

import {
  createSteppedCadSplitParts,
  createSteppedCadTrayModel,
} from "@/lib/stepped-cad-construction";

const params = {
  groups: [{ id: "group-a", name: "A" }],
  splitGrooveDepth: 2,
  splitGrooveType: "profile",
  enableSplitRecess: true,
  enableSplitLocators: false,
} as unknown as SteppedLayoutParams;
const graph = { groups: [{ groupId: "group-a" }] };

describe("CAD Stepped Construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildFeatureGraph.mockReturnValue(graph);
  });

  it("keeps whole-model construction free of split planning", () => {
    const geometry = { polygons: [] };
    mocks.realizeWhole.mockReturnValue(geometry);

    expect(createSteppedCadTrayModel(params)).toBe(geometry);
    expect(mocks.buildPartitionPlan).not.toHaveBeenCalled();
    expect(mocks.buildProfilePlan).not.toHaveBeenCalled();
    expect(mocks.realizeSplitParts).not.toHaveBeenCalled();
  });

  it("derives one partition plan and shares it with profile and 3D realization", () => {
    const partitionPlan = { units: [{ unitKey: "group-a" }] };
    const splitProfilePlan = { units: [{ unitKey: "group-a" }] };
    const parts = [{ index: 0, geometry: { polygons: [] } }];
    mocks.buildPartitionPlan.mockReturnValue(partitionPlan);
    mocks.buildProfilePlan.mockReturnValue(splitProfilePlan);
    mocks.realizeSplitParts.mockReturnValue(parts);

    expect(createSteppedCadSplitParts(params)).toBe(parts);
    expect(mocks.buildPartitionPlan).toHaveBeenCalledOnce();
    expect(mocks.buildProfilePlan).toHaveBeenCalledWith({
      partitionPlan,
      params: expect.objectContaining({ splitGrooveDepth: 2 }),
    });
    expect(mocks.realizeSplitParts).toHaveBeenCalledWith({
      partitionPlan,
      splitProfilePlan,
      params,
    });
  });
});
