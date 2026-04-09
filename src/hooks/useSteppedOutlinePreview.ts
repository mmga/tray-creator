"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { recordPerfSample } from "@/lib/perf";
import { buildSteppedOutlinePreview } from "@/lib/stepped-outline-preview";
import type { SteppedOutlinePreviewPort } from "@/lib/model-ports";
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
  const outlinePreviewRequestSeqRef = useRef(0);

  const pauseOutlinePreview = useCallback(() => {
    setFrozenOutlinePreviewParams(params);
    setIsOutlinePreviewPaused(true);
  }, [params]);

  const resumeOutlinePreview = useCallback(() => {
    setIsOutlinePreviewPaused(false);
    setFrozenOutlinePreviewParams(null);
  }, []);

  useEffect(() => {
    const requestSeq = outlinePreviewRequestSeqRef.current + 1;
    outlinePreviewRequestSeqRef.current = requestSeq;
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
      if (isCancelled || outlinePreviewRequestSeqRef.current !== requestSeq) {
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
        if (isCancelled || outlinePreviewRequestSeqRef.current !== requestSeq) {
          return;
        }

        console.error("轮廓预览生成失败:", err);
      }
    };

    void runOutlinePreview();

    return () => {
      isCancelled = true;
    };
  }, [deferredOutlineParams, previewPort]);

  return {
    outlinePreview,
    pauseOutlinePreview,
    resumeOutlinePreview,
  };
}
