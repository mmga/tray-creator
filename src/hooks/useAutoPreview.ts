"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    if (!enabled || isGenerating || isBlocked) {
      return;
    }

    const handler = window.setTimeout(() => {
      onGenerate();
    }, delayMs);

    return () => window.clearTimeout(handler);
  }, [delayMs, enabled, isBlocked, isGenerating, onGenerate, trigger]);
}
