import { describe, expect, it } from "vitest";
import { buildCanvasCollisionState } from "@/lib/canvas-collision-model";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import {
  calculateFixedCustomTrayUsableArea,
  isCustomSlotWithinFixedTrayUsableArea,
} from "@/lib/custom-layout-math";
import { randomizeCustomSlotArrangement } from "@/lib/custom-random-layout";
import type { CustomLayoutParams } from "@/types/custom-tray";

function createSequenceRandom(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

function applyUpdates(
  params: CustomLayoutParams,
  updates: { id: string; x: number; y: number }[],
) {
  const updatesById = new Map(updates.map((update) => [update.id, update]));
  return params.slots.map((slot) => ({
    ...slot,
    ...updatesById.get(slot.id),
  }));
}

describe("custom random layout", () => {
  it("returns a fully valid fixed-tray layout on the 0.1mm grid", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      traySizingMode: "fixed" as const,
      trayWidth: 120,
      trayDepth: 100,
      boundarySpacingIndependent: true,
      boundarySpacing: 5,
      slots: [
        {
          id: "first",
          x: 0,
          y: 0,
          shape: "circle" as const,
          width: 20,
          height: 20,
          rotation: 0,
        },
        {
          id: "second",
          x: 0,
          y: 0,
          shape: "circle" as const,
          width: 20,
          height: 20,
          rotation: 0,
        },
      ],
    };

    const result = randomizeCustomSlotArrangement(
      params,
      createSequenceRandom([0.1, 0.1, 0.8, 0.8]),
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.updates.map((update) => update.id)).toEqual([
      "first",
      "second",
    ]);
    expect(
      result.updates.every(
        (update) =>
          Number.isInteger(update.x * 10) && Number.isInteger(update.y * 10),
      ),
    ).toBe(true);

    const placedSlots = applyUpdates(params, result.updates);
    const usableArea = calculateFixedCustomTrayUsableArea(params);
    expect(
      placedSlots.every((slot) =>
        isCustomSlotWithinFixedTrayUsableArea(slot, usableArea),
      ),
    ).toBe(true);
    expect(buildCanvasCollisionState(placedSlots, params.spacing).collisionErrorCount).toBe(0);
  });

  it("places larger final footprints first while preserving update order", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      traySizingMode: "fixed" as const,
      trayWidth: 140,
      trayDepth: 100,
      boundarySpacingIndependent: true,
      boundarySpacing: 5,
      slots: [
        {
          id: "small",
          x: 0,
          y: 0,
          shape: "circle" as const,
          width: 20,
          height: 20,
          rotation: 0,
        },
        {
          id: "large",
          x: 0,
          y: 0,
          shape: "circle" as const,
          width: 60,
          height: 60,
          rotation: 0,
        },
      ],
    };

    const result = randomizeCustomSlotArrangement(
      params,
      createSequenceRandom([0.5, 0.5, 0.5, 0.5, 0, 0]),
    );

    expect(result).toEqual({
      status: "success",
      updates: [
        { id: "small", x: 15.2, y: 15.2 },
        { id: "large", x: 70, y: 50 },
      ],
    });
  });

  it("returns failure without partial updates when the fixed tray cannot fit a slot", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      traySizingMode: "fixed" as const,
      trayWidth: 30,
      trayDepth: 30,
      boundarySpacingIndependent: true,
      boundarySpacing: 5,
      slots: [
        {
          id: "too-large",
          x: 15,
          y: 15,
          shape: "circle" as const,
          width: 25,
          height: 25,
          rotation: 0,
        },
      ],
    };

    expect(randomizeCustomSlotArrangement(params, () => 0.5)).toEqual({
      status: "failed",
    });
  });

  it("does not randomize automatic layouts", () => {
    expect(
      randomizeCustomSlotArrangement({
        ...CUSTOM_LAYOUT_DEFAULTS,
        slots: [
          {
            id: "slot",
            x: 20,
            y: 20,
            shape: "circle",
            width: 20,
            height: 20,
            rotation: 0,
          },
        ],
      }),
    ).toEqual({ status: "failed" });
  });
});
