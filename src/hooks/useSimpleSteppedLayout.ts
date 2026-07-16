"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import type {
  CustomLayoutParams,
  FreeSlot,
  SimpleSteppedLayoutParams,
  SimpleSteppedRow,
} from "@/types/custom-tray";
import { createSimpleSteppedSlotInstance } from "@/lib/slot-instance-factory";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import {
  calculateSimpleSteppedMinimumTraySize,
  calculateSimpleSteppedDimensions,
  clampSimpleSteppedSlotUpdates,
  deriveSimpleSteppedLayout,
  getSimpleSteppedEffectiveDiameter,
  mapSimpleSteppedCanvasUpdatesToLocal,
  normalizeSimpleSteppedParams,
  type SimpleSteppedDerivedLayout,
} from "@/lib/simple-stepped-projection";
import type { CanvasSlotUpdate } from "@/lib/canvas-types";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { usePreviewLifecycle } from "@/hooks/usePreviewLifecycle";
import { trayWorkerService } from "@/lib/worker/worker-service";
import {
  captureModeParamSnapshot,
  createModelGeometryFingerprint,
  type ModeParamSnapshot,
} from "@/lib/mode-param-snapshot";
import { browserDownloadPort } from "@/lib/download-port";
import { exportSimpleSteppedModelFiles } from "@/lib/simple-stepped-model-service";
import { BASE_HOLE_PARAM_DEFAULTS } from "@/lib/base-hole-config";
import {
  getBaseHoleFitBlockingReason,
  validateBaseHoleFit,
  type BaseHoleFitViolation,
} from "@/lib/base-hole-rules";

