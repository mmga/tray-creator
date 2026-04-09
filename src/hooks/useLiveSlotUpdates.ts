"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CanvasSlotUpdate } from "@/lib/canvas-types";

interface UseLiveSlotUpdatesOptions {
  applyLiveUpdates: (updates: CanvasSlotUpdate[]) => void;
}

export function useLiveSlotUpdates({
  applyLiveUpdates,
}: UseLiveSlotUpdatesOptions) {
  const applyLiveUpdatesRef = useRef(applyLiveUpdates);
  const liveUpdateFrameRef = useRef<number | null>(null);
  const pendingLiveUpdatesRef = useRef<CanvasSlotUpdate[] | null>(null);

  useEffect(() => {
    applyLiveUpdatesRef.current = applyLiveUpdates;
  }, [applyLiveUpdates]);

  const flushScheduledLiveUpdates = useCallback(() => {
    if (liveUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(liveUpdateFrameRef.current);
      liveUpdateFrameRef.current = null;
    }

    const pendingUpdates = pendingLiveUpdatesRef.current;
    pendingLiveUpdatesRef.current = null;
    if (!pendingUpdates || pendingUpdates.length === 0) {
      return;
    }

    applyLiveUpdatesRef.current(pendingUpdates);
  }, []);

  const scheduleLiveUpdates = useCallback((updates: CanvasSlotUpdate[]) => {
    pendingLiveUpdatesRef.current = updates;
    if (liveUpdateFrameRef.current !== null) {
      return;
    }

    liveUpdateFrameRef.current = window.requestAnimationFrame(() => {
      liveUpdateFrameRef.current = null;
      const pendingUpdates = pendingLiveUpdatesRef.current;
      pendingLiveUpdatesRef.current = null;
      if (!pendingUpdates || pendingUpdates.length === 0) {
        return;
      }

      applyLiveUpdatesRef.current(pendingUpdates);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (liveUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(liveUpdateFrameRef.current);
      }
    };
  }, []);

  return {
    flushScheduledLiveUpdates,
    scheduleLiveUpdates,
  };
}
