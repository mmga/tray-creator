"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { usePreviewLifecycle } from "@/hooks/usePreviewLifecycle";

export interface PreviewLifecycleResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
}

/** 兼容尚未迁移到显式连续事务的非阶梯编辑模式。 */
export type HistoryMode = "save" | "live" | "skip";

interface ApplyChangeOptions {
  /** save = 离散操作（pushState 后变换）；live = 已由显式会话捕获历史；skip = 无需历史 */
  history?: HistoryMode;
}

export type EditTransactionOutcome =
  | { status: "committed"; revision: number }
  | { status: "previewing" }
  | { status: "unchanged" }
  | { status: "rejected"; code: "edit-already-active" | "edit-not-active" };

interface UseEditableParamsOptions<P, S, E> {
  initialState: P | (() => P);
  captureSnapshot: (params: P) => S;
  /** 捕获文件名、尺寸等导出派生值，禁止在 exportModel 中重新读取当前编辑状态。 */
  captureExportContext: (snapshot: S) => E;
  fingerprintSnapshot: (snapshot: S) => string;
  generatePreview: (snapshot: S) => Promise<PreviewLifecycleResult | null>;
  exportModel: (snapshot: S, geometry: Geom3, context: E) => Promise<void>;
  validateSnapshot?: (snapshot: S) => string | null;
  /**
   * 可选守卫：返回 false 时 generatePreview/exportModel 不执行
   * （用于统一吸收"worker service 不可用则优雅降级"的重复检查）。
   */
  guard?: () => boolean;
  /** 可选：对 setParams、undo 和外部导入值做规范化 */
  normalize?: (params: P) => P;
  /** preview 失效时的回调（stepped 用来清优化提案） */
  onInvalidate?: () => void;
  /** 判断归一化后的两个参数是否语义相同；默认使用引用相等。 */
  areEqual?: (left: P, right: P) => boolean;
}

export interface UseEditableParamsReturn<P> {
  params: P;
  /** 连续事务的暂态工作参数；没有活动事务时等于 params。 */
  viewParams: P;
  workingParams: P | null;
  transactionRevision: number;
  /** 仅在 reset、导入、Draft 加载等 Session 替换时递增。 */
  sessionEpoch: number;
  paramsRef: React.MutableRefObject<P>;
  /** 获取当前参数快照（供 generatePreview/exportModel 的闭包使用） */
  getParams: () => P;
  /** 透传 setParams，自动 invalidate（经 normalize 规范化） */
  setParams: React.Dispatch<React.SetStateAction<P>>;
  /** 统一的 action 执行器：传纯函数变换，自动处理 pushState/normalize/invalidate */
  applyChange: (
    mutate: (prev: P) => P,
    opts?: ApplyChangeOptions,
  ) => EditTransactionOutcome;
  beginContinuousEdit: () => EditTransactionOutcome;
  previewContinuousEdit: (mutate: (working: P) => P) => EditTransactionOutcome;
  commitContinuousEdit: () => EditTransactionOutcome;
  cancelContinuousEdit: () => EditTransactionOutcome;
  hasActiveContinuousEdit: () => boolean;
  /** Draft 加载、参数导入和重置：建立新编辑会话并清空历史。 */
  replaceParams: React.Dispatch<React.SetStateAction<P>>;
  saveSnapshot: () => void;
  undo: () => void;
  canUndo: boolean;
  invalidatePreview: () => void;
  threeGeometry: THREE.BufferGeometry | null;
  volume: number;
  bodyVolume?: number;
  lidVolume?: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  handleGenerate: () => Promise<void>;
  handleExportSTL: () => Promise<void>;
}

/**
 * 带 undo 历史 + 预览生命周期的可编辑参数容器。
 *
 * 深化共享模块：把自由布局模式 hook 里逐字重复的
 * "paramsRef + setParams + saveSnapshot/undo + updateParam 三件套" 编排集中到一处。
 *
 * 调用方用 applyChange((prev) => removeSlot(prev, id), { history: "save" })
 * 一行表达，无需手写 pushState→setParams→invalidate 三步咒语。
 */
