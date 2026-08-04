"use client";

import { useCallback, useMemo, useState } from "react";
import { buildSteppedOutlinePreview } from "@/lib/stepped-outline-preview";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import type { ConstructedSteppedContouredFootprints } from "@/lib/stepped-contoured-footprint";
import type {
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";

interface UseSteppedOutlinePreviewResult {
  outlinePreview: GroupOutlinePreview[] | null;
  pauseOutlinePreview: () => void;
  resumeOutlinePreview: () => void;
}

export function useSteppedOutlinePreview(
  params: SteppedLayoutParams,
  contouredState: ContouredFootprintState<ConstructedSteppedContouredFootprints>,
  sessionEpoch = 0,
): UseSteppedOutlinePreviewResult {
  const [isOutlinePreviewPaused, setIsOutlinePreviewPaused] = useState(false);
  const [frozenOutlinePreview, setFrozenOutlinePreview] =
    useState<GroupOutlinePreview[] | null>(null);
  const liveOutlinePreview = useMemo(
    () => {
      void sessionEpoch;
      if (isOutlinePreviewPaused) return frozenOutlinePreview;
      return buildSteppedOutlinePreview(params, contouredState);
    },
    // sessionEpoch 明确使 session 替换失效，即使导入内容与当前内容完全相同。
    [
      contouredState,
      frozenOutlinePreview,
      isOutlinePreviewPaused,
      params,
      sessionEpoch,
    ],
  );

  const pauseOutlinePreview = useCallback(() => {
    setFrozenOutlinePreview(liveOutlinePreview);
    setIsOutlinePreviewPaused(true);
  }, [liveOutlinePreview]);

  const resumeOutlinePreview = useCallback(() => {
    setIsOutlinePreviewPaused(false);
  }, []);

  return {
    outlinePreview: liveOutlinePreview,
    pauseOutlinePreview,
    resumeOutlinePreview,
  };
}
