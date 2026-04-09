"use client";

import { useState, useCallback, useRef } from "react";
import type { TrayParams } from "@/types/tray";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { generateSTLFilename } from "@/lib/stl-export";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useToast } from "@/hooks/useToast";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

interface UseTrayModelReturn {
  params: TrayParams;
  updateParam: <K extends keyof TrayParams>(
    key: K,
    value: TrayParams[K],
  ) => void;
  replaceParams: (next: TrayParams) => void;
  resetParams: () => void;
  threeGeometry: THREE.BufferGeometry | null;
  volume: number; // in mm^3
  isGenerating: boolean;
  isPreviewStale: boolean;
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useTrayModel(): UseTrayModelReturn {
  const [params, setParams] = useState<TrayParams>(DEFAULT_TRAY_PARAMS);
  const [threeGeometry, setThreeGeometry] =
    useState<THREE.BufferGeometry | null>(null);
  const [volume, setVolume] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const jscadGeomRef = useRef<Geom3 | null>(null);
  const { toast } = useToast();
  // 追踪参数是否在上次生成后发生了变更
  const [isPreviewStale, setIsPreviewStale] = useState(false);

  const normalizeParams = useCallback((next: TrayParams): TrayParams => {
    if (!next.boundarySpacingIndependent) {
      return {
        ...next,
        boundarySpacing: next.spacing,
      };
    }
    return next;
  }, []);

  const invalidatePreview = useCallback(() => {
    jscadGeomRef.current = null;
    setIsPreviewStale(true);
  }, []);

  const replaceParams = useCallback(
    (next: TrayParams) => {
      setParams(normalizeParams(next));
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams],
  );

  const resetParams = useCallback(() => {
    setParams(normalizeParams(DEFAULT_TRAY_PARAMS));
    invalidatePreview();
  }, [invalidatePreview, normalizeParams]);

  const updateParam = useCallback(
    <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => {
      setParams((prev) => normalizeParams({ ...prev, [key]: value }));
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams],
  );

  // 异步触发生成
  const handleGenerate = useCallback(async () => {
    if (!trayWorkerService) return;
    setIsGenerating(true);
    try {
      const result = await trayWorkerService.generateGrid(params);
      jscadGeomRef.current = result.geometry;
      setVolume(result.volume);
      const threeGeom = jscadToThreeGeometry(result.geometry);
      setThreeGeometry((prev) => {
        prev?.dispose();
        return threeGeom;
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

  // 导出 STL
  const handleExportSTL = useCallback(async () => {
    if (isPreviewStale) {
      toast("error", "参数已变更，请先点击开始锻造生成最新模型");
      return;
    }
    if (!jscadGeomRef.current || !trayWorkerService) {
      toast("error", "当前没有可导出的模型，请先点击开始锻造");
      return;
    }
    const filename = generateSTLFilename(
      params.rows,
      params.columns,
      params.holeDiameter,
    );
    try {
      const result = await trayWorkerService.exportSTL(
        jscadGeomRef.current,
        filename,
      );
      // Trigger download
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      const jsonFilename = filename.replace(/\.stl$/i, ".json");
      const jsonBlob = new Blob([JSON.stringify(params, null, 2)], {
        type: "application/json",
      });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement("a");
      jsonLink.href = jsonUrl;
      jsonLink.download = jsonFilename;
      document.body.appendChild(jsonLink);
      jsonLink.click();
      document.body.removeChild(jsonLink);
      URL.revokeObjectURL(jsonUrl);
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
