import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { useCustomLayout } from "@/hooks/useCustomLayout";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { useCustomViewportWorkspace } from "@/viewports/custom/useCustomViewportWorkspace";

describe("useCustomViewportWorkspace", () => {
  it("普通离开时取消连续编辑并清除瞬态交互", () => {
    const cancelContinuousEdit = vi.fn();
    const resetInteractionState = vi.fn();
    const model = {
      params: CUSTOM_LAYOUT_DEFAULTS,
      cancelContinuousEdit,
    } as unknown as ReturnType<typeof useCustomLayout>;
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
      useCustomViewportWorkspace({ model, interactionState }),
    );

    act(() => result.current.deactivate());

    expect(cancelContinuousEdit).toHaveBeenCalledTimes(1);
    expect(resetInteractionState).toHaveBeenCalledTimes(1);
  });
});
