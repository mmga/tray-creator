import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import {
  createDraft,
  deleteDraft,
  getDraft,
  listDrafts,
  updateDraft,
} from "@/lib/local-drafts";
import {
  createDefaultStorageSteppedParams,
  withStorageSteppedHeightSpec,
} from "@/lib/storage-stepped-config";
import {
  buildDraftSummary,
} from "@/lib/draft-summary";

const { downloadParamFileMock } = vi.hoisted(() => ({
  downloadParamFileMock: vi.fn(),
}));

vi.mock("@/lib/param-download", async () => {
  const actual = await vi.importActual<typeof import("@/lib/param-download")>(
    "@/lib/param-download",
  );
  return { ...actual, downloadParamFile: downloadParamFileMock };
});

function snapshot(params = createDefaultStorageSteppedParams()) {
  return captureModeParamSnapshot("storage-stepped", params);
}

describe("Storage Stepped 草稿", () => {
  beforeEach(() => {
    localStorage.clear();
    downloadParamFileMock.mockClear();
    let counter = 0;
    vi.spyOn(crypto, "randomUUID").mockImplementation(
      () => `uuid-${++counter}` as `${string}-${string}-${string}-${string}-${string}`,
    );
  });

  it("保存后可恢复同一套参数与摘要", () => {
    const record = createDraft("收纳草稿", snapshot());
    expect(record.item.mode).toBe("storage-stepped");
    expect(record.item.summary).toMatchObject({
      mode: "storage-stepped",
      heightSpecId: "standard",
      interfaceVersion: 1,
      slotCount: 0,
      slotCounts: [0, 0, 0],
    });
    expect(record.item.trayWidth).toBeCloseTo(235.4, 6);

    const list = listDrafts("storage-stepped");
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("收纳草稿");

    const loaded = getDraft("storage-stepped", record.item.id);
    expect(loaded?.paramFile.params).toEqual(createDefaultStorageSteppedParams());
  });

  it("刷新后从 localStorage 读取并更新高度", () => {
    const record = createDraft("收纳草稿", snapshot());
    const storage = withStorageSteppedHeightSpec(
      createDefaultStorageSteppedParams(),
      "storage",
    );
    updateDraft(record.item.id, "收纳草稿 2", snapshot(storage));

    const loaded = getDraft("storage-stepped", record.item.id);
    expect(loaded?.item.title).toBe("收纳草稿 2");
    expect(loaded?.paramFile.params.heightSpecId).toBe("storage");
    expect(loaded?.item.summary.heightSpecId).toBe("storage");
  });

  it("删除收纳草稿不影响其他模式", () => {
    const record = createDraft("收纳草稿", snapshot());
    deleteDraft("storage-stepped", record.item.id);
    expect(listDrafts("storage-stepped")).toHaveLength(0);
    expect(listDrafts("stepped")).toHaveLength(0);
    expect(getDraft("storage-stepped", record.item.id)).toBeNull();
  });

  it("摘要按阶输出槽数并保留接口版本", () => {
    const base = createDefaultStorageSteppedParams();
    const params = {
      ...base,
      trays: base.trays.map((tray) => ({
        ...tray,
        slots: tray.stepIndex === 0
          ? [{
              id: "a",
              x: 60,
              y: 37.7,
              shape: "circle" as const,
              width: 32,
              height: 32,
              rotation: 0,
            }]
          : [],
      })),
    };
    const summary = buildDraftSummary(
      captureModeParamSnapshot("storage-stepped", params),
    );
    expect(summary).toMatchObject({
      mode: "storage-stepped",
      slotCount: 1,
      slotCounts: [1, 0, 0],
      interfaceVersion: 1,
    });
  });
});
