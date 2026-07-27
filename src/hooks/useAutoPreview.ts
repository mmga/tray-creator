"use client";

import { useEffect, useEffectEvent, useRef } from "react";

interface UseAutoPreviewOptions {
  enabled: boolean;
  isGenerating: boolean;
  isBlocked: boolean;
  onGenerate: () => void;
  delayMs?: number;
}

const NO_AUTO_PREVIEW_TRIGGER = Symbol("no-auto-preview-trigger");

export function useAutoPreview(
  trigger: unknown,
  {
    enabled,
    isGenerating,
    isBlocked,
    onGenerate,
    delayMs = 500,
  }: UseAutoPreviewOptions,
) {
  const lastGeneratedTriggerRef = useRef<unknown>(NO_AUTO_PREVIEW_TRIGGER);
  const handleGenerate = useEffectEvent(() => {
    onGenerate();
  });

  useEffect(() => {
    if (!enabled || isBlocked) {
      lastGeneratedTriggerRef.current = NO_AUTO_PREVIEW_TRIGGER;
      return;
    }
    if (
      isGenerating
      || Object.is(lastGeneratedTriggerRef.current, trigger)
    ) {
      return;
    }

    const handler = window.setTimeout(() => {
      lastGeneratedTriggerRef.current = trigger;
      handleGenerate();
    }, delayMs);

    return () => window.clearTimeout(handler);
  }, [delayMs, enabled, isBlocked, isGenerating, trigger]);
}
