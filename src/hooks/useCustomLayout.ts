"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserDownloadPort } from "@/lib/download-port";
import { randomIdFactory } from "@/lib/id-factory";
import type { CustomLayoutParams } from "@/types/custom-tray";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import {
  addCustomSlot,
  applyCustomSlotUpdates,
  duplicateCustomSlots,
  expandCustomBoxToFit,
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
import {
  calculateCustomEffectiveDimensions,
  calculateCustomTrayFootprint,
  validateCustomBox,
  type LayoutExtents,
} from "@/lib/custom-layout-math";
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
  getBaseHoleFitBlockingReason,
  type BaseHoleFitViolation,
} from "@/lib/base-hole-construction-plan";
import {
  applyFlatTrayBaseHoleSupportingThickness,
  createCustomBaseHoleConstructionPlan,
} from "@/lib/base-hole-planning";
import type {
  ConstructedContouredFootprint,
} from "@/lib/contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import type { BaseHoleConstructionPlan } from "@/lib/base-hole-construction-plan";
import { constructCustomContouredFootprintOutcome, projectCustomContouredFootprintInput } from "@/lib/custom-contoured-footprint";

interface UseCustomLayoutReturn {
  params: CustomLayoutParams;
  persistedParams: CustomLayoutParams;
  contouredFootprintState: ContouredFootprintState<ConstructedContouredFootprint>;
  workingContouredFootprintState: ContouredFootprintState<ConstructedContouredFootprint>;
  setContouredWorkingPreviewEnabled: (enabled: boolean) => void;
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
  expandBoxToFit: () => void;
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
  bodyVolume?: number;
  lidVolume?: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  transactionRevision: number;
  baseHolePlan: BaseHoleConstructionPlan;
  baseHoleFitViolations: readonly BaseHoleFitViolation[];
  baseHoleFitBlockingReason: string | null;
  blockingReason: string | null;
  handleGenerate: () => Promise<void>;
  handleExportSTL: () => Promise<void>;
}

export function useCustomLayout(): UseCustomLayoutReturn {
  const [
    contouredWorkingPreviewEnabled,
    setContouredWorkingPreviewEnabled,
  ] = useState(false);
  const contouredFootprintStateRef = useRef<
    ContouredFootprintState<ConstructedContouredFootprint>
  >({ status: "inactive" });
  const contouredFootprintFingerprintRef = useRef("");
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
    sessionEpoch,
    undo,
    canUndo,
    threeGeometry,
    volume,
    bodyVolume,
    lidVolume,
    isGenerating,
    isPreviewStale,
    transactionRevision,
    handleGenerate: generatePreview,
    handleExportSTL: exportSTL,
  } = useEditableParams<
    CustomLayoutParams,
    ModeParamSnapshot<"custom">,
    LayoutExtents
  >({
    initialState: CUSTOM_LAYOUT_DEFAULTS,
    normalize: applyFlatTrayBaseHoleSupportingThickness,
    captureSnapshot: (params) => captureModeParamSnapshot("custom", params),
    captureExportContext: (snapshot) => {
      let state = contouredFootprintStateRef.current;
      if (snapshot.params.footprintStyle === "polygonal"
        && createModelGeometryFingerprint(snapshot) !== contouredFootprintFingerprintRef.current) {
        const outcome = constructCustomContouredFootprintOutcome(projectCustomContouredFootprintInput(snapshot.params));
        state = outcome.ok ? { status: "ready", value: outcome.value }
          : { status: "failed", error: outcome.error };
      }
      const footprint = calculateCustomTrayFootprint(
        snapshot.params,
        state,
      );
      return {
        width: footprint.width,
        depth: footprint.depth,
        minX: footprint.minX,
        maxX: footprint.maxX,
        minY: footprint.minY,
        maxY: footprint.maxY,
      };
    },
    fingerprintSnapshot: createModelGeometryFingerprint,
    guard: () => trayWorkerService !== null,
    generatePreview: async (snapshot) =>
      generateCustomPreview(snapshot.params, trayWorkerService!),
    exportModel: async (snapshot, geometry, effectiveDimensions) => {
      await exportCustomModelFiles(
        snapshot,
        geometry,
        trayWorkerService!,
        browserDownloadPort,
        effectiveDimensions,
      );
    },
    // 主线程校验由下方的权威构造结果统一提供，避免生成前再次从快照重构轮廓。
    validateSnapshot: (snapshot) => {
      const result = validateCustomBox(snapshot.params);
      return result.valid
        ? null
        : (result.blockingReasons[0]?.message ?? "堆叠盒体参数无效");
    },
  });

  const contouredFootprints = useCustomContouredFootprint({
    persistedParams,
    workingParams,
    sessionEpoch,
    workingEnabled: contouredWorkingPreviewEnabled,
  });
  const contouredFootprintState = contouredFootprints.committed;
  useEffect(() => {
    contouredFootprintStateRef.current = contouredFootprintState;
    contouredFootprintFingerprintRef.current = createModelGeometryFingerprint(captureModeParamSnapshot("custom", persistedParams));
  }, [contouredFootprintState, persistedParams]);
  const workingContouredFootprintState = contouredFootprints.working;

  const baseHolePlan = useMemo(
    () => createCustomBaseHoleConstructionPlan(persistedParams, {
      contouredState: contouredFootprintState,
    }),
    [contouredFootprintState, persistedParams],
  );
  const baseHoleFitViolations = baseHolePlan.violations;
  const baseHoleFitBlockingReason =
    (contouredFootprintState.status === "failed"
      ? contouredFootprintState.error.message
      : null) ??
    getBaseHoleFitBlockingReason(baseHoleFitViolations);

  const boxValidation = useMemo(() => validateCustomBox(params), [params]);
  const blockingReason = boxValidation.valid
    ? baseHoleFitBlockingReason
    : (boxValidation.blockingReasons[0]?.message ?? "堆叠盒体参数无效");

  const handleGenerate = useCallback(() => {
    if (blockingReason) return Promise.resolve();
    return generatePreview();
  }, [blockingReason, generatePreview]);

  const handleExportSTL = useCallback(() => {
    if (blockingReason) return Promise.resolve();
    return exportSTL();
  }, [blockingReason, exportSTL]);

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

  const expandBoxToFit = useCallback(() => {
    applyChange((prev) => expandCustomBoxToFit(prev));
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
    contouredFootprintState,
    workingContouredFootprintState,
    setContouredWorkingPreviewEnabled,
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
    expandBoxToFit,
    calculateEffectiveDimensions,
    effectiveDimensions,
    undo,
    canUndo,
    threeGeometry,
    volume,
    bodyVolume,
    lidVolume,
    isGenerating,
    isPreviewStale,
    transactionRevision,
    baseHolePlan,
    baseHoleFitViolations,
    baseHoleFitBlockingReason,
    blockingReason,
    handleGenerate,
    handleExportSTL,
  };
}
