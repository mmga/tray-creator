import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
import type { UseSteppedLayoutReturn } from "@/hooks/useSteppedLayout";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { useSteppedViewportWorkspace } from "@/viewports/stepped/useSteppedViewportWorkspace";

describe("useSteppedViewportWorkspace", () => {
  it("普通离开时取消连续编辑并清除瞬态交互", () => {
    const cancelContinuousEdit = vi.fn();
    const resetInteractionState = vi.fn();
    const model = {
      params: STEPPED_LAYOUT_DEFAULTS,
      persistedParams: STEPPED_LAYOUT_DEFAULTS,
      cancelContinuousEdit,
    } as unknown as UseSteppedLayoutReturn;
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
