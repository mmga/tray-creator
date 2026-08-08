import { useRef, useCallback } from "react";

/**
 * 请求序列号竞态保护原语。
 *
 * 提供"自增序列号 + 版本比对"的最小共享逻辑，供异步预览和
 * Mode Editor 导入准备复用。调用方各自保留成功路径与错误处理，
 * 这里只共享 latest-wins 所有权原语。
 */
export function useRequestSequence() {
  const seqRef = useRef(0);

  /** 前进到下一序列号并返回它（在发起新请求时调用） */
  const nextSeq = useCallback(() => {
    seqRef.current += 1;
    return seqRef.current;
  }, []);

  /** 判断给定序列号是否已过期（有更新的请求进来） */
  const isStale = useCallback((seq: number) => {
    return seq !== seqRef.current;
  }, []);

  return { seqRef, nextSeq, isStale };
}
