"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseActionPanelResizeOptions {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

export function useActionPanelResize({
  defaultWidth,
  minWidth,
  maxWidth,
}: UseActionPanelResizeOptions) {
  const [actionPanelWidth, setActionPanelWidth] = useState(defaultWidth);
  const [isResizingActionPanel, setIsResizingActionPanel] = useState(false);
  const resizeActionPanelRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);

  const stopActionPanelResize = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
    if (pendingWidthRef.current !== null) {
      setActionPanelWidth(pendingWidthRef.current);
      pendingWidthRef.current = null;
    }
    resizeActionPanelRef.current = null;
    setIsResizingActionPanel(false);
  }, []);

  const startActionPanelResize = useCallback(
    (startX: number) => {
      resizeActionPanelRef.current = {
        startX,
        startWidth: actionPanelWidth,
      };
      setIsResizingActionPanel(true);
    },
    [actionPanelWidth],
  );

  useEffect(() => {
    if (!isResizingActionPanel) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const state = resizeActionPanelRef.current;
      if (!state) {
        return;
      }

      const delta = event.clientX - state.startX;
      const nextWidth = Math.max(
        minWidth,
        Math.min(maxWidth, state.startWidth - delta),
      );
      pendingWidthRef.current = nextWidth;
      if (resizeFrameRef.current !== null) return;
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        const pendingWidth = pendingWidthRef.current;
        pendingWidthRef.current = null;
        if (pendingWidth !== null) setActionPanelWidth(pendingWidth);
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopActionPanelResize();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopActionPanelResize);
    window.addEventListener("pointercancel", stopActionPanelResize);
    window.addEventListener("blur", stopActionPanelResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopActionPanelResize);
      window.removeEventListener("pointercancel", stopActionPanelResize);
      window.removeEventListener("blur", stopActionPanelResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [isResizingActionPanel, maxWidth, minWidth, stopActionPanelResize]);

  return {
    actionPanelWidth,
    isResizingActionPanel,
    startActionPanelResize,
    stopActionPanelResize,
  };
}
