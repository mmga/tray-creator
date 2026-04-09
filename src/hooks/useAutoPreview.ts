"use client";

import { useEffect, useRef } from "react";

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
  // Keep a stable ref so the effect does not depend on the callback identity.
  // Callers typically pass inline arrow functions which change on every render.
  const onGenerateRef = useRef(onGenerate);
  onGenerateRef.current = onGenerate;

  useEffect(() => {
    if (!enabled || isGenerating || isBlocked) {
      return;
    }

    const handler = window.setTimeout(() => {
      onGenerateRef.current();
    }, delayMs);

    return () => window.clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs, enabled, isBlocked, isGenerating, trigger]);
}
