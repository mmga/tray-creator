import { describe, expect, it } from "vitest";
import { applySteppedEditIntent } from "@/lib/stepped-edit-intent";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";

const idFactory = { createId: () => "created-id" };

describe("applySteppedEditIntent", () => {
  it("把新增槽位及目标分组封装为一个编辑意图", () => {
    const params = {
      ...STEPPED_LAYOUT_DEFAULTS,
      groups: [
        STEPPED_LAYOUT_DEFAULTS.groups[0],
        { ...STEPPED_LAYOUT_DEFAULTS.groups[0], id: "group-2" },
      ],
    };

    const result = applySteppedEditIntent(params, {
      type: "slot.add",
      width: 25,
      targetGroupId: "group-2",
    }, idFactory);

    expect(result.createdIds).toEqual(["created-id"]);
    expect(result.params.slots.at(-1)).toMatchObject({
      id: "created-id",
      groupId: "group-2",
    });
  });

  it("用一次 patch 表达需要原子提交的拆分装配设置", () => {
    const result = applySteppedEditIntent(STEPPED_LAYOUT_DEFAULTS, {
      type: "params.patch",
      patch: {
        enableSplitRecess: true,
        splitGrooveType: "inset",
      },
    }, idFactory);

    expect(result.params).toMatchObject({
      enableSplitRecess: true,
      splitGrooveType: "inset",
    });
    expect(result.createdIds).toEqual([]);
  });
});
