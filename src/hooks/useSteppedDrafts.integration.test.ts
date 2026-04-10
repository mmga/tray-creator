import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const {
  listDraftsMock,
  getDraftMock,
  createDraftMock,
  updateDraftMock,
  renameDraftMock,
  deleteDraftMock,
  exportDraftMock,
  defaultDraftTitleMock,
  parseParamFileObjectMock,
  toastMock,
} = vi.hoisted(() => ({
  listDraftsMock: vi.fn(),
  getDraftMock: vi.fn(),
  createDraftMock: vi.fn(),
  updateDraftMock: vi.fn(),
  renameDraftMock: vi.fn(),
  deleteDraftMock: vi.fn(),
  exportDraftMock: vi.fn(),
  defaultDraftTitleMock: vi.fn(),
  parseParamFileObjectMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/lib/local-drafts", () => ({
  listDrafts: listDraftsMock,
  getDraft: getDraftMock,
  createDraft: createDraftMock,
  updateDraft: updateDraftMock,
  renameDraft: renameDraftMock,
  deleteDraft: deleteDraftMock,
  exportDraft: exportDraftMock,
  defaultDraftTitle: defaultDraftTitleMock,
}));

vi.mock("@/lib/param-io", () => ({
  parseParamFileObject: parseParamFileObjectMock,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { useSteppedDrafts } from "@/hooks/useSteppedDrafts";

describe("useSteppedDrafts", () => {
  beforeEach(() => {
    listDraftsMock.mockReset();
    getDraftMock.mockReset();
    createDraftMock.mockReset();
    updateDraftMock.mockReset();
    renameDraftMock.mockReset();
    deleteDraftMock.mockReset();
    exportDraftMock.mockReset();
    defaultDraftTitleMock.mockReset();
    parseParamFileObjectMock.mockReset();
    toastMock.mockReset();

    defaultDraftTitleMock.mockReturnValue("默认草稿");
    listDraftsMock.mockReturnValue([]);
  });

  it("opens the dialog when saving without a bound draft and lists drafts by mode", () => {
    const setParams = vi.fn();
    const { result } = renderHook(() =>
      useSteppedDrafts({
        params: STEPPED_LAYOUT_DEFAULTS,
        setParams,
      }),
    );

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.draftNameInput).toBe("默认草稿");

    act(() => {
      result.current.saveCurrentDraft();
    });

    expect(result.current.isDialogOpen).toBe(true);
    expect(updateDraftMock).not.toHaveBeenCalled();

    expect(result.current.getDraftList()).toEqual([]);
    expect(listDraftsMock).toHaveBeenCalledWith("stepped");
  });

  it("saves a new draft, binds it, and resets the input title", () => {
    const record = {
      item: {
        id: "draft-1",
        title: "我的草稿",
        updatedAt: 1,
        slotCount: 2,
        groupCount: 1,
        trayWidth: 200,
        trayDepth: 180,
      },
      paramFile: {
        version: 1,
        mode: "stepped" as const,
        params: STEPPED_LAYOUT_DEFAULTS,
      },
    };
    createDraftMock.mockReturnValue(record);

    const { result } = renderHook(() =>
      useSteppedDrafts({
        params: STEPPED_LAYOUT_DEFAULTS,
        setParams: vi.fn(),
      }),
    );

    act(() => {
      result.current.openDialog();
      result.current.setDraftNameInput("  我的草稿  ");
    });

    act(() => {
      result.current.saveAsNewDraft();
    });

    expect(createDraftMock).toHaveBeenCalledWith(
      "我的草稿",
      STEPPED_LAYOUT_DEFAULTS,
    );
    expect(result.current.currentDraftId).toBe("draft-1");
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.draftNameInput).toBe("默认草稿");
    expect(toastMock).toHaveBeenCalledWith("success", "草稿「我的草稿」已保存");
  });

  it("updates the bound draft and loads parsed stepped params", () => {
    const loadedParams: SteppedLayoutParams = {
      ...STEPPED_LAYOUT_DEFAULTS,
      trayWidth: 240,
    };
    createDraftMock.mockReturnValue({
      item: {
        id: "draft-1",
        title: "初始草稿",
        updatedAt: 1,
        slotCount: 0,
        groupCount: 1,
        trayWidth: 200,
        trayDepth: 180,
      },
      paramFile: {
        version: 1,
        mode: "stepped" as const,
        params: STEPPED_LAYOUT_DEFAULTS,
      },
    });
    getDraftMock
      .mockReturnValueOnce({
        item: {
          id: "draft-1",
          title: "初始草稿",
          updatedAt: 1,
          slotCount: 0,
          groupCount: 1,
          trayWidth: 200,
          trayDepth: 180,
        },
        paramFile: {
          version: 1,
          mode: "stepped" as const,
          params: STEPPED_LAYOUT_DEFAULTS,
        },
      })
      .mockReturnValueOnce({
        item: {
          id: "draft-2",
          title: "载入草稿",
          updatedAt: 2,
          slotCount: 1,
          groupCount: 1,
          trayWidth: 240,
          trayDepth: 200,
        },
        paramFile: {
          version: 1,
          mode: "stepped" as const,
          params: loadedParams,
        },
      });
    parseParamFileObjectMock.mockReturnValue(loadedParams);

    const setParams = vi.fn();
    const onAfterLoad = vi.fn();
    const { result } = renderHook(() =>
      useSteppedDrafts({
        params: STEPPED_LAYOUT_DEFAULTS,
        setParams,
        onAfterLoad,
      }),
    );

    act(() => {
      result.current.saveAsNewDraft("初始草稿");
    });

    act(() => {
      result.current.saveCurrentDraft();
    });

    expect(updateDraftMock).toHaveBeenCalledWith(
      "draft-1",
      "初始草稿",
      STEPPED_LAYOUT_DEFAULTS,
    );
    expect(toastMock).toHaveBeenCalledWith("success", "草稿「初始草稿」已更新");

    act(() => {
      result.current.openDialog();
      result.current.loadDraft("draft-2");
    });

    expect(parseParamFileObjectMock).toHaveBeenCalledWith(
      {
        version: 1,
        mode: "stepped",
        params: loadedParams,
      },
      "stepped",
    );
    expect(setParams).toHaveBeenCalledWith(loadedParams);
    expect(onAfterLoad).toHaveBeenCalledTimes(1);
    expect(result.current.currentDraftId).toBe("draft-2");
    expect(result.current.isDialogOpen).toBe(false);
    expect(toastMock).toHaveBeenCalledWith("success", "已加载草稿「载入草稿」");
  });

  it("routes rename, delete, export, and load failures through toast messages", () => {
    createDraftMock.mockReturnValue({
      item: {
        id: "draft-1",
        title: "当前草稿",
        updatedAt: 1,
        slotCount: 0,
        groupCount: 1,
        trayWidth: 200,
        trayDepth: 180,
      },
      paramFile: {
        version: 1,
        mode: "stepped" as const,
        params: STEPPED_LAYOUT_DEFAULTS,
      },
    });
    renameDraftMock.mockReturnValue({
      item: {
        id: "draft-1",
        title: "新名字",
        updatedAt: 1,
        slotCount: 0,
        groupCount: 1,
        trayWidth: 200,
        trayDepth: 180,
      },
      paramFile: {
        version: 1,
        mode: "stepped" as const,
        params: STEPPED_LAYOUT_DEFAULTS,
      },
    });
    getDraftMock
      .mockReturnValueOnce({
        item: {
          id: "draft-1",
          title: "当前草稿",
          updatedAt: 1,
          slotCount: 0,
          groupCount: 1,
          trayWidth: 200,
          trayDepth: 180,
        },
        paramFile: {
          version: 1,
          mode: "stepped" as const,
          params: STEPPED_LAYOUT_DEFAULTS,
        },
      })
      .mockReturnValueOnce(null);
    deleteDraftMock.mockImplementation(() => undefined);
    exportDraftMock.mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useSteppedDrafts({
        params: STEPPED_LAYOUT_DEFAULTS,
        setParams: vi.fn(),
      }),
    );

    act(() => {
      result.current.saveAsNewDraft("当前草稿");
    });
    expect(result.current.currentDraftId).toBe("draft-1");

    act(() => {
      result.current.renameDraftItem("draft-1", "新名字");
      result.current.deleteDraftItem("draft-1");
      result.current.exportDraftItem("draft-1");
    });

    expect(renameDraftMock).toHaveBeenCalledWith("draft-1", "新名字");
    expect(deleteDraftMock).toHaveBeenCalledWith("draft-1");
    expect(exportDraftMock).toHaveBeenCalledWith("draft-1");
    expect(result.current.currentDraftId).toBeNull();
    expect(toastMock).toHaveBeenCalledWith("success", "已重命名为「新名字」");
    expect(toastMock).toHaveBeenCalledWith("success", "草稿「当前草稿」已删除");
    expect(toastMock).toHaveBeenCalledWith("success", "草稿已导出为 JSON 文件");

    renameDraftMock.mockImplementationOnce(() => {
      throw new Error("rename failed");
    });
    deleteDraftMock.mockImplementationOnce(() => {
      throw new Error("delete failed");
    });
    exportDraftMock.mockImplementationOnce(() => {
      throw new Error("export failed");
    });
    getDraftMock.mockReturnValueOnce(null);

    act(() => {
      result.current.renameDraftItem("draft-2", "失败");
      result.current.deleteDraftItem("draft-2");
      result.current.exportDraftItem("draft-2");
      result.current.loadDraft("missing");
    });

    expect(toastMock).toHaveBeenCalledWith("error", "重命名失败：rename failed");
    expect(toastMock).toHaveBeenCalledWith("error", "删除失败：delete failed");
    expect(toastMock).toHaveBeenCalledWith("error", "导出失败：export failed");
    expect(toastMock).toHaveBeenCalledWith("error", "草稿不存在或已损坏，无法加载");
  });
});
