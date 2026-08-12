"use client";

import { useCallback } from "react";
import type * as THREE from "three";
import type { BaseConverterParams } from "@/types/custom-tray";
import {
  BASE_CONVERTER_DEFAULTS,
  normalizeBaseConverterParams,
  validateBaseConverterParams,
} from "@/lib/base-converter-config";
import {
  exportBaseConverterModelFiles,
  generateBaseConverterPreview,
} from "@/lib/base-converter-model-service";
import { browserDownloadPort } from "@/lib/download-port";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useEditableParams } from "@/hooks/useEditableParams";
import {
  captureModeParamSnapshot,
  createModelGeometryFingerprint,
  type ModeParamSnapshot,
} from "@/lib/mode-param-snapshot";

interface UseBaseConverterReturn {
  params: BaseConverterParams;
  viewParams: BaseConverterParams;
  updateParam: <K extends keyof BaseConverterParams>(
    key: K,
    value: BaseConverterParams[K],
  ) => void;
  updateParams: (
    mutate: (params: BaseConverterParams) => BaseConverterParams,
  ) => void;
  beginContinuousEdit: () => boolean;
  previewParam: <K extends keyof BaseConverterParams>(
    key: K,
    value: BaseConverterParams[K],
  ) => void;
  previewParams: (
    mutate: (params: BaseConverterParams) => BaseConverterParams,
  ) => void;
  commitContinuousEdit: () => void;
  cancelContinuousEdit: () => void;
  undo: () => void;
  canUndo: boolean;
  replaceParams: (params: BaseConverterParams) => void;
  resetParams: () => void;
  threeGeometry: THREE.BufferGeometry | null;
  volume: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  transactionRevision: number;
  handleGenerate: () => Promise<void>;
  handleExportSTL: () => Promise<void>;
}

export function useBaseConverter(): UseBaseConverterReturn {
  const model = useEditableParams<
    BaseConverterParams,
    ModeParamSnapshot<"base-converter">,
    undefined
  >({
    initialState: BASE_CONVERTER_DEFAULTS,
    captureSnapshot: (params) =>
      captureModeParamSnapshot("base-converter", params),
    captureExportContext: () => undefined,
    fingerprintSnapshot: createModelGeometryFingerprint,
    normalize: normalizeBaseConverterParams,
    validateSnapshot: (snapshot) =>
      validateBaseConverterParams(snapshot.params),
    guard: () => trayWorkerService !== null,
    generatePreview: async (snapshot) =>
      generateBaseConverterPreview(snapshot.params, trayWorkerService!),
    exportModel: async (snapshot, geometry) =>
      exportBaseConverterModelFiles(
        snapshot,
        geometry,
        trayWorkerService!,
        browserDownloadPort,
      ),
  });

  const updateParam = useCallback(
    <K extends keyof BaseConverterParams>(
      key: K,
      value: BaseConverterParams[K],
    ) => {
      model.applyChange((previous) => ({ ...previous, [key]: value }));
    },
    [model],
  );
  const updateParams = useCallback(
    (mutate: (params: BaseConverterParams) => BaseConverterParams) => {
      model.applyChange(mutate);
    },
    [model],
  );
  const beginContinuousEdit = useCallback(
    () => model.beginContinuousEdit().status === "previewing",
    [model],
  );
  const previewParam = useCallback(
    <K extends keyof BaseConverterParams>(
      key: K,
      value: BaseConverterParams[K],
    ) => {
      model.previewContinuousEdit((previous) => ({
        ...previous,
        [key]: value,
      }));
    },
    [model],
  );
  const previewParams = useCallback(
    (mutate: (params: BaseConverterParams) => BaseConverterParams) => {
      model.previewContinuousEdit(mutate);
    },
    [model],
  );
  const commitContinuousEdit = useCallback(() => {
    model.commitContinuousEdit();
  }, [model]);
  const cancelContinuousEdit = useCallback(() => {
    model.cancelContinuousEdit();
  }, [model]);
  const replaceParams = useCallback(
    (params: BaseConverterParams) => model.replaceParams(params),
    [model],
  );
  const resetParams = useCallback(
    () => model.replaceParams(BASE_CONVERTER_DEFAULTS),
    [model],
  );

  return {
    params: model.params,
    viewParams: model.viewParams,
    updateParam,
    updateParams,
    beginContinuousEdit,
    previewParam,
    previewParams,
    commitContinuousEdit,
    cancelContinuousEdit,
    undo: model.undo,
    canUndo: model.canUndo,
    replaceParams,
    resetParams,
    threeGeometry: model.threeGeometry,
    volume: model.volume,
    isGenerating: model.isGenerating,
    isPreviewStale: model.isPreviewStale,
    transactionRevision: model.transactionRevision,
    handleGenerate: model.handleGenerate,
    handleExportSTL: model.handleExportSTL,
  };
}
