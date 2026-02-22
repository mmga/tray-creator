"use client";

import { useRef, useCallback } from "react";

const MAX_HISTORY = 50;

/**
 * 通用撤销历史 Hook
 * 维护一个状态快照栈，支持 undo 操作
 */
export function useUndoHistory<T>() {
    const historyRef = useRef<T[]>([]);

    /** 将当前状态压入历史栈（在变更前调用） */
    const pushState = useCallback((state: T) => {
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
        return prev;
    }, []);

    const canUndo = useCallback(() => historyRef.current.length > 0, []);

    return { pushState, popState, canUndo };
}
