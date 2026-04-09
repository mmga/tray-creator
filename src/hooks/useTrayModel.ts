"use client";

import { useState, useCallback, useRef } from "react";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { TrayParams } from "@/types/tray";
import { browserDownloadPort } from "@/lib/download-port";
import {
  exportGridModelFiles,
  generateGridPreview,
} from "@/lib/grid-model-service";
import {
  replaceGridParams as replaceGridParamsState,
  resetGridParams as resetGridParamsState,
  updateGridParam,
} from "@/lib/grid-model-state";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useToast } from "@/hooks/useToast";

interface UseTrayModelReturn {
  params: TrayParams;
  updateParam: <K extends keyof TrayParams>(
    key: K,
    value: TrayParams[K],
  ) => void;
  replaceParams: (next: TrayParams) => void;
  resetParams: () => void;
  threeGeometry: THREE.BufferGeometry | null;
  volume: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useTrayModel(): UseTrayModelReturn {
  const [params, setParams] = useState<TrayParams>(() => resetGridParamsState());
  const [threeGeometry, setThreeGeometry] =
    useState<THREE.BufferGeometry | null>(null);
  const [volume, setVolume] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewStale, setIsPreviewStale] = useState(false);
  const jscadGeomRef = useRef<Geom3 | null>(null);
  const { toast } = useToast();

  const invalidatePreview = useCallback(() => {
    jscadGeomRef.current = null;
    setIsPreviewStale(true);
  }, []);

  const replaceParams = useCallback(
    (next: TrayParams) => {
      setParams(replaceGridParamsState(next));
      invalidatePreview();
    },
    [invalidatePreview],
  );

  const resetParams = useCallback(() => {
    setParams(resetGridParamsState());
    invalidatePreview();
  }, [invalidatePreview]);

  const updateParam = useCallback(
    <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => {
      setParams((prev) => updateGridParam(prev, key, value));
      invalidatePreview();
    },
    [invalidatePreview],
  );

  const handleGenerate = useCallback(async () => {
    if (!trayWorkerService) {
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateGridPreview(params, trayWorkerService);
      jscadGeomRef.current = result.geometry;
      setVolume(result.volume);
      setThreeGeometry((prev) => {
        prev?.dispose();
        return result.threeGeometry;
      });
      setIsPreviewStale(false);
    } catch (err) {
      console.error("生成失败:", err);
      toast(
        "error",
        `模型生成失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    } finally {
      setIsGenerating(false);
    }
  }, [params, toast]);

  const handleExportSTL = useCallback(async () => {
    if (isPreviewStale) {
      toast("error", "参数已变更，请先点击开始锻造生成最新模型");
      return;
    }
    if (!jscadGeomRef.current || !trayWorkerService) {
      toast("error", "当前没有可导出的模型，请先点击开始锻造");
      return;
    }

    try {
      await exportGridModelFiles(
        params,
        jscadGeomRef.current,
        trayWorkerService,
        browserDownloadPort,
      );
    } catch (err) {
      console.error("STL导出失败:", err);
      toast(
        "error",
        `STL 导出失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [isPreviewStale, params, toast]);

  return {
    params,
    updateParam,
    replaceParams,
    resetParams,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  };
}
