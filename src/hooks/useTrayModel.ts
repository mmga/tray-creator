"use client";

import { useCallback, useMemo } from "react";
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
import {
  captureModeParamSnapshot,
  createModelGeometryFingerprint,
  type ModeParamSnapshot,
} from "@/lib/mode-param-snapshot";
import {
  getBaseHoleFitBlockingReason,
  validateBaseHoleFit,
  type BaseHoleFitViolation,
} from "@/lib/base-hole-rules";

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
  baseHoleFitViolations: BaseHoleFitViolation[];
  baseHoleFitBlockingReason: string | null;
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
  } = useEditableParams<TrayParams, ModeParamSnapshot<"grid">>({
    initialState: () => resetGridParamsState(),
    captureSnapshot: (params) => captureModeParamSnapshot("grid", params),
    fingerprintSnapshot: createModelGeometryFingerprint,
    guard: () => trayWorkerService !== null,
    generatePreview: async (snapshot) =>
      generateGridPreview(snapshot.params, trayWorkerService!),
    exportModel: async (snapshot, geometry) => {
      await exportGridModelFiles(
        snapshot,
        geometry,
        trayWorkerService!,
        browserDownloadPort,
      );
    },
    validateSnapshot: (snapshot) =>
      getBaseHoleFitBlockingReason(
        validateBaseHoleFit("grid", snapshot.params),
      ),
  });

  const baseHoleFitViolations = useMemo(
    () => validateBaseHoleFit("grid", params),
    [params],
  );
  const baseHoleFitBlockingReason = getBaseHoleFitBlockingReason(
    baseHoleFitViolations,
  );

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
    baseHoleFitViolations,
    baseHoleFitBlockingReason,
    handleGenerate,
    handleExportSTL,
  };
}
