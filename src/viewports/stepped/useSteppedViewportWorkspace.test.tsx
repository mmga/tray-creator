import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { SteppedViewportModel } from "@/hooks/useSteppedLayout";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { useSteppedViewportWorkspace } from "@/viewports/stepped/useSteppedViewportWorkspace";

describe("useSteppedViewportWorkspace", () => {
  it("普通离开时取消连续编辑并清除瞬态交互", () => {
    const cancelContinuousEdit = vi.fn();
    const resetInteractionState = vi.fn();
    const model: SteppedViewportModel = {
      params: STEPPED_LAYOUT_DEFAULTS,
      persistedParams: STEPPED_LAYOUT_DEFAULTS,
      setContouredWorkingPreviewEnabled: vi.fn(),
      cancelContinuousEdit,
      outlinePreview: null,
      workingContouredFootprintState: { status: "inactive" },
      contouredFootprintState: { status: "inactive" },
      updateSlotPosition: vi.fn(),
      removeSlot: vi.fn(),
      removeSlots: vi.fn(),
      updateSlotRotation: vi.fn(),
      updateMultipleSlots: vi.fn(),
      updateMultipleSlotsLive: vi.fn(),
      insertSlots: vi.fn(),
      duplicateSlots: vi.fn(() => []),
      undo: vi.fn(),
      beginContinuousEdit: vi.fn(() => true),
      commitContinuousEdit: vi.fn(),
      pauseOutlinePreview: vi.fn(),
      resumeOutlinePreview: vi.fn(),
      threeGeometry: null,
      isPreviewStale: false,
      isGenerating: false,
      handleGenerate: vi.fn(),
    };
    const interactionState = {
      selectedSlotIds: [],
      previewGroupId: null,
      activeSteppedGroupId: null,
      setSelectedSlotIds: vi.fn(),
      setPreviewGroupId: vi.fn(),
      setActiveSteppedGroupId: vi.fn(),
      resetInteractionState,
    } satisfies ModeInteractionState;

    const { result } = renderHook(() =>
      useSteppedViewportWorkspace({ model, interactionState }),
    );

    act(() => result.current.workspace.deactivate());

    expect(cancelContinuousEdit).toHaveBeenCalledTimes(1);
    expect(resetInteractionState).toHaveBeenCalledTimes(1);
  });
});
