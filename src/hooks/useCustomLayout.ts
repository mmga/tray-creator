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
import {
  calculateCustomEffectiveDimensions,
} from "@/lib/custom-layout-math";
import {
  randomizeCustomSlotArrangement,
  type RandomSlotArrangementResult,
} from "@/lib/custom-random-layout";
import {
  exportCustomModelFiles,
  generateCustomPreview,
} from "@/lib/custom-layout-service";
import { useEditableParams } from "@/hooks/useEditableParams";
import { trayWorkerService } from "@/lib/worker/worker-service";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import type * as THREE from "three";

interface UseCustomLayoutReturn {
  params: CustomLayoutParams;
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
  updateSlotRotation: (id: string, rotation: number) => void;
  insertSlots: (slots: SymmetryInsertSlot[]) => void;
  duplicateSlots: (ids: string[]) => string[];
  trimBaseplate: () => void;
  randomizeSlots: () => RandomSlotArrangementResult;
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
  // 历史操作
  saveSnapshot: () => void;
  undo: () => void;
  canUndo: boolean;
  // 3D 相关
  threeGeometry: THREE.BufferGeometry | null;
  volume: number; // in mm^3
  isGenerating: boolean;
  isPreviewStale: boolean;
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useCustomLayout(): UseCustomLayoutReturn {
  const {
    params,
    paramsRef,
    setParams,
    applyChange,
    saveSnapshot,
    undo,
    canUndo,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  } = useEditableParams<CustomLayoutParams>({
    initialState: CUSTOM_LAYOUT_DEFAULTS,
    guard: () => trayWorkerService !== null,
    generatePreview: async (currentParams) =>
      generateCustomPreview(currentParams, trayWorkerService!),
    exportModel: async (currentParams, geometry) => {
      await exportCustomModelFiles(
        currentParams,
        calculateCustomEffectiveDimensions(currentParams),
        geometry,
        trayWorkerService!,
        browserDownloadPort,
      );
    },
  });

  const calculateEffectiveDimensions = useCallback(
    (current: CustomLayoutParams = paramsRef.current) => {
      return calculateCustomEffectiveDimensions(current);
    },
    [],
  );

  const effectiveDimensions = useMemo(
    () => calculateEffectiveDimensions(params),
    [calculateEffectiveDimensions, params],
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
      applyChange(
        (prev) => updateCustomSlotPosition(prev, id, x, y),
        { history: "live" },
      );
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
      applyChange(
        (prev) => applyCustomSlotUpdates(prev, updates),
        { history: "live" },
      );
    },
    [applyChange],
  );

  const updateSlotRotation = useCallback(
    (id: string, rotation: number) => {
      applyChange(
        (prev) => updateCustomSlotRotation(prev, id, rotation),
        { history: "live" },
      );
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
      applyChange(() => result.params, { force: true });
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

  const randomizeSlots = useCallback(() => {
    const result = randomizeCustomSlotArrangement(paramsRef.current);
    if (result.status === "success") {
      applyChange((prev) => applyCustomSlotUpdates(prev, result.updates));
    }
    return result;
  }, [applyChange, paramsRef]);

  return {
    params,
    setParams,
    updateParam,
    addSlot,
    removeSlot,
    updateSlotPosition,
    updateMultipleSlots,
    updateMultipleSlotsLive,
    updateSlotRotation,
    insertSlots,
    duplicateSlots,
    trimBaseplate,
    randomizeSlots,
    calculateEffectiveDimensions,
    effectiveDimensions,
    saveSnapshot,
    undo,
    canUndo,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  };
}
