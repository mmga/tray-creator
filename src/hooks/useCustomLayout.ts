"use client";

import { useCallback, useMemo } from "react";
import { browserDownloadPort } from "@/lib/download-port";
import { randomIdFactory } from "@/lib/id-factory";
import type { CustomLayoutParams } from "@/types/custom-tray";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import {
  addCustomSlot,
  applyCustomSlotUpdates,
  duplicateCustomSlots,
  type CircleSlotConfig,
  type EllipseSlotConfig,
  insertCustomSlots,
  removeCustomSlot,
  trimCustomBaseplate,
  updateCustomLayoutParam,
  updateCustomSlotPosition,
  updateCustomSlotRotation,
  type CustomSlotUpdate,
} from "@/lib/custom-layout-actions";
import { calculateCustomEffectiveDimensions } from "@/lib/custom-layout-math";
import {
  exportCustomModelFiles,
  generateCustomPreview,
} from "@/lib/custom-layout-service";
import { useEditableParams } from "@/hooks/useEditableParams";
import { useCustomContouredFootprint } from "@/hooks/useCustomContouredFootprint";
import { trayWorkerService } from "@/lib/worker/worker-service";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import type * as THREE from "three";
import {
  captureModeParamSnapshot,
  createModelGeometryFingerprint,
  type ModeParamSnapshot,
} from "@/lib/mode-param-snapshot";
import {
  applyFlatTrayBaseHoleSupportingThickness,
  getBaseHoleFitBlockingReason,
  validateBaseHoleFit,
  type BaseHoleFitViolation,
} from "@/lib/base-hole-rules";
import type {
  ContouredFootprintConstructionError,
  ConstructedContouredFootprint,
} from "@/lib/contoured-footprint";

interface UseCustomLayoutReturn {
  params: CustomLayoutParams;
  persistedParams: CustomLayoutParams;
  committedContouredFootprint: ConstructedContouredFootprint | null;
  workingContouredFootprint: ConstructedContouredFootprint | null;
  contouredConstructionError: ContouredFootprintConstructionError | null;
  workingContouredConstructionError: ContouredFootprintConstructionError | null;
  setParams: React.Dispatch<React.SetStateAction<CustomLayoutParams>>;
  updateParam: <K extends keyof CustomLayoutParams>(
    key: K,
    value: CustomLayoutParams[K],
  ) => void;
  addSlot: (
    width: number,
    height?: number,
    ellipseConfig?: EllipseSlotConfig,
    circleConfig?: CircleSlotConfig,
  ) => void;
  removeSlot: (id: string) => void;
  updateSlotPosition: (id: string, x: number, y: number) => void;
  updateMultipleSlots: (
    updates: { id: string; x: number; y: number; rotation?: number }[],
  ) => void;
  updateMultipleSlotsLive: (
    updates: { id: string; x: number; y: number; rotation?: number }[],
  ) => void;
  beginContinuousEdit: () => boolean;
  commitContinuousEdit: () => void;
  cancelContinuousEdit: () => void;
  updateSlotRotation: (id: string, rotation: number) => void;
  insertSlots: (slots: SymmetryInsertSlot[]) => void;
  duplicateSlots: (ids: string[]) => string[];
  trimBaseplate: () => void;
  calculateEffectiveDimensions: () => {
    width: number;
    depth: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  effectiveDimensions: {
    width: number;
    depth: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  undo: () => void;
  canUndo: boolean;
  // 3D 相关
  threeGeometry: THREE.BufferGeometry | null;
  volume: number; // in mm^3
  isGenerating: boolean;
  isPreviewStale: boolean;
  transactionRevision: number;
  baseHoleFitViolations: BaseHoleFitViolation[];
  baseHoleFitBlockingReason: string | null;
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useCustomLayout(): UseCustomLayoutReturn {
  const {
    params: persistedParams,
    viewParams: params,
    paramsRef,
    setParams,
    applyChange,
    beginContinuousEdit: beginContinuousEditTransaction,
    previewContinuousEdit,
    commitContinuousEdit: commitContinuousEditTransaction,
    cancelContinuousEdit: cancelContinuousEditTransaction,
    hasActiveContinuousEdit,
    workingParams,
    undo,
    canUndo,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    transactionRevision,
    handleGenerate: generatePreview,
    handleExportSTL: exportSTL,
  } = useEditableParams<
    CustomLayoutParams,
    ModeParamSnapshot<"custom">
  >({
    initialState: CUSTOM_LAYOUT_DEFAULTS,
    normalize: applyFlatTrayBaseHoleSupportingThickness,
    captureSnapshot: (params) => captureModeParamSnapshot("custom", params),
    fingerprintSnapshot: createModelGeometryFingerprint,
    guard: () => trayWorkerService !== null,
    generatePreview: async (snapshot) =>
      generateCustomPreview(snapshot.params, trayWorkerService!),
    exportModel: async (snapshot, geometry) => {
      await exportCustomModelFiles(
        snapshot,
        geometry,
        trayWorkerService!,
        browserDownloadPort,
      );
    },
    // 主线程校验由下方的权威构造结果统一提供，避免生成前再次从快照重构轮廓。
    validateSnapshot: () => null,
  });

  const contouredFootprints = useCustomContouredFootprint({
    persistedParams,
    workingParams,
  });
  const committedContouredFootprint = contouredFootprints.committed?.footprint ?? null;
  const workingContouredFootprint = contouredFootprints.working?.footprint ?? null;
  const contouredConstructionError =
    contouredFootprints.committed?.error ?? null;
  const workingContouredConstructionError =
    contouredFootprints.working?.error ?? null;

  const baseHoleFitViolations = useMemo(
    () => validateBaseHoleFit("custom", persistedParams, {
      customContouredFootprint: committedContouredFootprint,
    }),
    [committedContouredFootprint, persistedParams],
  );
  const baseHoleFitBlockingReason = contouredConstructionError?.message ??
    getBaseHoleFitBlockingReason(baseHoleFitViolations);

  const handleGenerate = useCallback(() => {
    if (baseHoleFitBlockingReason) return Promise.resolve();
    return generatePreview();
  }, [baseHoleFitBlockingReason, generatePreview]);

  const handleExportSTL = useCallback(() => {
    if (baseHoleFitBlockingReason) return Promise.resolve();
    return exportSTL();
  }, [baseHoleFitBlockingReason, exportSTL]);

  const calculateEffectiveDimensions = useCallback(
    () => calculateCustomEffectiveDimensions(paramsRef.current),
    [paramsRef],
  );

  const effectiveDimensions = useMemo(
    () => calculateCustomEffectiveDimensions(params),
    [params],
  );

  const updateParam = useCallback(
    <K extends keyof CustomLayoutParams>(
      key: K,
      value: CustomLayoutParams[K],
    ) => {
      applyChange((prev) => updateCustomLayoutParam(prev, key, value));
    },
    [applyChange],
  );

  const addSlot = useCallback(
    (
      width: number,
      height?: number,
      ellipseConfig?: EllipseSlotConfig,
      circleConfig?: CircleSlotConfig,
    ) => {
      applyChange((prev) =>
        addCustomSlot(
          prev,
          randomIdFactory,
          width,
          height,
          ellipseConfig,
          circleConfig,
        ),
      );
    },
    [applyChange],
  );

  const removeSlot = useCallback(
    (id: string) => {
      applyChange((prev) => removeCustomSlot(prev, id));
    },
    [applyChange],
  );

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      applyChange((prev) => updateCustomSlotPosition(prev, id, x, y));
    },
    [applyChange],
  );

  const updateMultipleSlots = useCallback(
    (updates: CustomSlotUpdate[]) => {
      applyChange((prev) => applyCustomSlotUpdates(prev, updates));
    },
    [applyChange],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: CustomSlotUpdate[]) => {
      if (!hasActiveContinuousEdit()) {
        beginContinuousEditTransaction();
      }
      previewContinuousEdit((working) =>
        applyCustomSlotUpdates(working, updates),
      );
    },
    [beginContinuousEditTransaction, hasActiveContinuousEdit, previewContinuousEdit],
  );

