"use client";

import { useState, useCallback } from "react";
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
import { usePreviewLifecycle } from "@/hooks/usePreviewLifecycle";

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
  const {
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    invalidatePreview,
    handleGenerate,
    handleExportSTL,
  } = usePreviewLifecycle({
    getParams: () => params,
    generatePreview: async (currentParams) => {
      if (!trayWorkerService) {
        return null;
      }
      return generateGridPreview(currentParams, trayWorkerService);
    },
    exportModel: async (currentParams, geometry) => {
      if (!trayWorkerService) {
        return;
      }
      await exportGridModelFiles(
        currentParams,
        geometry,
        trayWorkerService,
        browserDownloadPort,
      );
    },
  });

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
