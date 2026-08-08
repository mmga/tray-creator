"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { useToast } from "@/hooks/useToast";
import { useRequestSequence } from "@/hooks/useRequestSequence";

export interface PreviewLifecycleResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
}

interface UsePreviewLifecycleOptions<P, S, E> {
  getParams: () => P;
  captureSnapshot: (params: P) => S;
  /** 校验通过后、任何异步生成前调用；返回值必须与 Snapshot 配对且不再引用可变状态。 */
  captureExportContext: (snapshot: S) => E;
  fingerprintSnapshot: (snapshot: S) => string;
  generatePreview: (snapshot: S) => Promise<PreviewLifecycleResult | null>;
  exportModel: (snapshot: S, geometry: Geom3, context: E) => Promise<void>;
  validateSnapshot?: (snapshot: S) => string | null;
  onInvalidate?: () => void;
}

interface UsePreviewLifecycleReturn {
  threeGeometry: THREE.BufferGeometry | null;
  volume: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  invalidatePreview: () => void;
  handleGenerate: () => Promise<void>;
  handleExportSTL: () => Promise<void>;
}

export function usePreviewLifecycle<P, S, E>({
  getParams,
  captureSnapshot,
  captureExportContext,
  fingerprintSnapshot,
  generatePreview,
  exportModel,
  validateSnapshot,
  onInvalidate,
}: UsePreviewLifecycleOptions<P, S, E>): UsePreviewLifecycleReturn {
  const { toast } = useToast();
  const [threeGeometry, setThreeGeometry] =
    useState<THREE.BufferGeometry | null>(null);
  const [volume, setVolume] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewStale, setIsPreviewStale] = useState(false);
  const geometryRef = useRef<Geom3 | null>(null);
  const threeGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const geometryFingerprintRef = useRef<string | null>(null);
  const generatingSeqRef = useRef(0);
  const { nextSeq, isStale } = useRequestSequence();

  useEffect(
    () => () => {
      nextSeq();
      threeGeometryRef.current?.dispose();
      threeGeometryRef.current = null;
    },
    [nextSeq],
  );

  const invalidatePreview = useCallback(() => {
    nextSeq();
    geometryRef.current = null;
    geometryFingerprintRef.current = null;
    setVolume(0);
    setIsGenerating(false);
    setIsPreviewStale(true);
    onInvalidate?.();
  }, [nextSeq, onInvalidate]);

  const generateCurrentPreview = useCallback(async (
    snapshot: S,
    preserveStaleGeometryForExport = false,
  ): Promise<Geom3 | null> => {
    const blockingReason = validateSnapshot?.(snapshot);
    if (blockingReason) {
      toast("error", blockingReason);
      return null;
    }
    const seq = nextSeq();
    generatingSeqRef.current = seq;
    setIsGenerating(true);
    try {
      const result = await generatePreview(snapshot);
      if (!result) {
        return null;
      }

      if (isStale(seq)) {
        result.threeGeometry.dispose();
        return preserveStaleGeometryForExport ? result.geometry : null;
      }

      geometryRef.current = result.geometry;
      geometryFingerprintRef.current = fingerprintSnapshot(snapshot);
      setVolume(result.volume);
      threeGeometryRef.current?.dispose();
      threeGeometryRef.current = result.threeGeometry;
      setThreeGeometry(result.threeGeometry);
      setIsPreviewStale(false);
      return result.geometry;
    } catch (err) {
      if (isStale(seq) && !preserveStaleGeometryForExport) {
        return null;
      }
      console.error("生成失败:", err);
      toast(
        "error",
        `模型生成失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
      return null;
    } finally {
      if (!isStale(seq) && generatingSeqRef.current === seq) {
        setIsGenerating(false);
      }
    }
  }, [fingerprintSnapshot, generatePreview, isStale, nextSeq, toast, validateSnapshot]);

  const handleGenerate = useCallback(async () => {
    await generateCurrentPreview(captureSnapshot(getParams()));
  }, [captureSnapshot, generateCurrentPreview, getParams]);

  const handleExportSTL = useCallback(async () => {
    const snapshot = captureSnapshot(getParams());
    const blockingReason = validateSnapshot?.(snapshot);
    if (blockingReason) {
      toast("error", blockingReason);
      return;
    }
    const exportContext = captureExportContext(snapshot);
    const fingerprint = fingerprintSnapshot(snapshot);
    const needsFreshPreview =
      !geometryRef.current || geometryFingerprintRef.current !== fingerprint;
    const geometry =
      needsFreshPreview
        ? await generateCurrentPreview(snapshot, true)
        : geometryRef.current;

    if (!geometry) {
      if (!needsFreshPreview) {
        toast("error", "当前没有可导出的模型，请先点击开始锻造");
      }
      return;
    }

    try {
      await exportModel(snapshot, geometry, exportContext);
    } catch (err) {
      console.error("STL导出失败:", err);
      toast(
        "error",
        `STL 导出失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [
    captureSnapshot,
    captureExportContext,
    exportModel,
    fingerprintSnapshot,
    generateCurrentPreview,
    getParams,
    toast,
    validateSnapshot,
  ]);

  return {
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    invalidatePreview,
    handleGenerate,
    handleExportSTL,
  };
}
