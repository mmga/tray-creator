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
  type BaseHoleFitViolation,
} from "@/lib/base-hole-rules";
import { createGridBaseHoleConstructionPlan } from "@/lib/base-hole-planning";

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
  transactionRevision: number;
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
    transactionRevision,
    handleGenerate,
    handleExportSTL,
  } = useEditableParams<TrayParams, ModeParamSnapshot<"grid">, undefined>({
    initialState: () => resetGridParamsState(),
    captureSnapshot: (params) => captureModeParamSnapshot("grid", params),
    captureExportContext: () => undefined,
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
        createGridBaseHoleConstructionPlan(snapshot.params).violations,
      ),
  });

  const baseHolePlan = useMemo(
    () => createGridBaseHoleConstructionPlan(params),
    [params],
  );
  const baseHoleFitViolations = baseHolePlan.violations.slice();
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
    transactionRevision,
    baseHoleFitViolations,
    baseHoleFitBlockingReason,
    handleGenerate,
    handleExportSTL,
  };
}
