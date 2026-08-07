import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";
import type {
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type { DraftParamsByMode } from "@/lib/draft-summary";
import type { DraftMode } from "@/lib/local-drafts";

const { downloadParamFileMock } = vi.hoisted(() => ({
  downloadParamFileMock: vi.fn(),
}));

vi.mock("@/lib/param-download", async () => {
  const actual = await vi.importActual<typeof import("@/lib/param-download")>(
    "@/lib/param-download",
  );
  return {
    ...actual,
    downloadParamFile: downloadParamFileMock,
  };
});

import {
  MAX_DRAFTS_PER_MODE,
  createDraft as createDraftFromSnapshot,
  defaultDraftTitle,
  deleteDraft,
  exportDraft,
  formatDraftTime,
  getDraft,
  listDrafts,
  renameDraft,
  updateDraft as updateDraftFromSnapshot,
} from "@/lib/local-drafts";

function createDraft<M extends DraftMode>(
  title: string,
  mode: M,
  params: DraftParamsByMode[M],
) {
  return createDraftFromSnapshot(
    title,
    captureModeParamSnapshot(mode, params),
  );
}

function updateDraft<M extends DraftMode>(
  mode: M,
  id: string,
  title: string,
  params: DraftParamsByMode[M],
) {
  return updateDraftFromSnapshot(
    id,
    title,
    captureModeParamSnapshot(mode, params),
  );
}

function createGridParams(overrides: Partial<TrayParams> = {}): TrayParams {
  return {
    ...DEFAULT_TRAY_PARAMS,
    ...overrides,
  };
}

function createCustomParams(
  overrides: Partial<CustomLayoutParams> = {},
): CustomLayoutParams {
  return {
    ...CUSTOM_LAYOUT_DEFAULTS,
    ...overrides,
    slots:
      overrides.slots?.map((slot) => ({ ...slot })) ?? [
        {
          id: "custom-slot-1",
          x: 40,
          y: 50,
          shape: "circle",
          width: 25,
          height: 25,
          rotation: 0,
        },
      ],
  };
}

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

function createSimpleSteppedParams(
  overrides: Partial<SimpleSteppedLayoutParams> = {},
): SimpleSteppedLayoutParams {
  const rows =
    overrides.rows?.map((row) => ({ ...row, slotIds: [...row.slotIds] })) ?? [
      {
        id: "row-1",
        name: "行 1",
        slotIds: ["simple-slot-1"],
      },
    ];
  return {
    ...SIMPLE_STEPPED_LAYOUT_DEFAULTS,
    ...overrides,
    rows,
    slots:
      overrides.slots?.map((slot) => ({ ...slot })) ?? [
        {
          id: "simple-slot-1",
          rowId: rows[0].id,
          shape: "circle",
          diameter: 25,
          x: 0,
          y: 0,
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

  it("creates, lists, and reads stepped drafts with derived summary fields", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid");
    const record = createDraft("   ", "stepped", createSteppedParams());

    expect(record.item.id).toBe("test-uuid");
    expect(record.item.title).toBe(defaultDraftTitle());
    expect(record.item.summary).toEqual({
      mode: "stepped",
      groupCount: 1,
      slotCount: 1,
      trayWidth: STEPPED_LAYOUT_DEFAULTS.trayWidth,
      trayDepth: STEPPED_LAYOUT_DEFAULTS.trayDepth,
    });

    expect(listDrafts("stepped")).toEqual([record.item]);
    expect(getDraft("stepped", record.item.id)).toEqual(record);
  });

  it("读取历史 CAD 草稿为统一阶梯，并在更新时迁移存储键", () => {
    const id = "cad-stepped";
    const params = createSteppedParams();
    const item = {
      id,
      mode: "stepped-cad",
      title: "CAD 阶梯",
      createdAt: "2026-04-08T10:20:00.000Z",
      updatedAt: "2026-04-08T10:20:00.000Z",
      groupCount: 1,
      slotCount: 1,
      trayWidth: 260,
      trayDepth: 260,
    };
    localStorage.setItem("tray-creator:drafts:index:v1", JSON.stringify([item]));
    localStorage.setItem(
      `tray-creator:drafts:stepped-cad:${id}:v1`,
      JSON.stringify({
        storageVersion: 1,
        item,
        paramFile: {
          version: 1,
          mode: "stepped-cad",
          params: { ...params, enableSplitAssembly: undefined },
        },
      }),
    );

    expect(listDrafts("stepped").map((draft) => draft.id)).toEqual([id]);
    expect(getDraft("stepped", id)?.paramFile.params.enableSplitAssembly).toBe(true);

    updateDraft("stepped", id, "已迁移", params);
    expect(localStorage.getItem(`tray-creator:drafts:stepped:${id}:v1`)).not.toBeNull();
    expect(localStorage.getItem(`tray-creator:drafts:stepped-cad:${id}:v1`)).toBeNull();
  });

  it("在阶梯草稿中发现历史简易阶梯并在更新时迁移存储键", () => {
    const id = "legacy-simple-stepped";
    const params = createSimpleSteppedParams({
      trayWidth: 180,
      trayDepth: 120,
    });
    const item = {
      id,
      mode: "simple-stepped",
      title: "历史简易阶梯",
      createdAt: "2026-04-08T10:20:00.000Z",
      updatedAt: "2026-04-08T10:20:00.000Z",
      rowCount: 1,
      slotCount: 1,
      trayWidth: 180,
      trayDepth: 120,
    };
    localStorage.setItem("tray-creator:drafts:index:v1", JSON.stringify([item]));
    localStorage.setItem(
      `tray-creator:drafts:simple-stepped:${id}:v1`,
      JSON.stringify({
        storageVersion: 1,
        item,
        paramFile: {
          version: 1,
          mode: "simple-stepped",
          params,
        },
      }),
    );

    expect(listDrafts("stepped").map((draft) => draft.id)).toEqual([id]);
    const converted = getDraft("stepped", id);
    expect(converted?.paramFile.mode).toBe("stepped");
    expect(converted?.paramFile.params).toMatchObject({
      footprintStyle: "rectangular",
      traySizingMode: "fixed",
      trayWidth: 180,
      trayDepth: 120,
    });
    expect(converted?.item.summary).toMatchObject({
      mode: "stepped",
      groupCount: 1,
      slotCount: 1,
    });

    updateDraft("stepped", id, "已迁移简易阶梯", converted!.paramFile.params);
    expect(localStorage.getItem(`tray-creator:drafts:stepped:${id}:v1`)).not.toBeNull();
    expect(localStorage.getItem(`tray-creator:drafts:simple-stepped:${id}:v1`)).toBeNull();
  });

  it("stores base converter drafts with source and target standards", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("converter-1");
    const record = createDraft(
      "转换底盘",
      "base-converter",
      BASE_CONVERTER_DEFAULTS,
    );
    expect(record.item.summary).toEqual({
      mode: "base-converter",
      sourceLabel: "20 × 20mm",
      targetLabel: "Ø25mm",
      trayWidth: 25,
      trayDepth: 25,
    });
    expect(listDrafts("base-converter")).toEqual([record.item]);
  });

  it("migrates legacy base converter drafts to reproducible geometry snapshots when read", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("converter-legacy");
    const record = createDraft(
      "旧转换底盘",
      "base-converter",
      BASE_CONVERTER_DEFAULTS,
    );
    const key = `tray-creator:drafts:base-converter:${record.item.id}:v1`;
    const stored = JSON.parse(localStorage.getItem(key)!);
    stored.paramFile.params = {
      sourceStandardId: "source-25x50",
      targetStandardId: "target-ellipse-35x60",
      floorThickness: 1.2,
      recessDepth: 2,
    };
    localStorage.setItem(key, JSON.stringify(stored));

    expect(getDraft("base-converter", record.item.id)?.paramFile.params)
      .toMatchObject({
        conversionClearance: 0.2,
        sideBevelWidth: 0,
        geometrySnapshot: {
          source: {
            standardId: "source-25x50",
            fitWidth: 25,
            fitDepth: 50,
          },
          target: {
            standardId: "target-ellipse-35x60",
            profileExponent: 2.05,
          },
        },
      });
  });

  it("stores custom conversion snapshots and derives draft summaries from them", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("converter-custom");
    const params = {
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: "custom-source-draft",
      targetStandardId: "custom-target-draft",
      geometrySnapshot: {
        source: {
          customId: "custom-source-draft",
          name: "草稿源规格",
          shape: "rectangle" as const,
          nominalWidth: 20,
          nominalDepth: 40,
          fitWidth: 19.8,
          fitDepth: 39.7,
          cornerRadius: 2,
        },
        target: {
          customId: "custom-target-draft",
          name: "草稿目标规格",
          shape: "ellipse" as const,
          width: 30,
          depth: 50,
          profileExponent: 3,
        },
      },
    };

    const record = createDraft(
      "自定义转换底盘",
      "base-converter",
      params,
    );

    expect(record.paramFile.params).toEqual(params);
    expect(record.item.summary).toEqual({
      mode: "base-converter",
      sourceLabel: "草稿源规格",
      targetLabel: "草稿目标规格",
      trayWidth: 30,
      trayDepth: 50,
    });
  });

  it("stores and lists drafts independently per mode", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("grid-1")
      .mockReturnValueOnce("custom-1")
      .mockReturnValueOnce("stepped-1");

    const grid = createDraft(
      "网格草稿",
      "grid",
      createGridParams({
        rows: 1,
        columns: 2,
        holeDiameter: 25,
        slotDiameter: 25.2,
        halfCircleSlots: true,
      }),
    );
    const custom = createDraft(
      "自定义草稿",
      "custom",
      createCustomParams({
        traySizingMode: "fixed",
        trayWidth: 120,
        trayDepth: 80,
      }),
    );
    const stepped = createDraft("阶梯草稿", "stepped", createSteppedParams());

    expect(listDrafts("grid").map((item) => item.id)).toEqual([grid.item.id]);
    expect(listDrafts("custom").map((item) => item.id)).toEqual([
      custom.item.id,
    ]);
    expect(listDrafts("stepped").map((item) => item.id)).toEqual([
      stepped.item.id,
    ]);

    expect(grid.item.summary).toEqual({
      mode: "grid",
      rows: 1,
      columns: 2,
      structureMode: "half-circle",
      baseSizeLabel: "25mm",
      trayWidth: 65.4,
      trayDepth: 35.2,
    });
    expect(custom.item.summary).toEqual({
      mode: "custom",
      slotCount: 1,
      trayWidth: 120,
      trayDepth: 80,
    });
  });

  it("updates, renames, deletes, and exports stored drafts", () => {
    const initial = createDraft(" 初始草稿 ", "stepped", createSteppedParams());
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
    const updated = updateDraft(
      "stepped",
      initial.item.id,
      "更新后草稿",
      nextParams,
    );

    expect(updated.item.title).toBe("更新后草稿");
    expect(updated.item.summary).toMatchObject({
      mode: "stepped",
      slotCount: 2,
      trayWidth: 180,
    });
    expect(updated.item.updatedAt).not.toBe(initial.item.updatedAt);

    const renamed = renameDraft("stepped", initial.item.id, "  Final Draft  ");
    expect(renamed.item.title).toBe("Final Draft");
    expect(getDraft("stepped", initial.item.id)?.item.title).toBe("Final Draft");

    exportDraft("stepped", initial.item.id);
    expect(downloadParamFileMock).toHaveBeenCalledWith(
      {
        mode: "stepped",
        params: nextParams,
      },
      "stepped-draft-final-draft.json",
    );

    deleteDraft("stepped", initial.item.id);
    expect(getDraft("stepped", initial.item.id)).toBeNull();
    expect(listDrafts("stepped")).toEqual([]);
  });

  it("sorts drafts by updated time and formats timestamps", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("draft-1")
      .mockReturnValueOnce("draft-2");

    createDraft("旧草稿", "stepped", createSteppedParams());
    vi.advanceTimersByTime(60_000);
    const newer = createDraft("新草稿", "stepped", createSteppedParams());

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
    expect(getDraft("stepped", "bad")).toBeNull();
  });

  it("keeps reading legacy stepped records through the generic API", () => {
    const legacyItem = {
      id: "legacy-stepped",
      mode: "stepped" as const,
      title: "旧阶梯草稿",
      createdAt: "2026-04-09T10:20:00.000Z",
      updatedAt: "2026-04-09T10:20:00.000Z",
      slotCount: 2,
      groupCount: 1,
      trayWidth: 180,
      trayDepth: 160,
    };
    localStorage.setItem(
      "tray-creator:drafts:index:v1",
      JSON.stringify([legacyItem]),
    );
    localStorage.setItem(
      "tray-creator:drafts:stepped:legacy-stepped:v1",
      JSON.stringify({
        storageVersion: 1,
        item: legacyItem,
        paramFile: {
          version: 1,
          mode: "stepped",
          params: createSteppedParams({
            trayWidth: 180,
            trayDepth: 160,
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
          }),
        },
      }),
    );

    expect(getDraft("stepped", "legacy-stepped")?.paramFile.mode).toBe(
      "stepped",
    );
    expect(listDrafts("stepped")[0]?.summary).toEqual({
      mode: "stepped",
      groupCount: 1,
      slotCount: 2,
      trayWidth: 180,
      trayDepth: 160,
    });
  });

  it("enforces draft limits per mode and rolls back create failures", () => {
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      const nextId = localStorage.length.toString();
      return `draft-${nextId}`;
    });

    for (let index = 0; index < MAX_DRAFTS_PER_MODE; index += 1) {
      createDraft(`草稿 ${index}`, "grid", createGridParams());
    }

    expect(() =>
      createDraft("超限草稿", "grid", createGridParams()),
    ).toThrow(`草稿数量已达上限（${MAX_DRAFTS_PER_MODE} 个）`);
    expect(() =>
      createDraft("custom still ok", "custom", createCustomParams()),
    ).not.toThrow();

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
      createDraft("失败草稿", "stepped", createSteppedParams()),
    ).toThrow("存储失败");
    expect(getDraft("stepped", "rollback-id")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("rolls draft records back when updating the index fails", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("persisted-id");
    const initial = createDraft("原始标题", "stepped", createSteppedParams());
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
        "stepped",
        initial.item.id,
        "不会成功",
        createSteppedParams({ trayWidth: 180 }),
      ),
    ).toThrow("存储失败");

    expect(getDraft("stepped", initial.item.id)?.item.title).toBe("原始标题");
    expect(
      (getDraft("stepped", initial.item.id)?.paramFile.params as SteppedLayoutParams)
        .trayWidth,
    ).toBe(STEPPED_LAYOUT_DEFAULTS.trayWidth);
  });

  it("uses base-plate-only as the grid summary structure mode when enabled", () => {
    const record = createDraft(
      "仅底板",
      "grid",
      createGridParams({
        rows: 1,
        columns: 2,
        holeDiameter: 40,
        slotDiameter: 40.4,
        halfCircleSlots: true,
        basePlateOnly: true,
      }),
    );

    expect(record.item.summary).toMatchObject({
      mode: "grid",
      structureMode: "base-plate-only",
      baseSizeLabel: "40mm",
    });
  });
});
