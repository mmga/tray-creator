"use client";

import { useEffect, useRef, useCallback } from "react";
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
  // 使用 ref 保持回调引用稳定
  const onUpdateSlotRef = useRef(onUpdateSlot);
  onUpdateSlotRef.current = onUpdateSlot;
  const onUndoRef = useRef(onUndo);
  onUndoRef.current = onUndo;
  const onDuplicateSlotsRef = useRef(onDuplicateSlots);
  onDuplicateSlotsRef.current = onDuplicateSlots;

  // 内部剪贴板状态
  const clipboardRef = useRef<string[]>([]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 输入框/文本区域聚焦时，不拦截键盘事件，避免误操作
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;

      // Space: 平移模式
      if (e.code === "Space" && !e.repeat) {
        setIsSpacePressed(true);
      }

      // 方向键: 微调选中凹槽
      const arrowCodes = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (selectedIdsRef.current.size > 0 && arrowCodes.includes(e.code)) {
        e.preventDefault();
        let dx = 0,
          dy = 0;
        const step = 0.2;
        if (e.code === "ArrowLeft") dx = -step;
        if (e.code === "ArrowRight") dx = step;
        if (e.code === "ArrowUp") dy = step;
        if (e.code === "ArrowDown") dy = -step;

        selectedIdsRef.current.forEach((id) => {
          const slot = slotsRef.current.find((s) => s.id === id);
          if (slot) {
            onUpdateSlotRef.current(id, slot.x + dx, slot.y + dy);
          }
        });
      }

      // Ctrl+Z: 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndoRef.current?.();
        return;
      }

      // Ctrl+C: 复制
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (selectedIdsRef.current.size > 0) {
          clipboardRef.current = Array.from(selectedIdsRef.current);
        }
        return;
      }

      // Ctrl+V: 粘贴
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (clipboardRef.current.length > 0 && onDuplicateSlotsRef.current) {
          const newIds = onDuplicateSlotsRef.current(clipboardRef.current);
          if (newIds) setSelectedIds(new Set(newIds));
        }
        return;
      }

      // Delete/Backspace: 删除选中
      if (
        selectedIdsRef.current.size > 0 &&
        (e.code === "Delete" || e.code === "Backspace")
      ) {
        e.preventDefault();
        selectedIdsRef.current.forEach((id) => onRemoveSlot(id));
        setSelectedIds(new Set());
      }

      // Escape: 取消选择
      if (e.code === "Escape") {
        e.preventDefault();
        setSelectedIds(new Set());
        setIsRotating(false);
      }

      // ?: 快捷键提示
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowHints((prev: boolean) => !prev);
      }
    },
    [
      selectedIdsRef,
      slotsRef,
      onRemoveSlot,
      setSelectedIds,
      setIsRotating,
      setIsSpacePressed,
      setShowHints,
    ],
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    },
    [setIsSpacePressed, setIsPanning],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, handleKeyDown, handleKeyUp]);
}