  const updateSlotRotation = useCallback(
    (id: string, rotation: number) => {
      applyChange((prev) => updateCustomSlotRotation(prev, id, rotation));
    },
    [applyChange],
  );

  const insertSlots = useCallback(
    (slotsToInsert: SymmetryInsertSlot[]) => {
      if (slotsToInsert.length === 0) return;
      applyChange((prev) =>
        insertCustomSlots(prev, randomIdFactory, slotsToInsert),
      );
    },
    [applyChange],
  );

  const duplicateSlots = useCallback(
    (ids: string[]): string[] => {
      const current = paramsRef.current;
      const result = duplicateCustomSlots(current, randomIdFactory, ids);
      applyChange(() => result.params);
      return result.newIds;
    },
    [applyChange, paramsRef],
  );

  const trimBaseplate = useCallback(() => {
    applyChange((prev) => {
      if (prev.slots.length === 0) return prev;
      const dims = calculateCustomEffectiveDimensions(prev);
      return trimCustomBaseplate(prev, dims);
    });
  }, [applyChange]);

  const beginContinuousEdit = useCallback(() => {
    return beginContinuousEditTransaction().status === "previewing";
  }, [beginContinuousEditTransaction]);

  const commitContinuousEdit = useCallback(() => {
    commitContinuousEditTransaction();
  }, [commitContinuousEditTransaction]);

  const cancelContinuousEdit = useCallback(() => {
    cancelContinuousEditTransaction();
  }, [cancelContinuousEditTransaction]);

  return {
    params,
    persistedParams,
    committedContouredFootprint,
    workingContouredFootprint,
    contouredConstructionError,
    workingContouredConstructionError,
    setParams,
    updateParam,
    addSlot,
    removeSlot,
    updateSlotPosition,
    updateMultipleSlots,
    updateMultipleSlotsLive,
    beginContinuousEdit,
    commitContinuousEdit,
    cancelContinuousEdit,
    updateSlotRotation,
    insertSlots,
    duplicateSlots,
    trimBaseplate,
    calculateEffectiveDimensions,
    effectiveDimensions,
    undo,
    canUndo,
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
