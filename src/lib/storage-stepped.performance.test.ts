import { describe, expect, it } from "vitest";
import { createFreeSlotInstance } from "@/lib/slot-instance-factory";
import {
  createDefaultStorageSteppedParams,
  storageSteppedTrayPartId,
  withStorageSteppedHeightSpec,
} from "@/lib/storage-stepped-config";
import {
  createStorageSteppedBodyModel,
  createStorageSteppedPartModels,
  createStorageSteppedTrayModel,
} from "@/lib/storage-stepped-model";
import {
  applyStorageSteppedTrayPreset,
} from "@/lib/storage-stepped-presets";
import type { StorageSteppedParams } from "@/types/storage-stepped";

function measure(label: string, run: () => unknown): number {
  const startedAt = performance.now();
  run();
  const duration = performance.now() - startedAt;
  console.info(`[storage-stepped perf] ${label}: ${duration.toFixed(1)} ms`);
  return duration;
}

function withStaggeredFirstTray(): StorageSteppedParams {
  return applyStorageSteppedTrayPreset(
    createDefaultStorageSteppedParams("standard"),
    0,
    "circle-32-ten-staggered",
    { createId: (() => {
      let index = 0;
      return () => `perf-slot-${++index}`;
    })() },
  );
}

describe("storage stepped performance baseline", () => {
  it("records cold/warm body, tray, assembly and single-tray edit timings", () => {
    const standard = createDefaultStorageSteppedParams("standard");
    const storage = withStorageSteppedHeightSpec(standard, "storage");
    const withSlots = withStaggeredFirstTray();

    const coldBody = measure("first body (standard)", () =>
      createStorageSteppedBodyModel(standard),
    );
    const warmBody = measure("body again (standard)", () =>
      createStorageSteppedBodyModel(standard),
    );
    const storageBody = measure("body (storage height)", () =>
      createStorageSteppedBodyModel(storage),
    );
    const flatTray = measure("flat tray", () =>
      createStorageSteppedTrayModel(standard, 1),
    );
    const staggeredTray = measure(`${withSlots.trays[0].slots.length}-slot staggered tray`, () =>
      createStorageSteppedTrayModel(withSlots, 0),
    );
    const assembly = measure("assembly: body + 3 trays", () =>
      createStorageSteppedPartModels(withSlots),
    );

    const movedSlotParams: StorageSteppedParams = {
      ...withSlots,
      trays: withSlots.trays.map((tray) =>
        tray.stepIndex === 0
          ? {
              ...tray,
              slots: [
                createFreeSlotInstance({
                  id: "moved",
                  x: 117.7,
                  y: 37.7,
                  width: 32,
                }),
              ],
            }
          : tray,
      ),
    };
    const singleTrayChange = measure("single tray after slot edit", () =>
      createStorageSteppedTrayModel(movedSlotParams, 0),
    );

    expect(createStorageSteppedBodyModel(standard)).toBeTruthy();
    expect(storageSteppedTrayPartId(0)).toBe("tray-1");
    // 宽松上限只用于发现数量级退化，不作为产品性能指标。
    for (const duration of [
      coldBody,
      warmBody,
      storageBody,
      flatTray,
      staggeredTray,
      singleTrayChange,
    ]) {
      expect(duration).toBeLessThan(15_000);
    }
    expect(assembly).toBeLessThan(30_000);
  }, 120_000);
});
