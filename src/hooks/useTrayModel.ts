"use client";

import { useState, useCallback, useRef } from "react";
import type { TrayParams } from "@/types/tray";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { generateSTLFilename } from "@/lib/stl-export";
import { DEFAULT_TRAY_PARAMS } from "@/lib/config";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useToast } from "@/hooks/useToast";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

interface UseTrayModelReturn {
  params: TrayParams;
  setParams: React.Dispatch<React.SetStateAction<TrayParams>>;
  updateParam: <K extends keyof TrayParams>(
    key: K,
    value: TrayParams[K],
  ) => void;
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
  const lastGeneratedParamsRef = useRef<string | null>(null);

  const updateParam = useCallback(
    <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
      setIsPreviewStale(true);
    },
    [],
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
      lastGeneratedParamsRef.current = JSON.stringify(params);
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
    if (!jscadGeomRef.current || !trayWorkerService) return;
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
    } catch (err) {
      console.error("STL导出失败:", err);
      toast(
        "error",
        `STL 导出失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [params.rows, params.columns, params.holeDiameter, toast]);

  return {
    params,
    setParams,
    updateParam,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  };
}
