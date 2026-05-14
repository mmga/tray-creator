"use client";

import { useCallback, useRef, useState } from "react";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { useToast } from "@/hooks/useToast";

export interface PreviewLifecycleResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
}

interface UsePreviewLifecycleOptions<P> {
  getParams: () => P;
  generatePreview: (params: P) => Promise<PreviewLifecycleResult | null>;
  exportModel: (params: P, geometry: Geom3) => Promise<void>;
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

export function usePreviewLifecycle<P>({
  getParams,
  generatePreview,
  exportModel,
  onInvalidate,
}: UsePreviewLifecycleOptions<P>): UsePreviewLifecycleReturn {
  const { toast } = useToast();
  const [threeGeometry, setThreeGeometry] =
    useState<THREE.BufferGeometry | null>(null);
  const [volume, setVolume] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewStale, setIsPreviewStale] = useState(false);
  const geometryRef = useRef<Geom3 | null>(null);
  const requestVersionRef = useRef(0);

  const invalidatePreview = useCallback(() => {
    requestVersionRef.current += 1;
    geometryRef.current = null;
    setVolume(0);
    setIsPreviewStale(true);
    onInvalidate?.();
  }, [onInvalidate]);

  const generateCurrentPreview = useCallback(async (): Promise<Geom3 | null> => {
    const requestVersion = requestVersionRef.current;
    setIsGenerating(true);
    try {
      const result = await generatePreview(getParams());
      if (!result) {
        return null;
      }

      if (requestVersion !== requestVersionRef.current) {
        result.threeGeometry.dispose();
        return null;
      }

      geometryRef.current = result.geometry;
      setVolume(result.volume);
      setThreeGeometry((prev) => {
        prev?.dispose();
        return result.threeGeometry;
      });
      setIsPreviewStale(false);
      return result.geometry;
    } catch (err) {
      console.error("生成失败:", err);
      toast(
        "error",
        `模型生成失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [generatePreview, getParams, toast]);

  const handleGenerate = useCallback(async () => {
    await generateCurrentPreview();
  }, [generateCurrentPreview]);

  const handleExportSTL = useCallback(async () => {
    const needsFreshPreview = isPreviewStale || !geometryRef.current;
    const geometry =
      needsFreshPreview ? await generateCurrentPreview() : geometryRef.current;

    if (!geometry) {
      if (!needsFreshPreview) {
        toast("error", "当前没有可导出的模型，请先点击开始锻造");
      }
      return;
    }

    try {
      await exportModel(getParams(), geometry);
    } catch (err) {
      console.error("STL导出失败:", err);
      toast(
        "error",
        `STL 导出失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [exportModel, generateCurrentPreview, getParams, isPreviewStale, toast]);

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
