import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useModeInteractionState } from "@/hooks/useModeInteractionState";

describe("useModeInteractionState", () => {
  it("tracks selected slots, preview group, and resets both values", () => {
    const { result } = renderHook(() => useModeInteractionState());

    expect(result.current.selectedSlotIds).toEqual([]);
    expect(result.current.previewGroupId).toBeNull();

    act(() => {
      result.current.setSelectedSlotIds(["slot-1", "slot-2"]);
      result.current.setPreviewGroupId("group-1");
    });

    expect(result.current.selectedSlotIds).toEqual(["slot-1", "slot-2"]);
    expect(result.current.previewGroupId).toBe("group-1");

    act(() => {
      result.current.resetInteractionState();
    });

    expect(result.current.selectedSlotIds).toEqual([]);
    expect(result.current.previewGroupId).toBeNull();
  });

  it("allows repeated resets without changing the empty state", () => {
    const { result } = renderHook(() => useModeInteractionState());

    act(() => {
      result.current.resetInteractionState();
      result.current.resetInteractionState();
    });

    expect(result.current.selectedSlotIds).toEqual([]);
    expect(result.current.previewGroupId).toBeNull();
  });
});
