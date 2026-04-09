"use client";

import { useEffect, useEffectEvent } from "react";

interface UseAutoPreviewOptions {
  enabled: boolean;
  isGenerating: boolean;
  isBlocked: boolean;
  onGenerate: () => void;
  delayMs?: number;
}

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
  const handleGenerate = useEffectEvent(() => {
    onGenerate();
  });

  useEffect(() => {
    if (!enabled || isGenerating || isBlocked) {
      return;
    }

    const handler = window.setTimeout(() => {
      handleGenerate();
    }, delayMs);

    return () => window.clearTimeout(handler);
  }, [delayMs, enabled, isBlocked, isGenerating, trigger]);
}
