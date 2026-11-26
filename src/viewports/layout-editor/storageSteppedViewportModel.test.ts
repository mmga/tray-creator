import { describe, expect, it } from "vitest";
import { buildStorageSteppedLayoutEditorViewportModel } from "@/viewports/layout-editor/storageSteppedViewportModel";
import { createDefaultStorageSteppedParams } from "@/lib/storage-stepped-config";
import { createFreeSlotInstance } from "@/lib/slot-instance-factory";

describe("Storage Stepped 二维编辑模型", () => {
  it("使用固定托盘边界与当前阶槽位", () => {
    const base = createDefaultStorageSteppedParams();
    const params = {
      ...base,
      trays: base.trays.map((tray) =>
        tray.stepIndex === 1
          ? {
              ...tray,
              slots: [
                createFreeSlotInstance({ id: "b", x: 60, y: 37.7, width: 32 }),
              ],
            }
          : tray,
      ),
    };

    const model = buildStorageSteppedLayoutEditorViewportModel({
      params,
      stepIndex: 1,
    });
    expect(model.trayFrame.width).toBeCloseTo(235.4, 6);
    expect(model.trayFrame.depth).toBeCloseTo(75.4, 6);
    expect(model.trayFrame.spacing).toBe(5);
    expect(model.trayFrame.boundarySpacing).toBe(3);
    expect(model.trayFrame.cornerRadius).toBe(0);
    expect(model.trayFrame.showEffectiveBaseplate).toBe(false);
    expect(model.slots).toHaveLength(1);
    expect(model.slots[0].id).toBe("b");
    expect(model.overlays.footprintWarnings).toEqual([]);
  });

  it("越界或间距冲突作为画布警告上报", () => {
    const base = createDefaultStorageSteppedParams();
    const params = {
      ...base,
      trays: base.trays.map((tray) =>
        tray.stepIndex === 0
          ? {
              ...tray,
              slots: [
                createFreeSlotInstance({ id: "a", x: 1, y: 37.7, width: 32 }),
              ],
            }
          : tray,
      ),
    };
    const model = buildStorageSteppedLayoutEditorViewportModel({
      params,
      stepIndex: 0,
    });
    expect(model.overlays.footprintWarnings?.join()).toContain("槽位越界");
  });

  it("切换阶不改变固定边界", () => {
    const params = createDefaultStorageSteppedParams();
    const first = buildStorageSteppedLayoutEditorViewportModel({ params, stepIndex: 0 });
    const third = buildStorageSteppedLayoutEditorViewportModel({ params, stepIndex: 2 });
    expect(third.trayFrame).toEqual(first.trayFrame);
  });
});
