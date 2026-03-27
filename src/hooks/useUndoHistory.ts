"use client";

import { useRef, useCallback } from "react";

const MAX_HISTORY = 50;
/** 连续操作合并窗口 (ms)：在此时间内的连续 pushState 会合并为一条记录 */
const MERGE_WINDOW_MS = 500;

/**
 * 通用撤销历史 Hook
 * 维护一个状态快照栈，支持 undo 操作
 * 内置连续操作合并：短时间内连续的 pushState 只保留第一次快照
 */
export function useUndoHistory<T>() {
  const historyRef = useRef<T[]>([]);
  const lastPushTimeRef = useRef<number>(0);

  /** 将当前状态压入历史栈（在变更前调用） */
  const pushState = useCallback((state: T) => {
    const now = Date.now();
    const elapsed = now - lastPushTimeRef.current;

    // 如果距上次 push 时间很短，说明是连续操作（如拖拽/滑动），
    // 跳过入栈以避免大量重复快照
    if (elapsed < MERGE_WINDOW_MS && historyRef.current.length > 0) {
      lastPushTimeRef.current = now;
      return;
    }

    lastPushTimeRef.current = now;
    historyRef.current = [
      ...historyRef.current.slice(-(MAX_HISTORY - 1)),
      state,
    ];
  }, []);

  /** 弹出并返回上一个状态，若无历史则返回 undefined */
  const popState = useCallback((): T | undefined => {
    if (historyRef.current.length === 0) return undefined;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    // 重置合并窗口，避免 undo 后的操作被误合并
    lastPushTimeRef.current = 0;
    return prev;
  }, []);

  const canUndo = useCallback(() => historyRef.current.length > 0, []);

  return { pushState, popState, canUndo };
}