export function useEditableParams<P, S, E>({
  initialState,
  captureSnapshot,
  captureExportContext,
  fingerprintSnapshot,
  generatePreview,
  exportModel,
  validateSnapshot,
  guard,
  normalize,
  onInvalidate,
  areEqual = Object.is,
}: UseEditableParamsOptions<P, S, E>): UseEditableParamsReturn<P> {
  const [params, internalSetParams] = useState<P>(initialState);
  const [workingParams, internalSetWorkingParams] = useState<P | null>(null);
  const [transactionRevision, setTransactionRevision] = useState(0);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const transactionRevisionRef = useRef(0);
  const paramsRef = useRef(params);
  const workingParamsRef = useRef<P | null>(null);
  const continuousBaseRef = useRef<P | null>(null);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const {
    pushState,
    popState,
    canUndo: canUndoFn,
    clearHistory,
  } = useUndoHistory<P>();

  const normalizeIfNeeded = useCallback(
    (value: P): P => (normalize ? normalize(value) : value),
    [normalize],
  );

  // 用 guard 包裹回调，统一吸收"worker 不可用则降级"的重复守卫
  const guardedGeneratePreview = useCallback(
    async (snapshot: S): Promise<PreviewLifecycleResult | null> => {
      if (guard && !guard()) return null;
      return generatePreview(snapshot);
    },
    [generatePreview, guard],
  );
  const guardedExportModel = useCallback(
    async (snapshot: S, geometry: Geom3, context: E): Promise<void> => {
      if (guard && !guard()) return;
      return exportModel(snapshot, geometry, context);
    },
    [exportModel, guard],
  );

  const {
    threeGeometry,
    volume,
    bodyVolume,
    lidVolume,
    isGenerating,
    isPreviewStale,
    invalidatePreview,
    handleGenerate,
    handleExportSTL,
  } = usePreviewLifecycle<P, S, E>({
    getParams: () => paramsRef.current,
    captureSnapshot,
    captureExportContext,
    fingerprintSnapshot,
    generatePreview: guardedGeneratePreview,
    exportModel: guardedExportModel,
    validateSnapshot,
    onInvalidate,
  });

  const cancelWorkingParams = useCallback(() => {
    workingParamsRef.current = null;
    continuousBaseRef.current = null;
    internalSetWorkingParams(null);
  }, []);

  const replaceParams = useCallback<React.Dispatch<React.SetStateAction<P>>>(
    (value) => {
      const previous = paramsRef.current;
      const next = normalizeIfNeeded(
        typeof value === "function"
          ? (value as (prevState: P) => P)(previous)
          : value,
      );
      cancelWorkingParams();
      clearHistory();
      setSessionEpoch((epoch) => epoch + 1);
      paramsRef.current = next;
      internalSetParams(next);
      transactionRevisionRef.current += 1;
      setTransactionRevision(transactionRevisionRef.current);
      invalidatePreview();
    },
    [cancelWorkingParams, clearHistory, invalidatePreview, normalizeIfNeeded],
  );
  const setParams = replaceParams;

  /**
   * 统一 action 执行器。
   *
   * history: "save"  → pushState(prev) 后变换（离散操作，默认）
   * history: "live"  → 不 pushState（旧模式由拖拽开始前的 saveSnapshot 捕获历史）
   * history: "skip"  → 不 pushState（setParams/resetParams 这类无需历史的路径）
   */
  const applyChange = useCallback(
    (mutate: (prev: P) => P, opts?: ApplyChangeOptions) => {
      const history = opts?.history ?? "save";
      if (continuousBaseRef.current !== null) {
        return {
          status: "rejected",
          code: "edit-already-active",
        } satisfies EditTransactionOutcome;
      }
      const previous = paramsRef.current;
      const next = normalizeIfNeeded(mutate(previous));
      if (areEqual(previous, next)) {
        return { status: "unchanged" } satisfies EditTransactionOutcome;
      }
      if (history === "save") {
        pushState(previous);
      }
      paramsRef.current = next;
      internalSetParams(next);
      transactionRevisionRef.current += 1;
      const committedRevision = transactionRevisionRef.current;
      setTransactionRevision(committedRevision);
      invalidatePreview();
      return {
        status: "committed",
        revision: committedRevision,
      } satisfies EditTransactionOutcome;
    },
    [areEqual, invalidatePreview, normalizeIfNeeded, pushState],
  );

  const beginContinuousEdit = useCallback((): EditTransactionOutcome => {
    if (continuousBaseRef.current !== null) {
      return { status: "rejected", code: "edit-already-active" };
    }
    continuousBaseRef.current = paramsRef.current;
    workingParamsRef.current = paramsRef.current;
    internalSetWorkingParams(paramsRef.current);
    return { status: "previewing" };
  }, []);

  const previewContinuousEdit = useCallback(
    (mutate: (working: P) => P): EditTransactionOutcome => {
      const current = workingParamsRef.current;
      if (continuousBaseRef.current === null || current === null) {
        return { status: "rejected", code: "edit-not-active" };
      }
      const next = normalizeIfNeeded(mutate(current));
      workingParamsRef.current = next;
      internalSetWorkingParams(next);
      return { status: "previewing" };
    },
    [normalizeIfNeeded],
  );

  const commitContinuousEdit = useCallback((): EditTransactionOutcome => {
    const previous = continuousBaseRef.current;
    const working = workingParamsRef.current;
    if (previous === null || working === null) {
      return { status: "rejected", code: "edit-not-active" };
    }
    const next = normalizeIfNeeded(working);
    cancelWorkingParams();
    if (areEqual(previous, next)) {
      return { status: "unchanged" };
    }
    pushState(previous);
    paramsRef.current = next;
    internalSetParams(next);
    transactionRevisionRef.current += 1;
    const committedRevision = transactionRevisionRef.current;
    setTransactionRevision(committedRevision);
    invalidatePreview();
    return { status: "committed", revision: committedRevision };
  }, [areEqual, cancelWorkingParams, invalidatePreview, normalizeIfNeeded, pushState]);

  const cancelContinuousEdit = useCallback((): EditTransactionOutcome => {
    if (continuousBaseRef.current === null) {
      return { status: "rejected", code: "edit-not-active" };
    }
    cancelWorkingParams();
    return { status: "unchanged" };
  }, [cancelWorkingParams]);

  const hasActiveContinuousEdit = useCallback(
    () => continuousBaseRef.current !== null,
    [],
  );

  const saveSnapshot = useCallback(() => {
    pushState(paramsRef.current);
  }, [pushState]);

  const undo = useCallback(() => {
    if (continuousBaseRef.current !== null) {
      cancelWorkingParams();
      return;
    }
    const prev = popState();
    if (prev !== undefined) {
      const next = normalizeIfNeeded(prev);
      paramsRef.current = next;
      internalSetParams(next);
      transactionRevisionRef.current += 1;
      setTransactionRevision(transactionRevisionRef.current);
      invalidatePreview();
    }
  }, [cancelWorkingParams, invalidatePreview, normalizeIfNeeded, popState]);

  const getParams = useCallback(() => paramsRef.current, []);

  return {
    params,
    viewParams: workingParams ?? params,
    workingParams,
    transactionRevision,
    sessionEpoch,
    paramsRef,
    getParams,
    setParams,
    replaceParams,
    applyChange,
    beginContinuousEdit,
    previewContinuousEdit,
    commitContinuousEdit,
    cancelContinuousEdit,
    hasActiveContinuousEdit,
    saveSnapshot,
    undo,
    canUndo: canUndoFn(),
    invalidatePreview,
    threeGeometry,
    volume,
    bodyVolume,
    lidVolume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  };
}
