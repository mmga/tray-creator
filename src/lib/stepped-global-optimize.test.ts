import { describe, expect, it } from "vitest";
import { buildCanvasCollisionState } from "@/lib/canvas-collision-model";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { buildSteppedBridgeWarning } from "@/lib/stepped-bridge-warning";
import { calculateSteppedEffectiveDimensions } from "@/lib/stepped-layout-math";
import {
  generateSteppedOptimizationProposals,
  type SteppedOptimizationProposal,
} from "@/lib/stepped-global-optimize";

function createParams() {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    trayWidth: 260,
    trayDepth: 260,
    groups: [
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "group-1",
        name: "前排",
        bottomHeight: 10,
      },
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "group-2",
        name: "后排",
        color: "#3b82f6",
        bottomHeight: 18,
      },
    ],
    activeGroupId: "group-1",
    spacing: 5,
    smoothingRadius: 12,
    disconnectDistance: 0,
    slots: [
      {
        id: "slot-1",
        x: 40,
        y: 40,
        shape: "circle" as const,
        width: 60,
        height: 60,
        rotation: 0,
        groupId: "group-2",
      },
      {
        id: "slot-2",
        x: 170,
        y: 30,
        shape: "circle" as const,
        width: 50,
        height: 50,
        rotation: 0,
        groupId: "group-2",
      },
      {
        id: "slot-3",
        x: 50,
        y: 165,
        shape: "circle" as const,
        width: 32,
        height: 32,
        rotation: 0,
        groupId: "group-1",
      },
      {
        id: "slot-4",
        x: 165,
        y: 170,
        shape: "circle" as const,
        width: 25,
        height: 25,
        rotation: 0,
        groupId: "group-1",
      },
    ],
  };
}

function assertSorted(proposals: SteppedOptimizationProposal[]) {
  for (let index = 1; index < proposals.length; index += 1) {
    const prev = proposals[index - 1];
    const current = proposals[index];

    if (prev.metrics.area !== current.metrics.area) {
      expect(prev.metrics.area).toBeLessThanOrEqual(current.metrics.area);
      continue;
    }

    const prevMaxSide = Math.max(prev.metrics.width, prev.metrics.depth);
    const currentMaxSide = Math.max(current.metrics.width, current.metrics.depth);
    if (prevMaxSide !== currentMaxSide) {
      expect(prevMaxSide).toBeLessThanOrEqual(currentMaxSide);
      continue;
    }

    if (prev.metrics.hasBridgeWarning !== current.metrics.hasBridgeWarning) {
      expect(Number(prev.metrics.hasBridgeWarning)).toBeLessThanOrEqual(
        Number(current.metrics.hasBridgeWarning),
      );
      continue;
    }

    expect(prev.metrics.displacement).toBeLessThanOrEqual(
      current.metrics.displacement,
    );
  }
}

describe("stepped global optimize", () => {
  it("returns deterministic proposals ordered by optimization metrics", () => {
    const params = createParams();

    const first = generateSteppedOptimizationProposals(params);
    const second = generateSteppedOptimizationProposals(params);

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(new Set(first.map((proposal) => proposal.kind))).toEqual(
      new Set(["compact", "grouped", "minimal-move"]),
    );
    assertSorted(first);
  });

  it("preserves stepped identities and computes collision-free trimmed layouts", () => {
    const params = createParams();
    const proposals = generateSteppedOptimizationProposals(params);

    proposals.forEach((proposal) => {
      expect(proposal.params.activeGroupId).toBe(params.activeGroupId);
      expect(proposal.params.groups).toEqual(params.groups);
      expect(proposal.params.slots).toHaveLength(params.slots.length);
      expect(proposal.params.slots.map((slot) => slot.id).sort()).toEqual(
        params.slots.map((slot) => slot.id).sort(),
      );
      expect(
        proposal.params.slots.map((slot) => `${slot.id}:${slot.groupId}`).sort(),
      ).toEqual(
        params.slots.map((slot) => `${slot.id}:${slot.groupId}`).sort(),
      );

      const collisionState = buildCanvasCollisionState(
        proposal.params.slots,
        proposal.params.spacing,
      );
      expect(collisionState.collisionErrorCount).toBe(0);

      const dims = calculateSteppedEffectiveDimensions(proposal.params);
      expect(proposal.metrics.width).toBe(dims.width);
      expect(proposal.metrics.depth).toBe(dims.depth);
      expect(proposal.metrics.area).toBe(dims.width * dims.depth);
      expect(proposal.params.trayWidth).toBe(dims.width);
      expect(proposal.params.trayDepth).toBe(dims.depth);
      expect(proposal.metrics.hasBridgeWarning).toBe(
        buildSteppedBridgeWarning(proposal.params) !== null,
      );
    });
  });

  it("keeps compact area-focused and minimal-move focused on lower displacement", () => {
    const proposals = generateSteppedOptimizationProposals(createParams());
    const compact = proposals.find((proposal) => proposal.kind === "compact");
    const grouped = proposals.find((proposal) => proposal.kind === "grouped");
    const minimalMove = proposals.find(
      (proposal) => proposal.kind === "minimal-move",
    );

    expect(compact).toBeTruthy();
    expect(grouped).toBeTruthy();
    expect(minimalMove).toBeTruthy();

    expect(compact!.metrics.area).toBeLessThanOrEqual(minimalMove!.metrics.area);
    expect(minimalMove!.metrics.displacement).toBeLessThanOrEqual(
      compact!.metrics.displacement,
    );
    expect(minimalMove!.metrics.displacement).toBeLessThanOrEqual(
      grouped!.metrics.displacement,
    );
  });
});
