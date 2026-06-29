import { useRef, useCallback } from "react";

/**
 * 请求序列号竞态保护原语。
 *
 * 提供"自增序列号 + 版本比对"的最小共享逻辑，供 usePreviewLifecycle
 * 和 useSteppedOutlinePreview 复用。两者各自的成功路径/错误处理/
 * startTransition 不同，只共享这个序列号原语。
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
