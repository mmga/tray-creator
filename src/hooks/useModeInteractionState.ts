"use client";

import { useCallback, useState } from "react";

export interface ModeInteractionState {
  selectedSlotIds: string[];
  previewGroupId: string | null;
  activeSteppedGroupId: string | null;
  setSelectedSlotIds: (ids: string[]) => void;
  setPreviewGroupId: (groupId: string | null) => void;
  setActiveSteppedGroupId: (groupId: string | null) => void;
  resetInteractionState: () => void;
}

export function useModeInteractionState(): ModeInteractionState {
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);
  const [activeSteppedGroupId, setActiveSteppedGroupId] = useState<string | null>(null);

  const resetInteractionState = useCallback(() => {
    setSelectedSlotIds([]);
    setPreviewGroupId(null);
    setActiveSteppedGroupId(null);
  }, []);

  return {
    selectedSlotIds,
    previewGroupId,
    activeSteppedGroupId,
    setSelectedSlotIds,
    setPreviewGroupId,
    setActiveSteppedGroupId,
    resetInteractionState,
  };
}
