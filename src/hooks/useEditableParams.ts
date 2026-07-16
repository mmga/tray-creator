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

/** history 选项：显式化"拖拽前快照 + 拖拽中不 push"的隐含协议 */
export type HistoryMode = "save" | "live" | "skip";

interface ApplyChangeOptions {
  /** save = 离散操作（pushState 后变换）；live = 拖拽高频（靠合并窗口）；skip = 无需历史（setParams/resetParams） */
  history?: HistoryMode;
  /** 强制入栈，绕过合并窗口（如 applyOptimizationProposal） */
  force?: boolean;
}

interface UseEditableParamsOptions<P, S> {
  initialState: P | (() => P);
  captureSnapshot: (params: P) => S;
  fingerprintSnapshot: (snapshot: S) => string;
  generatePreview: (snapshot: S) => Promise<PreviewLifecycleResult | null>;
  exportModel: (snapshot: S, geometry: Geom3) => Promise<void>;
  /**
   * 可选守卫：返回 false 时 generatePreview/exportModel 不执行
   * （用于统一吸收"worker service 不可用则优雅降级"的重复检查）。
   */
  guard?: () => boolean;
  /** 可选：对 setParams/undo/外部导入的值做规范化（simple-stepped 的 normalizeParams） */
  normalize?: (params: P) => P;
  /** preview 失效时的回调（stepped 用来清优化提案） */
  onInvalidate?: () => void;
}

export interface UseEditableParamsReturn<P> {
  params: P;
  paramsRef: React.MutableRefObject<P>;
  /** 获取当前参数快照（供 generatePreview/exportModel 的闭包使用） */
  getParams: () => P;
  /** 透传 setParams，自动 invalidate（经 normalize 规范化） */
  setParams: React.Dispatch<React.SetStateAction<P>>;
  /** 统一的 action 执行器：传纯函数变换，自动处理 pushState/normalize/invalidate */
  applyChange: (
    mutate: (prev: P) => P,
    opts?: ApplyChangeOptions,
  ) => void;
  saveSnapshot: () => void;
  undo: () => void;
  canUndo: boolean;
  invalidatePreview: () => void;
  threeGeometry: THREE.BufferGeometry | null;
  volume: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  handleGenerate: () => Promise<void>;
  handleExportSTL: () => Promise<void>;
}

/**
 * 带 undo 历史 + 预览生命周期的可编辑参数容器。
 *
 * 深化共享模块：把三个模式 hook（custom/simple-stepped/stepped）里逐字重复的
 * "paramsRef + setParams + saveSnapshot/undo + updateParam 三件套" 编排集中到一处。
 *
 * 调用方用 applyChange((prev) => removeSlot(prev, id), { history: "save" })
 * 一行表达，无需手写 pushState→setParams→invalidate 三步咒语。
 */
export function useEditableParams<P, S>({
  initialState,
  captureSnapshot,
  fingerprintSnapshot,
  generatePreview,
  exportModel,
  guard,
  normalize,
  onInvalidate,
}: UseEditableParamsOptions<P, S>): UseEditableParamsReturn<P> {
  const [params, internalSetParams] = useState<P>(initialState);
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const { pushState, popState, canUndo: canUndoFn } = useUndoHistory<P>();

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
    async (snapshot: S, geometry: Geom3): Promise<void> => {
      if (guard && !guard()) return;
      return exportModel(snapshot, geometry);
    },
    [exportModel, guard],
  );

  const {
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    invalidatePreview,
    handleGenerate,
    handleExportSTL,
  } = usePreviewLifecycle<P, S>({
    getParams: () => paramsRef.current,
    captureSnapshot,
    fingerprintSnapshot,
    generatePreview: guardedGeneratePreview,
    exportModel: guardedExportModel,
    onInvalidate,
  });

  const setParams = useCallback<React.Dispatch<React.SetStateAction<P>>>(
    (value) => {
      internalSetParams((prev) =>
        normalizeIfNeeded(
          typeof value === "function"
            ? (value as (prevState: P) => P)(prev)
            : value,
        ),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeIfNeeded],
  );

  /**
   * 统一 action 执行器。
   *
   * history: "save"  → pushState(prev) 后变换（离散操作，默认）
   * history: "live"  → 不 pushState（拖拽高频，靠 500ms 合并窗口，需在拖拽前调 saveSnapshot）
   * history: "skip"  → 不 pushState（setParams/resetParams 这类无需历史的路径）
   */
  const applyChange = useCallback(
    (mutate: (prev: P) => P, opts?: ApplyChangeOptions) => {
      const history = opts?.history ?? "save";
      internalSetParams((prev) => {
        if (history === "save") {
          pushState(prev, opts?.force ? { force: true } : undefined);
        }
        return normalizeIfNeeded(mutate(prev));
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeIfNeeded, pushState],
  );

  const saveSnapshot = useCallback(() => {
    pushState(paramsRef.current);
  }, [pushState]);

  const undo = useCallback(() => {
    const prev = popState();
    if (prev !== undefined) {
      internalSetParams(normalizeIfNeeded(prev));
      invalidatePreview();
    }
  }, [invalidatePreview, normalizeIfNeeded, popState]);

  const getParams = useCallback(() => paramsRef.current, []);

  return {
    params,
    paramsRef,
    getParams,
    setParams,
    applyChange,
    saveSnapshot,
    undo,
    canUndo: canUndoFn(),
    invalidatePreview,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  };
}
