import { describe, expect, it } from "vitest";
import {
  applySteppedBaseHoleDerivedFields,
  getSteppedGroupResolvedBaseHoleSize,
} from "@/lib/stepped-base-hole";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";

function createParams(
  slot: { shape: "circle" | "ellipse"; width: number; height: number },
): SteppedLayoutParams {
  const group = {
    ...STEPPED_LAYOUT_DEFAULTS.groups[0],
    bottomHeight: 3,
  };
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    baseHoleStructure: "magnetic-base-hole",
    groups: [group],
    activeGroupId: group.id,
    slots: [{
      id: "slot-1",
      groupId: group.id,
      x: 50,
      y: 50,
      rotation: 0,
      ...slot,
    }],
  };
}

describe("stepped base hole", () => {
  it("按非圆形短边匹配分组磁吸孔规格", () => {
    expect(getSteppedGroupResolvedBaseHoleSize(
      createParams({ shape: "ellipse", width: 75, height: 35 }),
      STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    )).toBe("25");
    expect(getSteppedGroupResolvedBaseHoleSize(
      createParams({ shape: "ellipse", width: 75, height: 42 }),
      STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    )).toBe("40");
  });

  it("只提高包含槽位的分组高度", () => {
    const params = createParams({ shape: "circle", width: 25, height: 25 });
    const emptyGroup = {
      ...params.groups[0],
      id: "empty-group",
      bottomHeight: 3,
    };
    const normalized = applySteppedBaseHoleDerivedFields({
      ...params,
      groups: [...params.groups, emptyGroup],
    });

    expect(normalized.groups[0].bottomHeight).toBe(5.4);
    expect(normalized.groups[1].bottomHeight).toBe(3);
  });
});
