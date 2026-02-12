"use client";

import { useState, useCallback, useRef } from "react";
import type { TrayParams } from "@/types/tray";
import { createTrayModel } from "@/lib/tray-model";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { exportToSTL, generateSTLFilename } from "@/lib/stl-export";
import { DEFAULT_TRAY_PARAMS } from "@/lib/config";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

interface UseTrayModelReturn {
  params: TrayParams;
  setParams: React.Dispatch<React.SetStateAction<TrayParams>>;
  updateParam: <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => void;
  threeGeometry: THREE.BufferGeometry | null;
  isGenerating: boolean;
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useTrayModel(): UseTrayModelReturn {
  const [params, setParams] = useState<TrayParams>(DEFAULT_TRAY_PARAMS);
  const [threeGeometry, setThreeGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const jscadGeomRef = useRef<Geom3 | null>(null);

  const updateParam = useCallback(
    <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // 手动触发生成
  const handleGenerate = useCallback(() => {
    setIsGenerating(true);
    // 使用 setTimeout 让 UI 先更新再执行重计算
    setTimeout(() => {
      try {
        const jscadGeom = createTrayModel(params);
        jscadGeomRef.current = jscadGeom;
        const threeGeom = jscadToThreeGeometry(jscadGeom);
        setThreeGeometry((prev) => {
          prev?.dispose();
          return threeGeom;
        });
      } catch (e) {
        console.error("Failed to generate model:", e);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  }, [params]);

  // 导出 STL
  const handleExportSTL = useCallback(() => {
    if (!jscadGeomRef.current) return;
    const filename = generateSTLFilename(
      params.rows,
      params.columns,
      params.holeDiameter
    );
    exportToSTL(jscadGeomRef.current, filename);
  }, [params.rows, params.columns, params.holeDiameter]);

  return {
    params,
    setParams,
    updateParam,
    threeGeometry,
    isGenerating,
    handleGenerate,
    handleExportSTL,
  };
}
