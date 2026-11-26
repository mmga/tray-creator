"use client";

import { useRef, useCallback } from "react";

const MAX_HISTORY = 50;

/**
 * 维护撤销与重做的状态快照。
 * 每次 pushState 都代表一个已经明确划分的用户编辑意图。
 */
export function useUndoHistory<T>() {
  const historyRef = useRef<T[]>([]);
  const redoRef = useRef<T[]>([]);
  const clearRedo = useCallback(() => {
    redoRef.current = [];
  }, []);

  /** 将当前状态压入历史栈（在变更前调用） */
  const pushState = useCallback((state: T) => {
    historyRef.current = [
      ...historyRef.current.slice(-(MAX_HISTORY - 1)),
      state,
    ];
    clearRedo();
  }, [clearRedo]);

  /** 翻回上一个状态，传入当前状态时可重做。 */
  const popState = useCallback((current?: T): T | undefined => {
    if (historyRef.current.length === 0) return undefined;
    if (current !== undefined) redoRef.current.push(current);
    return historyRef.current.pop();
  }, []);

  const redoState = useCallback((current: T): T | undefined => {
    if (redoRef.current.length === 0) return undefined;
    historyRef.current.push(current);
    return redoRef.current.pop();
  }, []);

  const canUndo = useCallback(() => historyRef.current.length > 0, []);
  const canRedo = useCallback(() => redoRef.current.length > 0, []);
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    clearRedo();
  }, [clearRedo]);

  return { pushState, popState, redoState, canUndo, canRedo, clearHistory, clearRedo };
}
