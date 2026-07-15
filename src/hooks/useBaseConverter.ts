"use client";

import { useCallback } from "react";
import type * as THREE from "three";
import type { BaseConverterParams } from "@/types/custom-tray";
import {
  BASE_CONVERTER_DEFAULTS,
  normalizeBaseConverterParams,
} from "@/lib/base-converter-config";
import {
  exportBaseConverterModelFiles,
  generateBaseConverterPreview,
} from "@/lib/base-converter-model-service";
import { browserDownloadPort } from "@/lib/download-port";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useEditableParams } from "@/hooks/useEditableParams";

interface UseBaseConverterReturn {
  params: BaseConverterParams;
  updateParam: <K extends keyof BaseConverterParams>(
    key: K,
    value: BaseConverterParams[K],
  ) => void;
  replaceParams: (params: BaseConverterParams) => void;
  resetParams: () => void;
  threeGeometry: THREE.BufferGeometry | null;
  volume: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  handleGenerate: () => Promise<void>;
  handleExportSTL: () => Promise<void>;
}

export function useBaseConverter(): UseBaseConverterReturn {
  const model = useEditableParams<BaseConverterParams>({
    initialState: BASE_CONVERTER_DEFAULTS,
    normalize: normalizeBaseConverterParams,
    guard: () => trayWorkerService !== null,
    generatePreview: async (params) =>
      generateBaseConverterPreview(params, trayWorkerService!),
    exportModel: async (params, geometry) =>
      exportBaseConverterModelFiles(
        params,
        geometry,
        trayWorkerService!,
        browserDownloadPort,
      ),
  });

  const updateParam = useCallback(
    <K extends keyof BaseConverterParams>(
      key: K,
      value: BaseConverterParams[K],
    ) => model.setParams((previous) => ({ ...previous, [key]: value })),
    [model],
  );
  const replaceParams = useCallback(
    (params: BaseConverterParams) => model.setParams(params),
    [model],
  );
  const resetParams = useCallback(
    () => model.setParams(BASE_CONVERTER_DEFAULTS),
    [model],
  );

  return {
    params: model.params,
    updateParam,
    replaceParams,
    resetParams,
    threeGeometry: model.threeGeometry,
    volume: model.volume,
    isGenerating: model.isGenerating,
    isPreviewStale: model.isPreviewStale,
    handleGenerate: model.handleGenerate,
    handleExportSTL: model.handleExportSTL,
  };
}
