"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { browserDownloadPort } from "@/lib/download-port";
import { randomIdFactory } from "@/lib/id-factory";
import type { CustomLayoutParams } from "@/types/custom-tray";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import {
  addCustomSlot,
  applyCustomSlotUpdates,
  duplicateCustomSlots,
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
  exportCustomModelFiles,
  generateCustomPreview,
} from "@/lib/custom-layout-service";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useToast } from "@/hooks/useToast";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

interface UseCustomLayoutReturn {
  params: CustomLayoutParams;
  setParams: React.Dispatch<React.SetStateAction<CustomLayoutParams>>;
  updateParam: <K extends keyof CustomLayoutParams>(
    key: K,
    value: CustomLayoutParams[K],
  ) => void;
  addSlot: (width: number, height?: number, ellipseConfig?: EllipseSlotConfig) => void;
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
  const [params, internalSetParams] = useState<CustomLayoutParams>(
    CUSTOM_LAYOUT_DEFAULTS,
  );
  const [threeGeometry, setThreeGeometry] =
    useState<THREE.BufferGeometry | null>(null);
  const [volume, setVolume] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const jscadGeomRef = useRef<Geom3 | null>(null);
  const { toast } = useToast();

  // 撤销历史
  const {
    pushState,
    popState,
    canUndo: canUndoFn,
  } = useUndoHistory<CustomLayoutParams>();
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const [isPreviewStale, setIsPreviewStale] = useState(false);

  const invalidatePreview = useCallback(() => {
    jscadGeomRef.current = null;
    setIsPreviewStale(true);
  }, []);

  const setParams = useCallback<
    React.Dispatch<React.SetStateAction<CustomLayoutParams>>
  >(
    (value) => {
      internalSetParams((prev) =>
        typeof value === "function"
          ? (value as (prevState: CustomLayoutParams) => CustomLayoutParams)(
              prev,
            )
          : value,
      );
      invalidatePreview();
    },
    [invalidatePreview],
  );

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

  /** 手动保存快照（供拖拽开始时调用） */
  const saveSnapshot = useCallback(() => {
    pushState(paramsRef.current);
  }, [pushState]);

  /** 撤销到上一步 */
  const undo = useCallback(() => {
    const prev = popState();
    if (prev) {
      internalSetParams(prev);
      invalidatePreview();
    }
  }, [invalidatePreview, popState]);

  const updateParam = useCallback(
    <K extends keyof CustomLayoutParams>(
      key: K,
      value: CustomLayoutParams[K],
    ) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => updateCustomLayoutParam(prev, key, value));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const addSlot = useCallback(
    (width: number, height?: number, ellipseConfig?: EllipseSlotConfig) => {
      internalSetParams((prev) => {
        pushState(prev);
        return addCustomSlot(
          prev,
          randomIdFactory,
          width,
          height,
          ellipseConfig,
        );
      });
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const removeSlot = useCallback(
    (id: string) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => removeCustomSlot(prev, id));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateSlotPosition = useCallback((id: string, x: number, y: number) => {
    internalSetParams((prev) => updateCustomSlotPosition(prev, id, x, y));
    invalidatePreview();
  }, [invalidatePreview]);

  const applyMultipleSlotUpdates = useCallback(
    (
      updates: CustomSlotUpdate[],
      saveHistory: boolean,
    ) => {
      internalSetParams((prev) => {
        if (saveHistory) {
          pushState(prev);
        }

        return applyCustomSlotUpdates(prev, updates);
      });
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateMultipleSlots = useCallback(
    (updates: CustomSlotUpdate[]) => {
      applyMultipleSlotUpdates(updates, true);
    },
    [applyMultipleSlotUpdates],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: CustomSlotUpdate[]) => {
      applyMultipleSlotUpdates(updates, false);
    },
    [applyMultipleSlotUpdates],
  );

  const updateSlotRotation = useCallback((id: string, rotation: number) => {
    internalSetParams((prev) => updateCustomSlotRotation(prev, id, rotation));
    invalidatePreview();
  }, [invalidatePreview]);

  const insertSlots = useCallback(
    (slotsToInsert: SymmetryInsertSlot[]) => {
      if (slotsToInsert.length === 0) return;

      internalSetParams((prev) => {
        pushState(prev);
        return insertCustomSlots(prev, randomIdFactory, slotsToInsert);
      });
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const duplicateSlots = useCallback(
    (ids: string[]): string[] => {
      const current = paramsRef.current;
      pushState(current);
      const result = duplicateCustomSlots(current, randomIdFactory, ids);
      internalSetParams(result.params);
      invalidatePreview();
      return result.newIds;
    },
    [invalidatePreview, pushState],
  );

  const trimBaseplate = useCallback(() => {
    internalSetParams((prev) => {
      if (prev.slots.length === 0) return prev;
      pushState(prev);
      const dims = calculateCustomEffectiveDimensions(prev);
      return trimCustomBaseplate(prev, dims);
    });
    invalidatePreview();
  }, [invalidatePreview, pushState]);

  const handleGenerate = useCallback(async () => {
    if (!trayWorkerService) return;
    setIsGenerating(true);
    try {
      const result = await generateCustomPreview(params, trayWorkerService);
      jscadGeomRef.current = result.geometry;
      setVolume(result.volume);
      setThreeGeometry((prev) => {
        prev?.dispose();
        return result.threeGeometry;
      });
      setIsPreviewStale(false);
    } catch (err) {
      console.error("生成失败:", err);
      toast(
        "error",
        `模型生成失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    } finally {
      setIsGenerating(false);
    }
  }, [params, toast]);

  const handleExportSTL = useCallback(async () => {
    if (!jscadGeomRef.current || !trayWorkerService) return;
    try {
      await exportCustomModelFiles(
        params,
        effectiveDimensions,
        jscadGeomRef.current,
        trayWorkerService,
        browserDownloadPort,
      );
    } catch (err) {
      console.error("STL导出失败:", err);
      toast(
        "error",
        `STL 导出失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [
    effectiveDimensions,
    params,
    toast,
  ]);

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
    calculateEffectiveDimensions,
    effectiveDimensions,
    saveSnapshot,
    undo,
    canUndo: canUndoFn(),
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  };
}
