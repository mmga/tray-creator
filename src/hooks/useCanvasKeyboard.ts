"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { FreeSlot } from "@/types/custom-tray";

interface UseCanvasKeyboardOptions {
  enabled?: boolean;
  selectedIdsRef: React.RefObject<Set<string>>;
  slotsRef: React.RefObject<FreeSlot[]>;
  onUpdateSlot: (id: string, x: number, y: number) => void;
  onRemoveSlot: (id: string) => void;
  onDuplicateSlots?: (ids: string[]) => string[] | void;
  onUndo?: () => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setIsRotating: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSpacePressed: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHints: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * 画布键盘事件 hook
 *
 * 处理：Delete/Backspace 删除、Ctrl+Z 撤销、方向键微调、
 * Space 平移、Esc 取消、? 快捷键提示
 */
export function useCanvasKeyboard({
  enabled = true,
  selectedIdsRef,
  slotsRef,
  onUpdateSlot,
  onRemoveSlot,
  onDuplicateSlots,
  onUndo,
  setSelectedIds,
  setIsRotating,
  setIsSpacePressed,
  setIsPanning,
  setShowHints,
}: UseCanvasKeyboardOptions) {
  const clipboardRef = useRef<string[]>([]);

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const tag = (event.target as HTMLElement)?.tagName;
    const isEditable =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      (event.target as HTMLElement)?.isContentEditable;
    if (isEditable) {
      return;
    }

    if (event.code === "Space" && !event.repeat) {
      setIsSpacePressed(true);
    }

    const arrowCodes = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (selectedIdsRef.current.size > 0 && arrowCodes.includes(event.code)) {
      event.preventDefault();
      let dx = 0;
      let dy = 0;
      const step = 0.2;
      if (event.code === "ArrowLeft") dx = -step;
      if (event.code === "ArrowRight") dx = step;
      if (event.code === "ArrowUp") dy = step;
      if (event.code === "ArrowDown") dy = -step;

      selectedIdsRef.current.forEach((id) => {
        const slot = slotsRef.current.find((candidate) => candidate.id === id);
        if (slot) {
          onUpdateSlot(id, slot.x + dx, slot.y + dy);
        }
      });
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "z" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      onUndo?.();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "c") {
      if (selectedIdsRef.current.size > 0) {
        clipboardRef.current = Array.from(selectedIdsRef.current);
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "v") {
      if (clipboardRef.current.length > 0 && onDuplicateSlots) {
        const newIds = onDuplicateSlots(clipboardRef.current);
        if (newIds) {
          setSelectedIds(new Set(newIds));
        }
      }
      return;
    }

    if (
      selectedIdsRef.current.size > 0 &&
      (event.code === "Delete" || event.code === "Backspace")
    ) {
      event.preventDefault();
      selectedIdsRef.current.forEach((id) => onRemoveSlot(id));
      setSelectedIds(new Set());
    }

    if (event.code === "Escape") {
      event.preventDefault();
      setSelectedIds(new Set());
      setIsRotating(false);
    }

    if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
      event.preventDefault();
      setShowHints((prev: boolean) => !prev);
    }
  });

  const handleKeyUp = useEffectEvent((event: KeyboardEvent) => {
    if (event.code === "Space") {
      setIsSpacePressed(false);
      setIsPanning(false);
    }
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyDown(event);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      handleKeyUp(event);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled]);
}
