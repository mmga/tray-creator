"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { recordPerfSample } from "@/lib/perf";
import { buildSteppedOutlinePreview } from "@/lib/stepped-outline-preview";
import type { SteppedOutlinePreviewPort } from "@/lib/model-ports";
import { useRequestSequence } from "@/hooks/useRequestSequence";
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
  previewPort: SteppedOutlinePreviewPort | null,
): UseSteppedOutlinePreviewResult {
  const [isOutlinePreviewPaused, setIsOutlinePreviewPaused] = useState(false);
  const [frozenOutlinePreviewParams, setFrozenOutlinePreviewParams] =
    useState<SteppedLayoutParams | null>(null);
  const deferredOutlineParams = useDeferredValue(
    isOutlinePreviewPaused
      ? (frozenOutlinePreviewParams ?? params)
      : params,
  );
  const [outlinePreview, setOutlinePreview] =
    useState<GroupOutlinePreview[] | null>(null);
  const { nextSeq, isStale } = useRequestSequence();

  const pauseOutlinePreview = useCallback(() => {
    setFrozenOutlinePreviewParams(params);
    setIsOutlinePreviewPaused(true);
  }, [params]);

  const resumeOutlinePreview = useCallback(() => {
    setIsOutlinePreviewPaused(false);
    setFrozenOutlinePreviewParams(null);
  }, []);

  useEffect(() => {
    const seq = nextSeq();
    if (
      deferredOutlineParams.slots.length === 0 ||
      deferredOutlineParams.groups.length === 0
    ) {
      startTransition(() => {
        setOutlinePreview(null);
      });
      return;
    }

    let isCancelled = false;
    const applyOutlinePreview = (nextPreview: GroupOutlinePreview[] | null) => {
      if (isCancelled || isStale(seq)) {
        return;
      }

      startTransition(() => {
        setOutlinePreview(nextPreview);
      });
    };

    const runOutlinePreview = async () => {
      try {
        if (previewPort) {
          const result =
            await previewPort.generateSteppedOutlinePreview(
              deferredOutlineParams,
            );
          if (result.durationMs >= 0) {
            recordPerfSample("stepped.outline", result.durationMs);
          }
          applyOutlinePreview(result.outlinePreview);
          return;
        }

        const startedAt =
          typeof performance !== "undefined" ? performance.now() : 0;
        const nextPreview = buildSteppedOutlinePreview(deferredOutlineParams);
        if (typeof performance !== "undefined") {
          recordPerfSample("stepped.outline", performance.now() - startedAt);
        }
        applyOutlinePreview(nextPreview);
      } catch (err) {
        if (isCancelled || isStale(seq)) {
          return;
        }

        console.error("轮廓预览生成失败:", err);
      }
    };

    void runOutlinePreview();

    return () => {
      isCancelled = true;
    };
  }, [deferredOutlineParams, previewPort, isStale, nextSeq]);

  return {
    outlinePreview,
    pauseOutlinePreview,
    resumeOutlinePreview,
  };
}
