import { describe, expect, it } from "vitest";
import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import { buildCanvasCollisionState } from "@/lib/canvas-collision-model";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { buildSteppedBridgeWarning } from "@/lib/stepped-bridge-warning";
import { calculateSteppedEffectiveDimensions } from "@/lib/stepped-layout-math";
import {
  generateSteppedOptimizationProposals,
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

describe("stepped global optimize", () => {
  it("returns a deterministic compact-only proposal", () => {
    const params = createParams();

    const first = generateSteppedOptimizationProposals(params, { variantIndex: 0 });
    const second = generateSteppedOptimizationProposals(params, { variantIndex: 0 });

    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0]?.kind).toBe("compact");
    expect(first[0]?.id).toBe("compact");
  });

  it("cycles through different compact layouts when the variant index changes", () => {
    const params = createParams();
    const first = generateSteppedOptimizationProposals(params, { variantIndex: 0 });
    const second = generateSteppedOptimizationProposals(params, { variantIndex: 1 });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(second[0]?.params).not.toEqual(first[0]?.params);
  });

  it("preserves stepped identities and computes collision-free trimmed layouts", () => {
    const params = createParams();
    const [proposal] = generateSteppedOptimizationProposals(params);

    expect(proposal).toBeTruthy();
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

  it("prefers a horizontal footprint close to a 5:2 ratio", () => {
    const [proposal] = generateSteppedOptimizationProposals(createParams());
    const ratio = proposal.metrics.width / proposal.metrics.depth;

    expect(proposal.metrics.width).toBeGreaterThan(proposal.metrics.depth);
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(3.2);
  });

  it("keeps groups in separate horizontal regions instead of mixing them together", () => {
    const [proposal] = generateSteppedOptimizationProposals(createParams());
    const boundsByGroup = new Map<
      string,
      { minX: number; maxX: number }
    >();

    proposal.params.slots.forEach((slot) => {
      const { halfW } = getEllipseBoundingBox(
        slot.width,
        slot.height,
        slot.rotation,
      );
      const nextBounds = {
        minX: slot.x - halfW,
        maxX: slot.x + halfW,
      };
      const existing = boundsByGroup.get(slot.groupId);

      if (!existing) {
        boundsByGroup.set(slot.groupId, nextBounds);
        return;
      }

      existing.minX = Math.min(existing.minX, nextBounds.minX);
      existing.maxX = Math.max(existing.maxX, nextBounds.maxX);
    });

    const orderedBounds = createParams().groups
      .map((group) => boundsByGroup.get(group.id))
      .filter((bounds): bounds is { minX: number; maxX: number } => Boolean(bounds));

    for (let index = 1; index < orderedBounds.length; index += 1) {
      const previous = orderedBounds[index - 1]!;
      const current = orderedBounds[index]!;
      expect(previous.maxX).toBeLessThanOrEqual(current.minX);
    }
  });

  it("keeps each packed row centered to favor symmetrical layouts", () => {
    const [proposal] = generateSteppedOptimizationProposals(createParams());
    const groupBounds = new Map<string, { minX: number; maxX: number }>();
    const rowsByGroup = new Map<string, Map<string, typeof proposal.params.slots>>();

    proposal.params.slots.forEach((slot) => {
      const { halfW } = getEllipseBoundingBox(
        slot.width,
        slot.height,
        slot.rotation,
      );
      const existingBounds = groupBounds.get(slot.groupId);
      const nextMinX = slot.x - halfW;
      const nextMaxX = slot.x + halfW;
      if (existingBounds) {
        existingBounds.minX = Math.min(existingBounds.minX, nextMinX);
        existingBounds.maxX = Math.max(existingBounds.maxX, nextMaxX);
      } else {
        groupBounds.set(slot.groupId, { minX: nextMinX, maxX: nextMaxX });
      }

      const rowKey = slot.y.toFixed(3);
      const groupRows = rowsByGroup.get(slot.groupId) ?? new Map();
      const row = groupRows.get(rowKey);
      if (row) {
        row.push(slot);
      } else {
        groupRows.set(rowKey, [slot]);
      }
      rowsByGroup.set(slot.groupId, groupRows);
    });

    rowsByGroup.forEach((groupRows, groupId) => {
      const bounds = groupBounds.get(groupId);
      expect(bounds).toBeTruthy();
      const groupCenterX = ((bounds?.minX ?? 0) + (bounds?.maxX ?? 0)) / 2;

      groupRows.forEach((rowSlots) => {
        const left = Math.min(
          ...rowSlots.map((slot) => {
            const { halfW } = getEllipseBoundingBox(
              slot.width,
              slot.height,
              slot.rotation,
            );
            return slot.x - halfW;
          }),
        );
        const right = Math.max(
          ...rowSlots.map((slot) => {
            const { halfW } = getEllipseBoundingBox(
              slot.width,
              slot.height,
              slot.rotation,
            );
            return slot.x + halfW;
          }),
        );

        expect(Math.abs((left + right) / 2 - groupCenterX)).toBeLessThanOrEqual(
          0.05,
        );
      });
    });
  });
});