export interface UseSimpleSteppedLayoutReturn {
  params: SimpleSteppedLayoutParams;
  setParams: React.Dispatch<React.SetStateAction<SimpleSteppedLayoutParams>>;
  updateParam: <K extends keyof SimpleSteppedLayoutParams>(
    key: K,
    value: SimpleSteppedLayoutParams[K],
  ) => void;
  activeRowId: string | null;
  setActiveRow: (rowId: string | null) => void;
  addRow: () => void;
  removeRow: (rowId: string) => void;
  renameRow: (rowId: string, name: string) => void;
  clearRow: (rowId: string) => void;
  reorderRows: (fromIndex: number, toIndex: number) => void;
  addSlotToRow: (rowId: string, diameter: number) => void;
  removeSlot: (id: string) => void;
  updateSlotPosition: (id: string, x: number, y: number) => void;
  updateMultipleSlots: (updates: CanvasSlotUpdate[]) => void;
  updateMultipleSlotsLive: (updates: CanvasSlotUpdate[]) => void;
  updateSlotRotation: (id: string, rotation: number) => void;
  duplicateSlots: (ids: string[]) => string[];
  derivedLayout: SimpleSteppedDerivedLayout;
  canvasParams: CustomLayoutParams;
  effectiveDimensions: {
    width: number;
    depth: number;
    height: number;
  };
  saveSnapshot: () => void;
  undo: () => void;
  canUndo: boolean;
  resizeTray: (width: number, depth: number) => void;
  trimTray: () => void;
  threeGeometry: THREE.BufferGeometry | null;
  volume: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  baseHoleFitViolations: BaseHoleFitViolation[];
  baseHoleFitBlockingReason: string | null;
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useSimpleSteppedLayout(): UseSimpleSteppedLayoutReturn {
  const [params, internalSetParams] = useState<SimpleSteppedLayoutParams>(
    SIMPLE_STEPPED_LAYOUT_DEFAULTS,
  );
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const {
    pushState,
    popState,
    canUndo: canUndoFn,
  } = useUndoHistory<SimpleSteppedLayoutParams>();
  const {
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    invalidatePreview,
    handleGenerate,
    handleExportSTL,
  } = usePreviewLifecycle<
    SimpleSteppedLayoutParams,
    ModeParamSnapshot<"simple-stepped">
  >({
    getParams: () => paramsRef.current,
    captureSnapshot: (currentParams) =>
      captureModeParamSnapshot("simple-stepped", currentParams),
    fingerprintSnapshot: createModelGeometryFingerprint,
    generatePreview: async (snapshot) => {
      if (!trayWorkerService) {
        return null;
      }
      const result = await trayWorkerService.generateSimpleStepped(
        snapshot.params,
      );
      return {
        geometry: result.geometry,
        threeGeometry: jscadToThreeGeometry(result.geometry),
        volume: result.volume,
      };
    },
    exportModel: async (snapshot, geometry) => {
      if (!trayWorkerService) {
        return;
      }
      await exportSimpleSteppedModelFiles(
        snapshot,
        geometry,
        trayWorkerService,
        browserDownloadPort,
      );
    },
    validateSnapshot: (snapshot) =>
      getBaseHoleFitBlockingReason(
        validateBaseHoleFit("simple-stepped", snapshot.params),
      ),
  });

  const baseHoleFitViolations = useMemo(
    () => validateBaseHoleFit("simple-stepped", params),
    [params],
  );
  const baseHoleFitBlockingReason = getBaseHoleFitBlockingReason(
    baseHoleFitViolations,
  );

  const normalizeParams = useCallback(
    (next: SimpleSteppedLayoutParams) => normalizeSimpleSteppedParams(next),
    [],
  );

  const setParams = useCallback<
    React.Dispatch<React.SetStateAction<SimpleSteppedLayoutParams>>
  >(
    (value) => {
      internalSetParams((prev) =>
        normalizeParams(
          typeof value === "function"
            ? (value as (prevState: SimpleSteppedLayoutParams) => SimpleSteppedLayoutParams)(prev)
            : value,
        ),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams],
  );

  const resolvedActiveRowId = useMemo(() => {
    if (activeRowId && params.rows.some((row) => row.id === activeRowId)) {
      return activeRowId;
    }
    return params.rows[0]?.id ?? null;
  }, [activeRowId, params.rows]);

  const derivedLayout = useMemo(
    () => deriveSimpleSteppedLayout(params, resolvedActiveRowId),
    [params, resolvedActiveRowId],
  );

  const effectiveDimensions = useMemo(
    () => calculateSimpleSteppedDimensions(params),
    [params],
  );

  const canvasParams = useMemo<CustomLayoutParams>(() => {
    const slots: FreeSlot[] = derivedLayout.activeRows.flatMap((row) =>
      row.slots.map((slot) => ({
        id: slot.id,
        x: slot.globalX,
        y: slot.globalY,
        shape: "circle" as const,
        width: slot.diameter,
        height: slot.diameter,
        slotDefinitionId: params.slots.find((item) => item.id === slot.id)
          ?.slotDefinitionId,
        slotWidth: slot.effectiveDiameter,
        slotHeight: slot.effectiveDiameter,
        rotation: 0,
      })),
    );

    return {
      trayWidth: derivedLayout.trayWidth,
      trayDepth: derivedLayout.trayDepth,
      slots,
      spacing: params.spacing,
      boundarySpacing: params.outerMarginIndependent
        ? params.outerMargin
        : params.spacing,
      boundarySpacingIndependent: params.outerMarginIndependent,
      baseThickness: params.firstRowHeight,
      holeDepth: params.holeDepth,
      cornerRadius: params.cornerRadius,
      sideBevelWidth: 0,
      ...BASE_HOLE_PARAM_DEFAULTS,
      baseHoleStructure: "none",
    };
  }, [
    derivedLayout,
    params.cornerRadius,
    params.firstRowHeight,
    params.holeDepth,
    params.outerMarginIndependent,
    params.outerMargin,
    params.spacing,
    params.slots,
  ]);

  const saveSnapshot = useCallback(() => {
    pushState(paramsRef.current);
  }, [pushState]);

  const undo = useCallback(() => {
    const prev = popState();
    if (prev) {
      internalSetParams(normalizeParams(prev));
      invalidatePreview();
    }
  }, [invalidatePreview, normalizeParams, popState]);

  const updateParam = useCallback(
    <K extends keyof SimpleSteppedLayoutParams>(
      key: K,
      value: SimpleSteppedLayoutParams[K],
    ) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => {
        if (key === "spacing") {
          const nextSpacing = value as SimpleSteppedLayoutParams["spacing"];
          if (!prev.outerMarginIndependent) {
            return normalizeParams({
              ...prev,
              spacing: nextSpacing,
              outerMargin: nextSpacing,
            });
          }
          return normalizeParams({ ...prev, spacing: nextSpacing });
        }

        if (key === "outerMarginIndependent") {
          const independent =
            value as SimpleSteppedLayoutParams["outerMarginIndependent"];
          if (!independent) {
            return normalizeParams({
              ...prev,
              outerMarginIndependent: false,
              outerMargin: prev.spacing,
            });
          }
          return normalizeParams({
            ...prev,
            outerMarginIndependent: true,
            outerMargin: prev.outerMargin ?? prev.spacing,
          });
        }

        return normalizeParams({ ...prev, [key]: value });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const addRow = useCallback(() => {
    const newRow: SimpleSteppedRow = {
      id: crypto.randomUUID(),
      name: `行 ${paramsRef.current.rows.length + 1}`,
      slotIds: [],
    };
    internalSetParams((prev) => {
      pushState(prev);
      return normalizeParams({
        ...prev,
        rows: [...prev.rows, newRow],
      });
    });
    setActiveRowId(newRow.id);
    invalidatePreview();
  }, [invalidatePreview, normalizeParams, pushState]);

  const removeRow = useCallback(
    (rowId: string) => {
      internalSetParams((prev) => {
        pushState(prev);
        return normalizeParams({
          ...prev,
          rows: prev.rows.filter((row) => row.id !== rowId),
          slots: prev.slots.filter((slot) => slot.rowId !== rowId),
        });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const renameRow = useCallback(
    (rowId: string, name: string) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams({
          ...prev,
          rows: prev.rows.map((row) =>
            row.id === rowId ? { ...row, name: name.trim() || row.name } : row,
          ),
        }),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const clearRow = useCallback(
    (rowId: string) => {
      internalSetParams((prev) => {
        pushState(prev);
        return normalizeParams({
          ...prev,
          slots: prev.slots.filter((slot) => slot.rowId !== rowId),
        });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const reorderRows = useCallback(
    (fromIndex: number, toIndex: number) => {
      internalSetParams((prev) => {
        if (
          fromIndex < 0 ||
          fromIndex >= prev.rows.length ||
          toIndex < 0 ||
          toIndex >= prev.rows.length ||
          fromIndex === toIndex
        ) {
          return prev;
        }

        pushState(prev);
        const nextRows = [...prev.rows];
        const [moved] = nextRows.splice(fromIndex, 1);
        nextRows.splice(toIndex, 0, moved);
        return normalizeParams({
          ...prev,
          rows: nextRows,
        });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const addSlotToRow = useCallback(
    (rowId: string, diameter: number) => {
      internalSetParams((prev) => {
        const rowExists = prev.rows.some((row) => row.id === rowId);
        if (!rowExists) {
          return prev;
        }

        pushState(prev);
        const rowSlots = prev.slots.filter((slot) => slot.rowId === rowId);
        const effectiveDiameter = getSimpleSteppedEffectiveDiameter({ diameter });
        const x =
          rowSlots.length === 0
            ? 0
            : Math.max(
                ...rowSlots.map((slot) => slot.x + getSimpleSteppedEffectiveDiameter(slot) / 2),
              ) +
              prev.spacing +
              effectiveDiameter / 2;

        const newSlot = createSimpleSteppedSlotInstance({
          id: crypto.randomUUID(),
          rowId,
          diameter,
          x,
        });

        return normalizeParams({
          ...prev,
          slots: [...prev.slots, newSlot],
        });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const removeSlot = useCallback(
    (id: string) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams({
          ...prev,
          slots: prev.slots.filter((slot) => slot.id !== id),
        }),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const applyMultipleCanvasSlotUpdates = useCallback(
    (updates: CanvasSlotUpdate[], saveHistory: boolean) => {
      internalSetParams((prev) => {
        if (saveHistory) {
          pushState(prev);
        }

        const localUpdates = clampSimpleSteppedSlotUpdates(
          prev,
          mapSimpleSteppedCanvasUpdatesToLocal(prev, updates),
        );
        const updatesMap = new Map(
          localUpdates.map((update) => [update.id, update] as const),
        );

        return normalizeParams({
          ...prev,
          slots: prev.slots.map((slot) =>
            updatesMap.has(slot.id)
              ? {
                  ...slot,
                  x: updatesMap.get(slot.id)?.x ?? slot.x,
                  y: updatesMap.get(slot.id)?.y ?? slot.y,
                }
              : slot,
          ),
        });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      applyMultipleCanvasSlotUpdates([{ id, x, y }], false);
    },
    [applyMultipleCanvasSlotUpdates],
  );

  const updateMultipleSlots = useCallback(
    (updates: CanvasSlotUpdate[]) => {
      applyMultipleCanvasSlotUpdates(updates, true);
    },
    [applyMultipleCanvasSlotUpdates],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: CanvasSlotUpdate[]) => {
      applyMultipleCanvasSlotUpdates(updates, false);
    },
    [applyMultipleCanvasSlotUpdates],
  );

  const updateSlotRotation = useCallback((id: string, rotation: number) => {
    // 第一版仅支持圆形槽，旋转无意义；保留接口兼容 LayoutCanvas。
    void id;
    void rotation;
  }, []);

  const duplicateSlots = useCallback(
    (ids: string[]) => {
      const current = paramsRef.current;
      const idSet = new Set(ids);
      const targets = current.slots.filter((slot) => idSet.has(slot.id));
      if (targets.length === 0) {
        return [];
      }

      const newIds = targets.map(() => crypto.randomUUID());
      internalSetParams((prev) => {
        pushState(prev);
        const nextSlots = [...prev.slots];

        targets.forEach((slot, index) => {
          nextSlots.push({
            ...slot,
            id: newIds[index],
            x: slot.x + getSimpleSteppedEffectiveDiameter(slot) + prev.spacing,
          });
        });

        return normalizeParams({
          ...prev,
          slots: nextSlots,
        });
      });
      invalidatePreview();
      return newIds;
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const resizeTray = useCallback(
    (width: number, depth: number) => {
      internalSetParams((prev) =>
        normalizeParams({
          ...prev,
          trayWidth: width,
          trayDepth: depth,
        }),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams],
  );

  const trimTray = useCallback(() => {
    let didTrim = false;
    internalSetParams((prev) => {
      const minimumDims = calculateSimpleSteppedMinimumTraySize(prev);
      if (minimumDims.width <= 0 || minimumDims.depth <= 0) {
        return prev;
      }
      if (
        Math.abs(prev.trayWidth - minimumDims.width) < 0.001 &&
        Math.abs(prev.trayDepth - minimumDims.depth) < 0.001
      ) {
        return prev;
      }

      pushState(prev);
      didTrim = true;
      return normalizeParams({
        ...prev,
        trayWidth: minimumDims.width,
        trayDepth: minimumDims.depth,
      });
    });
    if (didTrim) {
      invalidatePreview();
    }
  }, [invalidatePreview, normalizeParams, pushState]);

  return {
    params,
    setParams,
    updateParam,
    activeRowId: resolvedActiveRowId,
    setActiveRow: setActiveRowId,
    addRow,
    removeRow,
    renameRow,
    clearRow,
    reorderRows,
    addSlotToRow,
    removeSlot,
    updateSlotPosition,
    updateMultipleSlots,
    updateMultipleSlotsLive,
    updateSlotRotation,
    duplicateSlots,
    derivedLayout,
    canvasParams,
    effectiveDimensions,
    saveSnapshot,
    undo,
    canUndo: canUndoFn(),
    resizeTray,
    trimTray,
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
