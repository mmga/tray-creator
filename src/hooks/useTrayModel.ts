"use client";

import { useCallback } from "react";
import type * as THREE from "three";
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
import { useEditableParams } from "@/hooks/useEditableParams";

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
  const {
    params,
    setParams,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  } = useEditableParams<TrayParams>({
    initialState: () => resetGridParamsState(),
    guard: () => trayWorkerService !== null,
    generatePreview: async (currentParams) =>
      generateGridPreview(currentParams, trayWorkerService!),
    exportModel: async (currentParams, geometry) => {
      await exportGridModelFiles(
        currentParams,
        geometry,
        trayWorkerService!,
        browserDownloadPort,
      );
    },
  });

  // grid 模式无 undo，所有操作用 history: "skip"
  const updateParam = useCallback(
    <K extends keyof TrayParams>(key: K, value: TrayParams[K]) => {
      setParams((prev) => updateGridParam(prev, key, value));
    },
    [setParams],
  );

  const replaceParams = useCallback(
    (next: TrayParams) => {
      setParams(replaceGridParamsState(next));
    },
    [setParams],
  );

  const resetParams = useCallback(() => {
    setParams(resetGridParamsState());
  }, [setParams]);

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
