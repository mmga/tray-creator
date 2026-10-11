import { act, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import type { AnyDraftListItem } from "@/lib/local-drafts";
import type { DraftManagerDialogProps } from "@/components/DraftManagerDialog";

const { getDraftListMock, openDialogMock, draftDialogState } = vi.hoisted(() => ({
  getDraftListMock: vi.fn((): AnyDraftListItem[] => []),
  openDialogMock: vi.fn(),
  draftDialogState: { open: false },
}));

vi.mock("@/hooks/useModeDrafts", () => ({
  useModeDrafts: () => ({
    currentDraftId: null,
    isDialogOpen: draftDialogState.open,
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

vi.mock("@/components/DraftManagerDialog", () => ({
  DraftManagerDialog: (props: DraftManagerDialogProps<AnyDraftListItem>) =>
    <>{props.drafts.map(item => <div key={item.id}>{props.renderSummary(item)}</div>)}</>,
}));

import { useWorkspaceDraftSupport } from "@/workspaces/shared";

describe("useWorkspaceDraftSupport", () => {
  beforeEach(() => {
    getDraftListMock.mockClear();
    openDialogMock.mockClear();
    draftDialogState.open = false;
    getDraftListMock.mockReturnValue([]);
  });

  it.each([1, 0])("直边草稿槽位数 %s 时区分失败与合法空布局", async slotCount => {
    draftDialogState.open = true;
    getDraftListMock.mockReturnValue([{
      id: "polygon", mode: "custom", title: "直边", createdAt: "2026-10-11", updatedAt: "2026-10-11",
      kind: "tray", slotCount, trayWidth: 0, trayDepth: 0,
      summary: { mode: "custom", kind: "tray", footprintStyle: "polygonal", slotCount, trayWidth: 0, trayDepth: 0 },
    }]);
    const { result } = renderHook(() => useWorkspaceDraftSupport({
      mode: "custom", params: CUSTOM_LAYOUT_DEFAULTS, requestDraftLoad: vi.fn(),
    }));
    act(() => result.current.draftActions.onOpenDraftDialog());
    render(result.current.overlays);
    expect(await screen.findByText(slotCount ? "尺寸待修复" : "0×0mm")).toBeInTheDocument();
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
