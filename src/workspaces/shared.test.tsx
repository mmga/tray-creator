import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";

const { getDraftListMock, openDialogMock } = vi.hoisted(() => ({
  getDraftListMock: vi.fn(() => []),
  openDialogMock: vi.fn(),
}));

vi.mock("@/hooks/useModeDrafts", () => ({
  useModeDrafts: () => ({
    currentDraftId: null,
    isDialogOpen: false,
    draftNameInput: "网格草稿",
    hasUnsavedChanges: false,
    setDraftNameInput: vi.fn(),
    openDialog: openDialogMock,
    closeDialog: vi.fn(),
    clearDraftBinding: vi.fn(),
    getDraftList: getDraftListMock,
    saveCurrentDraft: vi.fn(),
    saveAsNewDraft: vi.fn(),
    prepareDraftLoad: vi.fn(),
    commitLoadedDraftBinding: vi.fn(),
    renameDraftItem: vi.fn(),
    deleteDraftItem: vi.fn(),
    exportDraftItem: vi.fn(),
  }),
}));

import { useWorkspaceDraftSupport } from "@/workspaces/shared";

describe("useWorkspaceDraftSupport", () => {
  beforeEach(() => {
    getDraftListMock.mockClear();
    openDialogMock.mockClear();
  });

  it("defers reading the draft index until the dialog is opened", () => {
    const { result } = renderHook(() =>
      useWorkspaceDraftSupport({
        mode: "grid",
        params: DEFAULT_TRAY_PARAMS,
        requestDraftLoad: vi.fn(),
      }),
    );

    expect(getDraftListMock).not.toHaveBeenCalled();

    act(() => {
      result.current.draftActions.onOpenDraftDialog();
    });

    expect(getDraftListMock).toHaveBeenCalledTimes(1);
    expect(openDialogMock).toHaveBeenCalledTimes(1);
  });
});
