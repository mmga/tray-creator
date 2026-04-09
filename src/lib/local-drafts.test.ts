import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const { downloadParamFileMock } = vi.hoisted(() => ({
  downloadParamFileMock: vi.fn(),
}));

vi.mock("@/lib/param-io", async () => {
  const actual = await vi.importActual<typeof import("@/lib/param-io")>(
    "@/lib/param-io",
  );
  return {
    ...actual,
    downloadParamFile: downloadParamFileMock,
  };
});

import {
  MAX_DRAFTS_PER_MODE,
  createDraft,
  defaultDraftTitle,
  deleteDraft,
  exportDraft,
  formatDraftTime,
  getDraft,
  listDrafts,
  renameDraft,
  updateDraft,
} from "@/lib/local-drafts";

function createSteppedParams(
  overrides: Partial<SteppedLayoutParams> = {},
): SteppedLayoutParams {
  const groups =
    overrides.groups?.map((group) => ({ ...group })) ??
    STEPPED_LAYOUT_DEFAULTS.groups.map((group) => ({ ...group }));
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    ...overrides,
    groups,
    activeGroupId: overrides.activeGroupId ?? groups[0].id,
    slots:
      overrides.slots?.map((slot) => ({ ...slot })) ?? [
        {
          id: "slot-1",
          x: 30,
          y: 40,
          shape: "circle",
          width: 25,
          height: 25,
          rotation: 0,
          groupId: groups[0].id,
        },
      ],
  };
}

describe("local drafts", () => {
  beforeEach(() => {
    localStorage.clear();
    downloadParamFileMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T10:20:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates, lists, and reads drafts with derived summary fields", () => {
    const record = createDraft("   ", createSteppedParams());

    expect(record.item.id).toBe("test-uuid");
    expect(record.item.title).toBe(defaultDraftTitle());
    expect(record.item.slotCount).toBe(1);
    expect(record.item.groupCount).toBe(1);
    expect(record.item.trayWidth).toBe(STEPPED_LAYOUT_DEFAULTS.trayWidth);
    expect(record.item.trayDepth).toBe(STEPPED_LAYOUT_DEFAULTS.trayDepth);

    expect(listDrafts("stepped")).toEqual([record.item]);
    expect(getDraft(record.item.id)).toEqual(record);
  });

  it("updates, renames, deletes, and exports stored drafts", () => {
    const initial = createDraft(" 初始草稿 ", createSteppedParams());
    vi.advanceTimersByTime(60_000);

    const nextParams = createSteppedParams({
      trayWidth: 180,
      trayDepth: 170,
      slots: [
        {
          id: "slot-1",
          x: 30,
          y: 40,
          shape: "circle",
          width: 25,
          height: 25,
          rotation: 0,
          groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
        },
        {
          id: "slot-2",
          x: 70,
          y: 80,
          shape: "circle",
          width: 32,
          height: 32,
          rotation: 0,
          groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
        },
      ],
    });
    const updated = updateDraft(initial.item.id, "更新后草稿", nextParams);

    expect(updated.item.title).toBe("更新后草稿");
    expect(updated.item.slotCount).toBe(2);
    expect(updated.item.trayWidth).toBe(180);
    expect(updated.item.updatedAt).not.toBe(initial.item.updatedAt);

    const renamed = renameDraft(initial.item.id, "  Final Draft  ");
    expect(renamed.item.title).toBe("Final Draft");
    expect(getDraft(initial.item.id)?.item.title).toBe("Final Draft");

    exportDraft(initial.item.id);
    expect(downloadParamFileMock).toHaveBeenCalledWith(
      "stepped",
      nextParams,
      "stepped-draft-final-draft.json",
    );

    deleteDraft(initial.item.id);
    expect(getDraft(initial.item.id)).toBeNull();
    expect(listDrafts("stepped")).toEqual([]);
  });

  it("sorts drafts by updated time and formats timestamps", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("draft-1")
      .mockReturnValueOnce("draft-2");

    createDraft("旧草稿", createSteppedParams());
    vi.advanceTimersByTime(60_000);
    const newer = createDraft("新草稿", createSteppedParams());

    expect(listDrafts("stepped").map((item) => item.id)).toEqual([
      newer.item.id,
      "draft-1",
    ]);
    expect(formatDraftTime(newer.item.updatedAt)).toBe("2026-04-09 10:21");
    expect(formatDraftTime("not-a-date")).toBe("not-a-date");
  });

  it("recovers from corrupt storage payloads", () => {
    localStorage.setItem("tray-creator:drafts:index:v1", "{bad-json");
    expect(listDrafts("stepped")).toEqual([]);

    localStorage.setItem(
      "tray-creator:drafts:stepped:bad:v1",
      JSON.stringify({ storageVersion: 2 }),
    );
    expect(getDraft("bad")).toBeNull();
  });

  it("enforces limits and rolls back create failures", () => {
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      const nextId = localStorage.length.toString();
      return `draft-${nextId}`;
    });

    for (let index = 0; index < MAX_DRAFTS_PER_MODE; index += 1) {
      createDraft(`草稿 ${index}`, createSteppedParams());
    }

    expect(() =>
      createDraft("超限草稿", createSteppedParams()),
    ).toThrow(`草稿数量已达上限（${MAX_DRAFTS_PER_MODE} 个）`);

    localStorage.clear();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("rollback-id");
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === "tray-creator:drafts:index:v1") {
        throw new DOMException("Quota exceeded");
      }
      return originalSetItem.call(this, key, value);
    });

    expect(() =>
      createDraft("失败草稿", createSteppedParams()),
    ).toThrow("存储失败");
    expect(getDraft("rollback-id")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("rolls draft records back when updating the index fails", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("persisted-id");
    const initial = createDraft("原始标题", createSteppedParams());
    const originalSetItem = Storage.prototype.setItem;

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === "tray-creator:drafts:index:v1") {
        throw new DOMException("Quota exceeded");
      }
      return originalSetItem.call(this, key, value);
    });

    expect(() =>
      updateDraft(
        initial.item.id,
        "不会成功",
        createSteppedParams({ trayWidth: 180 }),
      ),
    ).toThrow("存储失败");

    expect(getDraft(initial.item.id)?.item.title).toBe("原始标题");
    expect(getDraft(initial.item.id)?.paramFile.params.trayWidth).toBe(
      STEPPED_LAYOUT_DEFAULTS.trayWidth,
    );
  });
});
